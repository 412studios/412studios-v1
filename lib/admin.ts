import "server-only";
import { SlotTakenError, blocking, createAdminBooking } from "./bookings";
import { db } from "./db";
import type { Prisma } from "./generated/prisma/client";
import { dateInt, hourOf, isoOfDateInt, newId, roomId, slotOf, studioOfRoom } from "./legacy";
import { CLOSE_HOUR, OPEN_HOUR, torontoNow, type StudioId } from "./studios";
import type { AdminBooking, AdminMembership, AdminUser, AdminUserRef, BookingStatus } from "./admin-shared";

export * from "./admin-shared";

// Reads and writes for /admin. Every caller checks requireAdmin() first (app/admin/actions.ts);
// nothing here does. Rows keep the old site's encoding (lib/legacy.ts) so both admins agree.

type BookingRow = {
  bookingId: string;
  roomId: number;
  date: number;
  startTime: number;
  endTime: number;
  status: string;
  type: string;
  engineerTotal: number;
  totalPrice: number;
  createdAt: Date;
  user: AdminUserRef;
};

const toBooking = (r: BookingRow): AdminBooking[] => {
  const studio = studioOfRoom(r.roomId);
  if (!studio) return []; // a room this site doesn't know
  return [
    {
      bookingId: r.bookingId,
      studio,
      date: isoOfDateInt(r.date),
      start: hourOf(r.startTime),
      end: hourOf(r.endTime) + 1,
      status: r.status,
      type: r.type,
      engineerHours: Math.max(0, r.engineerTotal),
      price: r.totalPrice,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
    },
  ];
};

const toMembership = (m: { membershipId: string; roomId: number; status: string; availableHours: number; planId: string; createdAt: Date }): AdminMembership[] => {
  const studio = studioOfRoom(m.roomId);
  return studio ? [{ membershipId: m.membershipId, studio, status: m.status, hours: m.availableHours, planId: m.planId, createdAt: m.createdAt.toISOString() }] : [];
};

const userSelect = { id: true, name: true, email: true } as const;
const bookingInclude = { user: { select: userSelect } } as const;

const nameOrEmail = (q: string) => ({
  OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }],
});

export type BookingFilter = { past?: boolean; studio?: StudioId; q?: string };

/** Upcoming bookings (today onwards) across studios, or the most recent past ones. */
export async function listBookings(f: BookingFilter): Promise<AdminBooking[]> {
  const prisma = db();
  if (!prisma) return [];
  const today = dateInt(torontoNow().date);
  const rows = await prisma.bookings.findMany({
    where: {
      date: f.past ? { lt: today } : { gte: today },
      ...(f.studio ? { roomId: roomId(f.studio) } : {}),
      ...(f.q ? { user: nameOrEmail(f.q) } : {}),
    },
    orderBy: f.past ? [{ date: "desc" }, { startTime: "desc" }] : [{ date: "asc" }, { startTime: "asc" }],
    take: f.past ? 300 : undefined,
    include: bookingInclude,
  });
  return rows.flatMap(toBooking);
}

/** Everyone with an account or a past guest checkout, for pickers. */
export async function listUserRefs(): Promise<AdminUserRef[]> {
  const prisma = db();
  if (!prisma) return [];
  return prisma.user.findMany({ select: userSelect, orderBy: [{ name: "asc" }, { email: "asc" }] });
}

export async function listUsers(q?: string): Promise<AdminUser[]> {
  const prisma = db();
  if (!prisma) return [];
  const rows = await prisma.user.findMany({
    where: q ? nameOrEmail(q) : undefined,
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 500,
    select: { ...userSelect, role: true, phone: true, memberships: { orderBy: { createdAt: "desc" } }, _count: { select: { Bookings: true } } },
  });
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    memberships: u.memberships.flatMap(toMembership),
    bookings: u._count.Bookings,
  }));
}

export async function getUser(id: string): Promise<(AdminUser & { history: AdminBooking[] }) | null> {
  const prisma = db();
  if (!prisma) return null;
  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      ...userSelect,
      role: true,
      phone: true,
      memberships: { orderBy: { createdAt: "desc" } },
      Bookings: { orderBy: [{ date: "desc" }, { startTime: "desc" }], include: bookingInclude },
    },
  });
  if (!u) return null;
  const history = u.Bookings.flatMap(toBooking);
  return { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, memberships: u.memberships.flatMap(toMembership), bookings: history.length, history };
}

export class NotFoundError extends Error {}

