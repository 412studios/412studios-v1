import "server-only";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// The studio's existing Postgres (Supabase), shared with the old site during the switch.
// Everything that touches it degrades gracefully when DATABASE_URL is missing, so the
// marketing pages and the booking UI still render on a machine with no database.

const g = globalThis as unknown as { prisma?: PrismaClient };

export const dbConfigured = () => !!process.env.DATABASE_URL;

export function db(): PrismaClient | null {
  if (!dbConfigured()) return null;
  if (!g.prisma) {
    g.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  }
  return g.prisma;
}
