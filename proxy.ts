import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";
import { NextResponse, type NextRequest } from "next/server";

// Members-only pages: send logged-out visitors to Kinde, then back to the page they wanted.
// Also refreshes expired tokens, which server components can't do on their own.
export default async function proxy(req: NextRequest) {
  if (!process.env.KINDE_ISSUER_URL) return NextResponse.next(); // auth not configured: let the page explain
  return withAuth(req, { isReturnToCurrentPage: true });
}

export const config = { matcher: ["/account/:path*"] };
