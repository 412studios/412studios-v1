import type Stripe from "stripe";
import { stripe } from "@/lib/bookings";
import { db } from "@/lib/db";
import { activateMembershipPayment, fulfillBookingPayment } from "@/lib/fulfillment";

// Stripe → us. The only place a booking or membership becomes paid.
// Stripe dashboard: point the endpoint at /api/webhook/stripe, event checkout.session.completed.

export async function POST(req: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return new Response("Webhook not configured", { status: 503 });

  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(body, signature, secret);
  } catch (e) {
    return new Response(`Webhook Error: ${e instanceof Error ? e.message : "bad signature"}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const id = session.metadata?.bookingId;
      if (!id) {
        console.error("Stripe webhook: checkout.session.completed without a bookingId");
      } else {
        const prisma = db();
        const booking = await prisma?.bookings.findUnique({ where: { bookingId: id }, select: { bookingId: true } });
        if (booking) await fulfillBookingPayment(id);
        else {
          const membership = await prisma?.memberships.findUnique({ where: { membershipId: id }, select: { membershipId: true } });
          if (membership) await activateMembershipPayment(id);
          else console.error(`Stripe webhook: no booking or membership ${id}`);
        }
      }
    }
  } catch (e) {
    console.error(`Stripe webhook: ${event.type} failed`, e);
    return new Response("Webhook handler error", { status: 500 }); // Stripe retries; handlers are idempotent
  }

  return Response.json({ received: true });
}
