import { defineConfig } from "prisma/config";

// `prisma generate` must work without a database (CI, a fresh checkout), so fall back to a
// placeholder instead of Prisma's strict env() helper. Real commands need DATABASE_URL set.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://unset:unset@localhost:5432/unset" },
});
