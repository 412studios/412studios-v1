import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";
import { NextResponse, type NextRequest } from "next/server";

// Members-only pages: send logged-out visitors to Kinde, then back to the page they wanted.
// Also refreshes expired tokens, which server components can't do on their own.
// /admin additionally needs the Kinde permission "admin" (the same flag the old site's /user/admin
// used); anyone logged in without it goes to the home page. Server actions re-check this themselves.
export default async function proxy(req: NextRequest) {
  if (!process.env.KINDE_ISSUER_URL) return NextResponse.next(); // auth not configured: let the page explain

  if (req.nextUrl.pathname.startsWith("/admin")) {
    let admin = false;
    const res = (await withAuth(req, {
      isReturnToCurrentPage: true,
      // Runs only once the visitor is logged in; the token's claims are the fresh ones after a refresh.
      isAuthorized: ({ token }: { token: { permissions?: string[] } }) => {
        admin = !!token.permissions?.includes("admin");
        return true;
      },
    })) as NextResponse;
    if (res.status >= 300 && res.status < 400) return res; // logged out: off to Kinde
    return admin ? res : NextResponse.redirect(new URL("/", req.url));
  }

  return withAuth(req, { isReturnToCurrentPage: true });
}

export const config = { matcher: ["/account/:path*", "/admin/:path*"] };
