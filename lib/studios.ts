// Default pricing, and the seed values for the Pricing table. The admin (/admin/pricing) writes
// that table and lib/pricing.ts lays its rows over these constants, so what follows is what the
// site charges only until an owner changes it there. The checkout API recomputes totals on the
// server, so the browser can never set its own price.
// Hourly and membership rates are from the owners' pricing sheet (Oct 2026), which lowered the
// live site's prices. Day rates are still the live site's; the sheet doesn't mention them.

export type StudioId = "a" | "b" | "c";
export type MembershipHours = 8 | 16;

export type Studio = {
  id: StudioId;
  name: string;
  hourly: number;
  day: number;
  memberships: Record<MembershipHours, number>;
  engineer: number; // per hour, on top of the room
  available: boolean;
  blurb: string;
  photo: string; // key into /public/photos and lib/blur
};

export const ENGINEER_FEE_PER_HOUR = 35;
export const TAX_RATE = 0.13; // Ontario HST. Added on top of every price below and baked into the Stripe charge.
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 24;
export const TIMEZONE = "America/Toronto";

export const studios: Studio[] = [
  {
    id: "a",
    name: "Studio A",
    hourly: 70,
    day: 500,
    memberships: { 8: 400, 16: 720 },
    engineer: ENGINEER_FEE_PER_HOUR,
    available: true,
    blurb: "The flagship suite. Control room, live room, lounge and kitchen.",
    photo: "studio-a",
  },
  {
    id: "b",
    name: "Studio B",
    hourly: 50,
    day: 400,
    memberships: { 8: 280, 16: 480 },
    engineer: ENGINEER_FEE_PER_HOUR,
    available: false, // matches "Currently Unavailable" on the live site
    blurb: "Piano, guitar amps and warm treated walls for writing and tracking.",
    photo: "studio-b",
  },
  {
    id: "c",
    name: "Studio C",
    hourly: 30,
    day: 250,
    memberships: { 8: 200, 16: 320 },
    engineer: ENGINEER_FEE_PER_HOUR,
    available: true,
    blurb: "Synth-stacked production room. Best value for beats and writing.",
    photo: "studio-c",
  },
];

export const getStudio = (id: string, list: Studio[] = studios) => list.find((s) => s.id === id);

export const money = (n: number, cents = false) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(n);

export const hourLabel = (h: number) => {
  const hh = h % 24;
  const suffix = hh >= 12 ? "pm" : "am";
  const n = hh % 12 === 0 ? 12 : hh % 12;
  return `${n}${suffix}`;
};

export function hourlyTotal(studio: Studio, hours: number, engineer: boolean) {
  const rate = Math.min(studio.hourly * hours, studio.day * Math.ceil(hours / 12));
  return rate + (engineer ? studio.engineer * hours : 0);
}

/** HST on a pre-tax dollar amount, to the cent. */
export const taxOn = (dollars: number) => Math.round(dollars * TAX_RATE * 100) / 100;
/** What Stripe actually charges, in cents, tax included. */
export const chargeCents = (dollars: number) => Math.round(dollars * 100 * (1 + TAX_RATE));

/** Percent saved vs paying the drop-in hourly rate for the same hours. */
export const membershipSavings = (s: Studio, h: MembershipHours) =>
  Math.round((1 - s.memberships[h] / (s.hourly * h)) * 100);

export const bestSavings = (list: Studio[] = studios) =>
  Math.max(...list.filter((s) => s.available).flatMap((s) => [membershipSavings(s, 8), membershipSavings(s, 16)]));

export const cheapestMembership = (list: Studio[] = studios) =>
  Math.min(...list.filter((s) => s.available).map((s) => s.memberships[8]));

/** The studio's wall clock, regardless of where the visitor's phone is. */
export function torontoNow(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** "2026-10-04" → the next n calendar dates starting there, as ISO strings. */
export function nextDates(start: string, n: number) {
  const [y, m, d] = start.split("-").map(Number);
  return Array.from({ length: n }, (_, k) => {
    const t = new Date(Date.UTC(y, m - 1, d + k));
    return t.toISOString().slice(0, 10);
  });
}

export const dateLabel = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-CA", { timeZone: "UTC", ...opts });
