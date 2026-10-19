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
