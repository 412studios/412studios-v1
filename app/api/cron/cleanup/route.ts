import { releaseExpiredHolds } from "@/lib/bookings";

// Vercel Cron (see vercel.json): frees slots held by checkouts that never paid.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await releaseExpiredHolds());
}
