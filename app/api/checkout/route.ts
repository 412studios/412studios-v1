import { currentMember } from "@/lib/auth";
import { SlotTakenError, bookedHours, createPendingBooking, stripe } from "@/lib/bookings";
import { dbConfigured } from "@/lib/db";
import { createPendingMembership, ensureStripeCustomer, ensureUser, guestUser } from "@/lib/members";
import {
  CLOSE_HOUR,
  ENGINEER_FEE_PER_HOUR,
  OPEN_HOUR,
  TAX_RATE,
  chargeCents,
  dateLabel,
  getStudio,
  hourLabel,
  hourlyTotal,
  torontoNow,
} from "@/lib/studios";

type Body =
  | { type: "membership"; studio: string; hours: number }
  | { type: "hourly"; studio: string; date: string; start: number; end: number; engineer?: boolean; email?: string };

const bad = (error: string, status = 400) => Response.json({ error }, { status });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const s = stripe();
  if (!s) return bad("Payments are not configured yet (missing STRIPE_SECRET_KEY).", 503);
  if (!dbConfigured()) return bad("Bookings are not configured yet (missing DATABASE_URL).", 503);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request");
  }

  const studio = getStudio(body.studio);
  if (!studio) return bad("Unknown studio");
  if (!studio.available) return bad(`${studio.name} is currently unavailable`);

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const member = await currentMember();

  let id: string;
  let name: string;
  let description: string;
  let amount: number; // pre-tax CAD
  let user;

  if (body.type === "membership") {
    if (body.hours !== 8 && body.hours !== 16) return bad("Invalid membership");
    // Hours live on an account, so members log in (or sign up) first and come straight back here.
    if (!member) {
      return Response.json({ url: `/api/auth/login?post_login_redirect_url=${encodeURIComponent("/book?plan=membership")}` });
    }
    user = await ensureUser(member);
    if (!user) return bad("Could not load your account", 500);
    const membership = await createPendingMembership(user.id, studio.id, body.hours);
    id = membership.membershipId;
    amount = studio.memberships[body.hours];
    name = `${studio.name} — ${body.hours}hr membership`;
    description = `${body.hours} prepaid hours in ${studio.name}, incl. ${TAX_RATE * 100}% HST`;
  } else if (body.type === "hourly") {
    const { date, start, end } = body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad("Invalid date");
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < OPEN_HOUR || end > CLOSE_HOUR || end <= start)
      return bad("Invalid time range");

    const now = torontoNow();
    if (date < now.date || (date === now.date && start <= now.hour)) return bad("That time has already passed");

    const email = body.email?.trim().toLowerCase() ?? "";
    if (!member && !EMAIL.test(email)) return bad("Enter your email so we can send your confirmation");
    // Cheap pre-check so a taken slot doesn't leave a stray guest row behind; the insert re-checks under a lock.
    const taken = await bookedHours(studio.id, date);
    if (taken.some((h) => h >= start && h < end)) return bad(new SlotTakenError().message, 409);

    user = member ? await ensureUser(member) : await guestUser(email);
    if (!user) return bad("Could not load your account", 500);

    const hours = end - start;
    const engineer = !!body.engineer;
    amount = hourlyTotal(studio, hours, engineer);
    try {
      const booking = await createPendingBooking({ studio: studio.id, date, start, end, engineer, userId: user.id, price: amount, type: "hour" });
      id = booking.bookingId;
    } catch (e) {
      if (e instanceof SlotTakenError) return bad(e.message, 409);
      throw e;
    }
    name = `${studio.name} — ${hours}hr session`;
    description = `${dateLabel(date, { weekday: "short", month: "short", day: "numeric" })}, ${hourLabel(start)}–${hourLabel(end)}${
      engineer ? ` (incl. engineer $${ENGINEER_FEE_PER_HOUR}/hr)` : ""
    }, incl. ${TAX_RATE * 100}% HST`;
  } else {
    return bad("Unknown booking type");
  }

  const customer = await ensureStripeCustomer(user);
  const session = await s.checkout.sessions.create({
    mode: "payment",
    ...(customer ? { customer, customer_update: { name: "auto", address: "auto" } } : { customer_email: user.email }),
    phone_number_collection: { enabled: true },
    line_items: [
      {
        quantity: 1,
        price_data: { currency: "cad", unit_amount: chargeCents(amount), product_data: { name, description } },
      },
    ],
    allow_promotion_codes: true,
    // The webhook looks the row up by this id; bookings and memberships share the key, as on the old site.
    metadata: { bookingId: id, type: body.type },
    payment_intent_data: { description: `${name}, ${description}`, metadata: { bookingId: id, type: body.type } },
    success_url: `${origin}/book/success?type=${body.type}&id=${id}`,
    cancel_url: `${origin}/book/cancel/${id}`,
  });

  return Response.json({ url: session.url });
}
