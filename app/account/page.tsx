import type { Metadata } from "next";
import Link from "next/link";
import { LOGIN_URL, LOGOUT_URL, REGISTER_URL, authConfigured, currentMember } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { ensureUser, hourBalances, upcomingBookings } from "@/lib/members";
import { dateLabel, getStudio, hourLabel } from "@/lib/studios";

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
  const user = dbConfigured() ? await ensureUser(member) : null;
  const [balances, bookings] = user ? await Promise.all([hourBalances(user.id), upcomingBookings(user.id)]) : [[], []];
  const totalHours = balances.reduce((n, b) => n + Math.max(0, b.hours), 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-sm font-bold uppercase tracking-wide text-neutral-600">Your account</p>
      <h1 className="display mt-2 text-5xl">Hey {name}.</h1>
      {member.email && <p className="mt-2 text-neutral-600">{member.email}</p>}
      {!user && <p className="mt-4 text-sm text-neutral-600">Hours and bookings will show here once the database is connected.</p>}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <section className="border-2 border-ink p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide">Membership hours</h2>
          <p className="display mt-3 text-6xl">{totalHours}</p>
          <p className="mt-1 text-sm text-neutral-600">hours remaining</p>
          {balances.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm">
              {balances.map((b) => (
                <li key={b.membershipId} className="flex justify-between">
                  <span>{getStudio(b.studio)?.name}</span>
                  <span className="font-bold">{b.hours} hrs</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/book?plan=membership" className="btn btn-primary mt-6">{totalHours ? "Top up hours" : "Buy hours"}</Link>
        </section>

        <section className="border-2 border-ink p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide">Upcoming sessions</h2>
          {bookings.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {bookings.map((b) => (
                <li key={b.bookingId}>
                  <span className="font-bold">{getStudio(b.studio)?.name}</span> ·{" "}
                  {dateLabel(b.date, { weekday: "short", month: "short", day: "numeric" })}, {hourLabel(b.start)}–{hourLabel(b.end)}
                  {b.status === "pending" && <span className="ml-2 text-xs font-semibold uppercase text-neutral-600">awaiting payment</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-neutral-600">Nothing booked yet.</p>
          )}
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
