import "server-only";
import { db } from "./db";
import { dateInt } from "./legacy";
import { torontoNow } from "./studios";

// Only the verified Stripe webhook may call these. Each one claims its row with a conditional
// update, so a retried event never double-credits or double-debits. Ported from the old site.

export async function fulfillBookingPayment(bookingId: string) {
  const prisma = db();
  if (!prisma) return;
  const claim = await prisma.bookings.updateMany({
    where: { bookingId, status: { not: "success" } },
    data: { status: "success", engineerStatus: "success" },
  });
  if (!claim.count) return; // already done, or unknown id

  const booking = await prisma.bookings.findUnique({ where: { bookingId } });
  if (!booking) return;

  // A member session paid for only its engineer: now draw the hours down.
  if (booking.type === "membership") {
    const hours = booking.endTime - booking.startTime + 1;
    const membership = await prisma.memberships.findFirst({
      where: { userId: booking.userId, roomId: booking.roomId, OR: [{ status: "active" }, { status: "cancelled", availableHours: { gt: 0 } }] },
      orderBy: { createdAt: "asc" },
    });
    if (membership) {
      await prisma.memberships.update({ where: { membershipId: membership.membershipId }, data: { availableHours: { decrement: hours } } });
    }
  }

  // TODO: Google Calendar event (store id in addDetails) and confirmation email.
  // Both exist in the old repo (lib/calendar.ts, lib/email.ts) and port almost verbatim.
}

export async function activateMembershipPayment(membershipId: string) {
  const prisma = db();
  if (!prisma) return;
  const [y, m] = torontoNow().date.split("-").map(Number);
  const first = (yy: number, mm: number) => dateInt(`${yy}-${String(mm).padStart(2, "0")}-01`);
  const next = m === 12 ? first(y + 1, 1) : first(y, m + 1);
  await prisma.memberships.updateMany({
    where: { membershipId, status: { not: "active" } },
    data: { status: "active", currentPeriodStart: first(y, m), currentPeriodEnd: next },
  });
  // TODO: membership confirmation email.
}