/** Throws when another blocking booking overlaps these slots in the same room and day. */
async function assertFree(tx: Prisma.TransactionClient, room: number, date: number, startSlot: number, endSlot: number, except: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(CAST(${room * 100_000_000 + date} AS bigint))`;
  const clash = await tx.bookings.count({
    where: { ...blocking(room, date), bookingId: { not: except }, startTime: { lte: endSlot }, endTime: { gte: startSlot } },
  });
  if (clash) throw new SlotTakenError();
}

/**
 * Moves a booking to start–end (hours, end exclusive) after the same overlap check as a new one.
 * totalHours is the slot count (end − start + 1), which the old admin got wrong by one.
 */
export async function updateBookingTimes(bookingId: string, start: number, end: number) {
  const prisma = db();
  if (!prisma) throw new Error("Database not configured");
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < OPEN_HOUR || end > CLOSE_HOUR || end <= start) throw new Error("Invalid time range");
  const startSlot = slotOf(start);
  const endSlot = slotOf(end) - 1;
  const hours = endSlot - startSlot + 1;
  return prisma.$transaction(async (tx) => {
    const b = await tx.bookings.findUnique({ where: { bookingId } });
    if (!b) throw new NotFoundError("Booking not found");
    if (b.status !== "cancelled") await assertFree(tx, b.roomId, b.date, startSlot, endSlot, bookingId);
    const engineer = b.engineerTotal > 0;
    return tx.bookings.update({
      where: { bookingId },
      data: {
        startTime: startSlot,
        endTime: endSlot,
        totalHours: hours,
        // Keep the engineer inside the new window.
        engineerStart: engineer ? Math.min(Math.max(b.engineerStart, startSlot), endSlot) : -1,
        engineerTotal: engineer ? Math.min(b.engineerTotal, hours) : -1,
      },
    });
  });
}

export async function setBookingStatus(bookingId: string, status: BookingStatus) {
  const prisma = db();
  if (!prisma) throw new Error("Database not configured");
  return prisma.$transaction(async (tx) => {
    const b = await tx.bookings.findUnique({ where: { bookingId } });
    if (!b) throw new NotFoundError("Booking not found");
    // Bringing a cancelled booking back must not double-book the room.
    if (b.status === "cancelled" && status !== "cancelled") await assertFree(tx, b.roomId, b.date, b.startTime, b.endTime, bookingId);
    return tx.bookings.update({ where: { bookingId }, data: { status, ...(status === "success" ? { engineerStatus: "success" } : {}) } });
  });
}

/** Engineer hours for a booking, 0 to remove. Starts at the first hour of the session, as the booking page does. */
export async function setBookingEngineer(bookingId: string, hours: number) {
  const prisma = db();
  if (!prisma) throw new Error("Database not configured");
  const b = await prisma.bookings.findUnique({ where: { bookingId } });
  if (!b) throw new NotFoundError("Booking not found");
  const max = b.endTime - b.startTime + 1;
  if (!Number.isInteger(hours) || hours < 0 || hours > max) throw new Error(`Engineer hours must be between 0 and ${max}`);
  return prisma.bookings.update({
    where: { bookingId },
    data: hours ? { engineerTotal: hours, engineerStart: b.startTime } : { engineerTotal: -1, engineerStart: -1 },
  });
}

export async function reassignBooking(bookingId: string, userId: string) {
  const prisma = db();
  if (!prisma) throw new Error("Database not configured");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new NotFoundError("User not found");
  return prisma.bookings.update({ where: { bookingId }, data: { userId } });
}

export async function deleteBooking(bookingId: string) {
  const prisma = db();
  if (!prisma) throw new Error("Database not configured");
  await prisma.bookings.delete({ where: { bookingId } });
}

/** Hours added by an owner, as the old admin did it: active at once, no Stripe, one per user and room. */
export async function createAdminMembership(userId: string, studio: StudioId, hours: number) {
  const prisma = db();
  if (!prisma) throw new Error("Database not configured");
  if (!Number.isInteger(hours) || hours < 1 || hours > 200) throw new Error("Hours must be between 1 and 200");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new NotFoundError("User not found");
  const room = roomId(studio);
  const active = await prisma.memberships.findFirst({ where: { userId, roomId: room, status: "active" } });
  if (active) throw new Error("This user already has an active membership in that studio. Adjust its hours instead.");
  const today = torontoNow().date;
  const [y, m, d] = today.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10); // same day next month
  return prisma.memberships.create({
    data: {
      membershipId: newId(),
      stripeSessionId: "",
      stripeMembershipId: "",
      interval: "month",
      status: "active",
      planId: "admin_created",
      currentPeriodStart: dateInt(today),
      currentPeriodEnd: dateInt(nextMonth),
      roomId: room,
      availableHours: hours,
      userId,
    },
  });
}

export async function setMembershipHours(membershipId: string, hours: number) {
  const prisma = db();
  if (!prisma) throw new Error("Database not configured");
  if (!Number.isInteger(hours) || hours < 0 || hours > 1000) throw new Error("Hours must be between 0 and 1000");
  const m = await prisma.memberships.findUnique({ where: { membershipId }, select: { membershipId: true } });
  if (!m) throw new NotFoundError("Membership not found");
  return prisma.memberships.update({ where: { membershipId }, data: { availableHours: hours, updateHours: new Date() } });
}

/** Soft: the row stays, and any hours left can still be spent (lib/members.ts), as on the old site. */
export async function cancelMembership(membershipId: string) {
  const prisma = db();
  if (!prisma) throw new Error("Database not configured");
  const m = await prisma.memberships.findUnique({ where: { membershipId }, select: { membershipId: true } });
  if (!m) throw new NotFoundError("Membership not found");
  return prisma.memberships.update({ where: { membershipId }, data: { status: "cancelled" } });
}

/**
 * A member's session booked by an owner and paid with prepaid hours: the booking is "success" at
 * once and the hours come off the membership that has them (oldest first, as the webhook does).
 */
export async function bookFromMembership(b: { userId: string; studio: StudioId; date: string; start: number; end: number; engineer: boolean }) {
  const prisma = db();
  if (!prisma) throw new Error("Database not configured");
  const hours = b.end - b.start;
  const membership = await prisma.memberships.findFirst({
    where: { userId: b.userId, roomId: roomId(b.studio), availableHours: { gte: hours }, OR: [{ status: "active" }, { status: "cancelled" }] },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new Error(`No membership in that studio with ${hours} hours left`);
  const booking = await createAdminBooking({ ...b, price: 0, type: "membership" });
  const debit = await prisma.memberships.updateMany({
    where: { membershipId: membership.membershipId, availableHours: { gte: hours } },
    data: { availableHours: { decrement: hours } },
  });
  if (!debit.count) {
    await prisma.bookings.delete({ where: { bookingId: booking.bookingId } }); // someone spent the hours meanwhile
    throw new Error("Those hours were just used elsewhere. Try again.");
  }
  return booking;
}
