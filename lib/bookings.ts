import "server-only";
import Stripe from "stripe";
import { db } from "./db";
import { dateInt, hourOf, newId, roomId, slotOf } from "./legacy";
import type { StudioId } from "./studios";

// The Bookings table is the ledger. A pending row is created before Stripe Checkout opens and
// holds its slots for HOLD_MINUTES; the webhook flips it to "success" once paid, and the
// cleanup cron deletes stale pending rows (app/api/cron/cleanup).

export const HOLD_MINUTES = 15;

let client: Stripe | null = null;
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return (client ??= new Stripe(key));
}

const holdCutoff = () => new Date(Date.now() - HOLD_MINUTES * 60_000);

/** Rows that currently block slots: paid bookings, plus pending ones still inside their hold. */
const blocking = (room: number, date: number) => ({
  roomId: room,
  date,
  OR: [{ status: "success" }, { status: "pending", createdAt: { gte: holdCutoff() } }],
});

/** Hours (e.g. 14 = 2pm–3pm) already booked or held for a studio on a date. */
export async function bookedHours(studio: StudioId, date: string): Promise<number[]> {
  const prisma = db();
  if (!prisma) return [];
  const rows = await prisma.bookings.findMany({
    where: blocking(roomId(studio), dateInt(date)),
    select: { startTime: true, endTime: true },
  });
  const taken = new Set<number>();
  for (const r of rows) for (let s = r.startTime; s <= r.endTime; s++) taken.add(hourOf(s));
  return [...taken].sort((a, b) => a - b);
}

export class SlotTakenError extends Error {
  constructor() {
    super("Someone just booked part of that time. Pick another slot.");
  }
}

export type NewBooking = {
  studio: StudioId;
  date: string;
  start: number; // first hour, inclusive
  end: number; // last hour, exclusive (8–10am is start 8, end 10)
  engineer: boolean;
  userId: string;
  price: number; // pre-tax CAD
  type: "hour" | "membership";
};

/**
 * Inserts a pending booking after a server-side overlap check. The advisory lock makes
 * the check-then-insert atomic per studio and day, which the old site never had.
 */
export async function createPendingBooking(b: NewBooking) {
  const prisma = db();
  if (!prisma) throw new Error("Database not configured");
  const room = roomId(b.studio);
  const date = dateInt(b.date);
  const startSlot = slotOf(b.start);
  const endSlot = slotOf(b.end) - 1;
  const hours = b.end - b.start;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(CAST(${room * 100_000_000 + date} AS bigint))`;
    const clash = await tx.bookings.count({
      where: { ...blocking(room, date), startTime: { lte: endSlot }, endTime: { gte: startSlot } },
    });
    if (clash) throw new SlotTakenError();
    return tx.bookings.create({
      data: {
        bookingId: newId(),
        roomId: room,
        date,
        type: b.type,
        startTime: startSlot,
        endTime: endSlot,
        status: "pending",
        userId: b.userId,
        stripeProductId: b.type === "membership" ? "none" : (process.env.STRIPE_PRICE_ID_STANDARD_BOOKING ?? "site-v2"),
        totalHours: hours,
        totalPrice: b.price,
        engineerTotal: b.engineer ? hours : -1,
        engineerStart: b.engineer ? startSlot : -1,
        engineerStatus: "pending",
        addDetails: "",
      },
    });
  });
}

/** Removes stale pending rows so their slots open up again. Used by the cron and safe to call often. */
export async function releaseExpiredHolds() {
  const prisma = db();
  if (!prisma) return { bookings: 0, memberships: 0 };
  const where = { status: "pending", createdAt: { lt: holdCutoff() } };
  const [b, m] = await Promise.all([prisma.bookings.deleteMany({ where }), prisma.memberships.deleteMany({ where })]);
  return { bookings: b.count, memberships: m.count };
}
