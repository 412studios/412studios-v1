import type { Metadata } from "next";
import Link from "next/link";
import { LOGIN_URL, LOGOUT_URL, REGISTER_URL, authConfigured, currentMember } from "@/lib/auth";

export const metadata: Metadata = { title: "Your account — 412 Studios", robots: { index: false } };
export const dynamic = "force-dynamic"; // reads the login cookie; never cache a logged-out view


export default async function Account() {
  if (!authConfigured()) return <Notice title="Logins aren’t switched on yet." body="Add the KINDE_* variables from .env.example to .env.local and restart the dev server." />;

  const member = await currentMember();
  if (!member) {
    return (
      <Notice title="Log in to see your hours.">
        <a href={LOGIN_URL} className="btn btn-primary">Log in</a>
        <a href={REGISTER_URL} className="btn">Create an account</a>
      </Notice>
    );
  }

  const name = member.firstName ?? member.email ?? "there";

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-sm font-bold uppercase tracking-wide text-neutral-600">Your account</p>
      <h1 className="display mt-2 text-5xl">Hey {name}.</h1>
      {member.email && <p className="mt-2 text-neutral-600">{member.email}</p>}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <section className="border-2 border-ink p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide">Membership hours</h2>
          {/* TODO: read the member's balance from the hour ledger once it's connected. */}
          <p className="display mt-3 text-6xl">0</p>
          <p className="mt-1 text-sm text-neutral-600">hours remaining</p>
          <Link href="/book?plan=membership" className="btn btn-primary mt-6">Buy hours</Link>
        </section>

        <section className="border-2 border-ink p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide">Upcoming sessions</h2>
          {/* TODO: list bookings for this member once the bookings table is connected. */}
          <p className="mt-3 text-neutral-600">Nothing booked yet.</p>
          <Link href="/book" className="btn mt-6">Book a session</Link>
        </section>
      </div>

      <p className="mt-10 text-sm text-neutral-600">
        Questions about your membership? Email{" "}
        <a className="font-bold underline" href="mailto:Info@412studios.ca">Info@412studios.ca</a>.
      </p>
      <a href={LOGOUT_URL} className="mt-6 inline-block text-sm font-bold underline">Log out</a>
    </div>
  );
}

function Notice({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="display text-5xl">{title}</h1>
      {body && <p className="mt-4 text-lg text-neutral-600">{body}</p>}
      {children && <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
