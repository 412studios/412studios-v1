import { bookedHours, stripe } from "@/lib/bookings";
import { getStudio } from "@/lib/studios";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const studio = url.searchParams.get("studio") ?? "";
  const date = url.searchParams.get("date") ?? "";
  if (!getStudio(studio) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "Invalid studio or date" }, { status: 400 });
  }

  try {
    const booked = await bookedHours(studio, date);
    return Response.json({ booked, live: !!stripe() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Never block booking on a lookup hiccup; checkout re-checks before taking payment.
    return Response.json({ booked: [], live: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
