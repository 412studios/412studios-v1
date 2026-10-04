import "server-only";
import Stripe from "stripe";

// Stripe is the booking ledger: every hourly checkout carries studio/date/start/end
// metadata, so "what's taken" = paid sessions + checkouts still in progress.
// No database to run. Move to a real DB if volume ever outgrows this.

export const HOLD_MINUTES = 30; // Stripe's minimum Checkout expiry; holds the slot while someone pays

let client: Stripe | null = null;
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return (client ??= new Stripe(key));
}

type Meta = Stripe.Metadata | null | undefined;

function hoursOf(meta: Meta, studio: string, date: string) {
  if (!meta || meta.type !== "hourly" || meta.studio !== studio || meta.date !== date) return [];
  const start = Number(meta.start);
  const end = Number(meta.end);
  return Array.from({ length: Math.max(0, end - start) }, (_, k) => start + k);
}

/** Hours (e.g. 14 = 2pm–3pm) already paid for or held in an open checkout. */
export async function bookedHours(studio: string, date: string): Promise<number[]> {
  const s = stripe();
  if (!s) return [];

  const taken = new Set<number>();

  // Paid bookings. Search is indexed with up to ~1 min lag, covered by the session scan below.
  const paid = await s.paymentIntents.search({
    query: `status:"succeeded" AND metadata["type"]:"hourly" AND metadata["studio"]:"${studio}" AND metadata["date"]:"${date}"`,
    limit: 100,
  });
  for (const pi of paid.data) hoursOf(pi.metadata, studio, date).forEach((h) => taken.add(h));

  // Checkouts created recently: open ones are holds, complete ones may not be searchable yet.
  const since = Math.floor(Date.now() / 1000) - 60 * 60;
  for await (const cs of s.checkout.sessions.list({ created: { gte: since }, limit: 100 })) {
    if (cs.status === "expired") continue;
    if (cs.status === "complete" && cs.payment_status !== "paid") continue;
    hoursOf(cs.metadata, studio, date).forEach((h) => taken.add(h));
  }

  return [...taken].sort((a, b) => a - b);
}
