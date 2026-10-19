import { db } from "@/lib/db";

// Stripe's cancel URL. Frees this one pending row right away instead of waiting out the hold.
// Ids are 32 random hex chars, so this can't be used to release someone else's slot.
export async function GET(req: Request, { params }: RouteContext<"/book/cancel/[id]">) {
  const { id } = await params;
  const prisma = db();
  let plan = "";
  if (prisma && /^[0-9a-f]{32}$/.test(id)) {
    const [b, m] = await Promise.all([
      prisma.bookings.deleteMany({ where: { bookingId: id, status: "pending" } }),
      prisma.memberships.deleteMany({ where: { membershipId: id, status: "pending" } }),
    ]);
    if (!b.count && m.count) plan = "?plan=membership";
  }
  return Response.redirect(new URL(`/book${plan}`, process.env.NEXT_PUBLIC_SITE_URL ?? req.url), 303);
}
