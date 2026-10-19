import { handleAuth } from "@kinde-oss/kinde-auth-nextjs/server";
import { authConfigured } from "@/lib/auth";

// /api/auth/login, /register, /logout, /kinde_callback — same paths the old site used,
// so members' bookmarks keep working. handleAuth() throws without its env vars, hence the guard.
export const GET = authConfigured()
  ? handleAuth()
  : () => Response.json({ error: "Login is not configured yet (missing KINDE_* env vars)." }, { status: 503 });
