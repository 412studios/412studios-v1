import { isAdmin } from "@/lib/auth";

/** Tells the header whether to show the Admin link. Reads the login cookie, so never cached. */
export async function GET() {
  return Response.json({ admin: await isAdmin() }, { headers: { "Cache-Control": "no-store" } });
}
