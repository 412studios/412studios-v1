import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { db } from "./db";
import { roomId } from "./legacy";
import { studios as defaults, type Studio } from "./studios";

// The Pricing table is the old site's, one row per room (id "0"/"1"/"2" = Studio A/B/C), and the
// admin edits it at /admin/pricing. Public pages read it through loadStudios(), which lays the rows
// over the constants in lib/studios.ts; a field left at 0 means "use the site default", and an
// empty (or unreachable) table means the constants alone. Reads are cached until an admin saves.

export const PRICING_TAG = "pricing";

export type PricingRow = {
  id: string; // "0" | "1" | "2"
  room: string; // "A" | "B" | "C"
  hourlyRate: number;
  dayRate: number;
  membershipPrice: number; // 16 hours
  membershipPrice8: number;
  engineerPrice: number;
  blocked: boolean;
};

/** The table as it is right now, for the admin. */
export async function readPricingRows(): Promise<PricingRow[]> {
  const prisma = db();
  if (!prisma) return [];
  const rows = await prisma.pricing.findMany({ orderBy: { id: "asc" } });
  return rows.map(({ id, room, hourlyRate, dayRate, membershipPrice, membershipPrice8, engineerPrice, blocked }) => ({
    id, room, hourlyRate, dayRate, membershipPrice, membershipPrice8, engineerPrice, blocked,
  }));
}

/** What a studio's constants look like as a table row: the seed values, and the admin's "site defaults". */
export const seedRow = (s: Studio): PricingRow => ({
  id: String(roomId(s.id)),
  room: s.id.toUpperCase(),
  hourlyRate: s.hourly,
  dayRate: s.day,
  membershipPrice: s.memberships[16],
  membershipPrice8: s.memberships[8],
  engineerPrice: s.engineer,
  blocked: !s.available,
});

export function overlay(rows: PricingRow[]): Studio[] {
  return defaults.map((s) => {
    const r = rows.find((row) => row.id === String(roomId(s.id)));
    if (!r) return s;
    return {
      ...s,
      hourly: r.hourlyRate || s.hourly,
      day: r.dayRate || s.day,
      memberships: { 8: r.membershipPrice8 || s.memberships[8], 16: r.membershipPrice || s.memberships[16] },
      engineer: r.engineerPrice || s.engineer,
      available: !r.blocked,
    };
  });
}

const cachedRows = unstable_cache(
  async () => {
    const prisma = db();
    if (!prisma) return [];
    return readPricingRows(); // a thrown error is not cached, so a DB blip never pins the defaults
  },
  ["pricing-rows"],
  { tags: [PRICING_TAG], revalidate: 3600 },
);

/** The studios the public site prices from. Falls back to the constants when there is no table to read. */
export async function loadStudios(): Promise<Studio[]> {
  try {
    return overlay(await cachedRows());
  } catch (e) {
    console.error("pricing: could not read the Pricing table, using defaults", e);
    return defaults;
  }
}

export type PricingInput = Omit<PricingRow, "room">;

/** Writes the admin's rows (creating them on first save) and makes the public pages pick them up. */
export async function savePricing(rows: PricingInput[]) {
  const prisma = db();
  if (!prisma) throw new Error("Database not configured");
  await prisma.$transaction(
    rows.map((r) => {
      const letter = defaults.find((s) => String(roomId(s.id)) === r.id)?.id.toUpperCase() ?? r.id;
      const data = {
        hourlyRate: r.hourlyRate,
        dayRate: r.dayRate,
        membershipPrice: r.membershipPrice,
        membershipPrice8: r.membershipPrice8,
        engineerPrice: r.engineerPrice,
        blocked: r.blocked,
      };
      return prisma.pricing.upsert({ where: { id: r.id }, update: data, create: { id: r.id, room: letter, img: "", ...data } });
    }),
  );
  revalidateTag(PRICING_TAG, { expire: 0 });
}
