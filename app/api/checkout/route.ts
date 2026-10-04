import { HOLD_MINUTES, bookedHours, stripe } from "@/lib/bookings";
import {
  CLOSE_HOUR,
  ENGINEER_FEE_PER_HOUR,
  OPEN_HOUR,
  dateLabel,
  getStudio,
  hourLabel,
  hourlyTotal,
  torontoNow,
} from "@/lib/studios";

type Body =
  | { type: "membership"; studio: string; hours: number }
  | { type: "hourly"; studio: string; date: string; start: number; end: number; engineer?: boolean };

const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const s = stripe();
  if (!s) return bad("Payments are not configured yet (missing STRIPE_SECRET_KEY).", 503);

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

  let name: string;
  let description: string | undefined;
  let amount: number;
  let metadata: Record<string, string>;

  if (body.type === "membership") {
    if (body.hours !== 8 && body.hours !== 16) return bad("Invalid membership");
    amount = studio.memberships[body.hours];
    name = `${studio.name} — ${body.hours}hr membership`;
    metadata = { type: "membership", studio: studio.id, hours: String(body.hours) };
  } else if (body.type === "hourly") {
    const { date, start, end } = body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad("Invalid date");
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < OPEN_HOUR || end > CLOSE_HOUR || end <= start)
      return bad("Invalid time range");

    const now = torontoNow();
    if (date < now.date || (date === now.date && start <= now.hour)) return bad("That time has already passed");

    const taken = await bookedHours(studio.id, date);
    if (taken.some((h) => h >= start && h < end))
      return bad("Someone just booked part of that time. Pick another slot.", 409);

    const hours = end - start;
    const engineer = !!body.engineer;
    amount = hourlyTotal(studio, hours, engineer);
    name = `${studio.name} — ${hours}hr session`;
    description = `${dateLabel(date, { weekday: "short", month: "short", day: "numeric" })}, ${hourLabel(start)}–${hourLabel(end)}${
      engineer ? ` (incl. engineer $${ENGINEER_FEE_PER_HOUR}/hr)` : ""
    }`;
    metadata = {
      type: "hourly",
      studio: studio.id,
      date,
      start: String(start),
      end: String(end),
      engineer: String(engineer),
    };
  } else {
    return bad("Unknown booking type");
  }

  const session = await s.checkout.sessions.create({
    mode: "payment",
    // Guest checkout: Stripe collects email (and phone, so the studio can reach you). No account.
    phone_number_collection: { enabled: true },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: amount * 100,
          product_data: { name, ...(description ? { description } : {}) },
        },
      },
    ],
    allow_promotion_codes: true, // replaces the "Have an offer code?" field
    metadata,
    // Copied onto the payment so paid bookings are searchable (see lib/bookings.ts).
    payment_intent_data: { metadata, description: description ? `${name}, ${description}` : name },
    expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60,
    success_url: `${origin}/book/success?type=${body.type}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/book${body.type === "membership" ? "?plan=membership" : ""}`,
  });

  return Response.json({ url: session.url });
}
