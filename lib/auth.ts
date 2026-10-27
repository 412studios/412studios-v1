import "server-only";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

// Member logins run on Kinde. Locally, point these at a free Kinde dev environment;
// in production they point at the studio's existing tenant, so current members keep their accounts.

const REQUIRED = ["KINDE_ISSUER_URL", "KINDE_CLIENT_ID", "KINDE_CLIENT_SECRET", "KINDE_SITE_URL"] as const;

/** True once every Kinde variable is set. Everything auth-related degrades gracefully until then. */
export const authConfigured = () => REQUIRED.every((k) => !!process.env[k]);

export type Member = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

/** The signed-in member for this request, or null when logged out or auth isn't configured. */
export async function currentMember(): Promise<Member | null> {
  if (!authConfigured()) return null;
  const { isAuthenticated, getUser } = getKindeServerSession();
  if (!(await isAuthenticated())) return null;
  const u = await getUser();
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? null,
    firstName: u.given_name ?? null,
    lastName: u.family_name ?? null,
  };
}

export const LOGIN_URL = "/api/auth/login";
export const REGISTER_URL = "/api/auth/register";
export const LOGOUT_URL = "/api/auth/logout";

/**
 * True when the signed-in member holds the Kinde permission "admin", the flag the old site's
 * /user/admin used, so the same people stay admins. Locally, where there is no Kinde tenant,
 * ADMIN_DEV_BYPASS=1 opens the admin in `next dev` only (see .env.example).
 */
export async function isAdmin(): Promise<boolean> {
  if (process.env.NODE_ENV === "development" && process.env.ADMIN_DEV_BYPASS === "1") return true;
  if (!authConfigured()) return false;
  const { isAuthenticated, getPermission } = getKindeServerSession();
  if (!(await isAuthenticated())) return false;
  return !!(await getPermission("admin"))?.isGranted;
}

/** For server actions and route handlers that change data: throws unless the caller is an admin. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Admin access required");
}
