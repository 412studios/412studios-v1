import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import { authConfigured, isAdmin } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";

export const metadata: Metadata = { title: "Admin — 412 Studios", robots: { index: false } };
export const dynamic = "force-dynamic"; // reads the login cookie and live bookings; never cache

// proxy.ts already turned non-admins away; this is the belt to its braces.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!(await isAdmin())) {
    if (!authConfigured()) {
      return (
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="display text-5xl">Logins aren’t switched on yet.</h1>
          <p className="mt-4 text-lg text-neutral-600">
            Add the KINDE_* variables to .env.local, or set ADMIN_DEV_BYPASS=1 to open the admin while developing.
          </p>
        </div>
      );
    }
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-600">412 Studios</p>
          <h1 className="display text-4xl">Admin</h1>
        </div>
        <AdminNav />
      </div>
      {!dbConfigured() && (
        <p className="mt-6 rounded-xl border-2 border-ink bg-brand p-4 text-sm font-semibold">
          No DATABASE_URL set: nothing to manage. Point it at a Postgres and restart the dev server.
        </p>
      )}
      <div className="mt-6">{children}</div>
      <p className="mt-12 text-xs text-neutral-500">
        Offer codes and the Google Calendar sync are not here yet; use the old admin for those. <Link href="/" className="underline">Back to the site</Link>.
      </p>
    </div>
  );
}
