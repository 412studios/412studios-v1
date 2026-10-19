import "server-only";
import { randomBytes } from "node:crypto";
import type { Member } from "./auth";
import { stripe } from "./bookings";
import { db } from "./db";
import { dateInt, hourOf, isoOfDateInt, newId, roomId, studioOfRoom } from "./legacy";
import { torontoNow, type MembershipHours, type StudioId } from "./studios";

/**
 * The User row for a logged-in member, created on first visit. If a pay-now guest already
 * booked with the same email, that guest row (and its bookings) is claimed by the login.
 */
export async function ensureUser(m: Member) {
  const prisma = db();
  if (!prisma) return null;
  const existing = await prisma.user.findUnique({ where: { id: m.id } });
  if (existing) return existing;

  const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || null;
  const guest = m.email ? await prisma.user.findUnique({ where: { email: m.email } }) : null;
  if (!guest) {
    return prisma.user.create({ data: { id: m.id, email: m.email ?? `${m.id}@no-email.invalid`, name } });
  }

  // Email is unique and the guest row holds it, so: create under a placeholder, move the
  // history across, drop the guest, then take the email (and Stripe customer) over.
  return prisma.$transaction(async (tx) => {
    await tx.user.create({ data: { id: m.id, email: `claiming-${m.id}@pending.invalid`, name, phone: guest.phone } });
    await tx.bookings.updateMany({ where: { userId: guest.id }, data: { userId: m.id } });
    await tx.memberships.updateMany({ where: { userId: guest.id }, data: { userId: m.id } });
    await tx.user.delete({ where: { id: guest.id } });
    return tx.user.update({ where: { id: m.id }, data: { email: guest.email, stripeCustomerId: guest.stripeCustomerId } });
  });
}

/** A pay-now visitor with no login. Reuses any row that already has this email (member or guest). */
export async function guestUser(email: string) {
  const prisma = db();
  if (!prisma) return null;
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { id: `guest_${randomBytes(12).toString("hex")}`, email },
  });
}

type UserRow = NonNullable<Awaited<ReturnType<typeof guestUser>>>;

/** Stripe Customer for a user, created on first payment so receipts and history line up in Stripe. */
export async function ensureStripeCustomer(user: UserRow): Promise<string | null> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const s = stripe();
  const prisma = db();
  if (!s || !prisma) return null;
  const customer = await s.customers.create({ email: user.email, ...(user.name ? { name: user.name } : {}) });
  await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

/** Memberships that can still be spent: active, or cancelled by an admin but with hours left. */
const spendable = (userId: string) => ({
  userId,
  OR: [{ status: "active" }, { status: "cancelled", availableHours: { gt: 0 } }],
});

export type HourBalance = { membershipId: string; studio: StudioId; hours: number };

export async function hourBalances(userId: string): Promise<HourBalance[]> {
  const prisma = db();
  if (!prisma) return [];
  const rows = await prisma.memberships.findMany({ where: spendable(userId), orderBy: { roomId: "asc" } });
  return rows.flatMap((r) => {
    const studio = studioOfRoom(r.roomId);
    return studio ? [{ membershipId: r.membershipId, studio, hours: r.availableHours }] : [];
  });
}

export type UpcomingBooking = { bookingId: string; studio: StudioId; date: string; start: number; end: number; status: string };

export async function upcomingBookings(userId: string): Promise<UpcomingBooking[]> {
  const prisma = db();
  if (!prisma) return [];
  const rows = await prisma.bookings.findMany({
    where: { userId, date: { gte: dateInt(torontoNow().date) }, status: { in: ["pending", "success"] } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  return rows.flatMap((r) => {
    const studio = studioOfRoom(r.roomId);
    return studio
      ? [{ bookingId: r.bookingId, studio, date: isoOfDateInt(r.date), start: hourOf(r.startTime), end: hourOf(r.endTime) + 1, status: r.status }]
      : [];
  });
}

/** A pending membership purchase; the webhook activates it once paid. */
export async function createPendingMembership(userId: string, studio: StudioId, hours: MembershipHours) {
  const prisma = db();
  if (!prisma) throw new Error("Database not configured");
  const today = dateInt(torontoNow().date);
  return prisma.memberships.create({
    data: {
      membershipId: newId(),
      stripeSessionId: "",
      stripeMembershipId: "",
      interval: "month", // nominal, as on the old site: these are one-off bundles, nothing renews
      status: "pending",
      planId: `v2_${hours}h`,
      currentPeriodStart: today,
      currentPeriodEnd: today,
      roomId: roomId(studio),
      availableHours: hours,
      userId,
    },
  });
}
