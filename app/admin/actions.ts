"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  BOOKING_STATUSES,
  bookFromMembership,
  cancelMembership,
  createAdminMembership,
  deleteBooking,
  reassignBooking,
  setBookingEngineer,
  setBookingStatus,
  setMembershipHours,
  updateBookingTimes,
  type BookingStatus,
} from "@/lib/admin";
import { createAdminBooking, SlotTakenError } from "@/lib/bookings";
import { loadStudios, savePricing, type PricingInput } from "@/lib/pricing";
import { getStudio, hourlyTotal, type StudioId } from "@/lib/studios";

// Every action re-checks the admin permission itself: the proxy gate only covers page loads,
// and an action is a POST anyone can send.

export type ActionResult = { ok: true } | { ok: false; error: string };

const ID = /^[A-Za-z0-9_:@.|-]{1,80}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STUDIOS: StudioId[] = ["a", "b", "c"];

async function guarded(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await requireAdmin();
    await fn();
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong";
    if (!(e instanceof SlotTakenError)) console.error("admin action failed:", e);
    return { ok: false, error: message };
  }
}

const studioOf = (s: unknown): StudioId => {
  if (!STUDIOS.includes(s as StudioId)) throw new Error("Unknown studio");
  return s as StudioId;
};
const idOf = (s: unknown) => {
  if (typeof s !== "string" || !ID.test(s)) throw new Error("Invalid id");
  return s;
};
const refresh = () => revalidatePath("/admin", "layout");

export async function updateBookingTimesAction(bookingId: string, start: number, end: number) {
  return guarded(async () => {
    await updateBookingTimes(idOf(bookingId), Number(start), Number(end));
    refresh();
  });
}

export async function setBookingStatusAction(bookingId: string, status: string) {
  return guarded(async () => {
    if (!BOOKING_STATUSES.includes(status as BookingStatus)) throw new Error("Unknown status");
    await setBookingStatus(idOf(bookingId), status as BookingStatus);
    refresh();
  });
}

export async function setBookingEngineerAction(bookingId: string, hours: number) {
  return guarded(async () => {
    await setBookingEngineer(idOf(bookingId), Number(hours));
    refresh();
  });
}

export async function reassignBookingAction(bookingId: string, userId: string) {
  return guarded(async () => {
    await reassignBooking(idOf(bookingId), idOf(userId));
    refresh();
  });
}

export async function deleteBookingAction(bookingId: string) {
  return guarded(async () => {
    await deleteBooking(idOf(bookingId));
    refresh();
  });
}

export type NewAdminBooking = { userId: string; studio: string; date: string; start: number; end: number; engineer: boolean; type: "hour" | "membership" };

/** Books a customer in directly, as paid: no Stripe, same overlap lock as the public flow. */
export async function createBookingAction(b: NewAdminBooking) {
  return guarded(async () => {
    const studio = getStudio(studioOf(b.studio), await loadStudios())!;
    if (!DATE.test(b.date)) throw new Error("Invalid date");
    const start = Number(b.start);
    const end = Number(b.end);
    const session = { studio: studio.id, date: b.date, start, end, engineer: !!b.engineer, userId: idOf(b.userId) };
    if (b.type === "membership") await bookFromMembership(session);
    else await createAdminBooking({ ...session, price: hourlyTotal(studio, end - start, !!b.engineer), type: "hour" });
    refresh();
  });
}

export async function createMembershipAction(userId: string, studio: string, hours: number) {
  return guarded(async () => {
    await createAdminMembership(idOf(userId), studioOf(studio), Number(hours));
    refresh();
  });
}

export async function setMembershipHoursAction(membershipId: string, hours: number) {
  return guarded(async () => {
    await setMembershipHours(idOf(membershipId), Number(hours));
    refresh();
  });
}

export async function cancelMembershipAction(membershipId: string) {
  return guarded(async () => {
    await cancelMembership(idOf(membershipId));
    refresh();
  });
}

export async function savePricingAction(rows: PricingInput[]) {
  return guarded(async () => {
    if (!Array.isArray(rows) || rows.length !== 3) throw new Error("Expected one row per studio");
    const clean = rows.map((r) => {
      if (!["0", "1", "2"].includes(r.id)) throw new Error("Unknown room");
      const num = (v: unknown, label: string) => {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n > 100_000) throw new Error(`${label} must be a whole number of dollars`);
        return n;
      };
      return {
        id: r.id,
        hourlyRate: num(r.hourlyRate, "Hourly rate"),
        dayRate: num(r.dayRate, "Day rate"),
        membershipPrice: num(r.membershipPrice, "16-hour membership"),
        membershipPrice8: num(r.membershipPrice8, "8-hour membership"),
        engineerPrice: num(r.engineerPrice, "Engineer fee"),
        blocked: !!r.blocked,
      };
    });
    await savePricing(clean);
    revalidatePath("/", "layout");
  });
}
