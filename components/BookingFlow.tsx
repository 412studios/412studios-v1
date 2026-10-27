"use client";

import { useEffect, useMemo, useState } from "react";
import BuyButton from "./BuyButton";
import MembershipCards from "./MembershipCards";
import Photo from "./Photo";
import {
  CLOSE_HOUR,
  OPEN_HOUR,
  bestSavings,
  dateLabel,
  hourLabel,
  hourlyTotal,
  money,
  nextDates,
  taxOn,
  torontoNow,
  type MembershipHours,
  type Studio,
  type StudioId,
} from "@/lib/studios";

export type Plan = "hourly" | "membership";

const slots = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, k) => OPEN_HOUR + k);

export type Visitor = { signedIn: boolean; email: string | null };

export default function BookingFlow({
  initialPlan,
  initialStudio,
  visitor,
  studios,
}: {
  initialPlan: Plan;
  initialStudio?: string;
  visitor: Visitor;
  studios: Studio[]; // current rates, read from the database by the page
}) {
  const [plan, setPlan] = useState<Plan>(initialPlan);

  // Keep the URL shareable (/book?plan=membership) without a navigation.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (plan === "membership") url.searchParams.set("plan", "membership");
    else url.searchParams.delete("plan");
    window.history.replaceState(null, "", url);
  }, [plan]);

  return (
    <div>
      <div role="tablist" aria-label="How do you want to book?" className="mb-8 grid grid-cols-2 rounded-2xl border-2 border-ink bg-white p-1 sm:inline-grid sm:w-auto">
        <Tab active={plan === "hourly"} onClick={() => setPlan("hourly")} title="Single session" sub="Pay by the hour" />
        <Tab active={plan === "membership"} onClick={() => setPlan("membership")} title="Membership" sub={`Save up to ${bestSavings(studios)}%`} />
      </div>

      {plan === "hourly" ? (
        <HourlyBooking studios={studios} initialStudio={initialStudio} visitor={visitor} onSwitchToMembership={() => setPlan("membership")} />
      ) : (
        <div>
          <p className="mb-6 max-w-xl text-lg">
            Prepay 8 or 16 hours at a lower rate, then book them online in 4-hour sessions whenever you like.
            {visitor.signedIn ? "" : " You’ll log in or create an account first, so the hours are tied to you."}
          </p>
          <MembershipCards studios={studios} />
        </div>
      )}
    </div>
  );
}

function Tab({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-14 rounded-xl px-5 py-2 text-left sm:min-w-56 ${active ? "bg-ink text-cream" : ""}`}
    >
      <span className="block text-sm font-black uppercase tracking-wide">{title}</span>
      <span className={`block text-xs font-semibold ${active ? "text-brand" : "text-neutral-600"}`}>{sub}</span>
    </button>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function HourlyBooking({
  studios,
  initialStudio,
  visitor,
  onSwitchToMembership,
}: {
  studios: Studio[];
  initialStudio?: string;
  visitor: Visitor;
  onSwitchToMembership: () => void;
}) {
  const firstOpen = studios.find((s) => s.available)!.id;
  const [studioId, setStudioId] = useState<StudioId>(
    studios.find((s) => s.id === initialStudio && s.available)?.id ?? firstOpen,
  );
  const [now, setNow] = useState(() => torontoNow());
  const days = useMemo(() => {
    // After the last bookable hour today, start the strip tomorrow.
    const all = nextDates(now.date, 22);
    return now.hour >= CLOSE_HOUR - 1 ? all.slice(1) : all.slice(0, 21);
  }, [now]);
  const [date, setDate] = useState(days[0]);
  // Tap a start hour, then an end hour. Tapping again starts over.
  const [range, setRange] = useState<[number, number] | null>(null);
  const [engineer, setEngineer] = useState(false);
  const [email, setEmail] = useState(visitor.email ?? "");
  const emailOk = visitor.signedIn || EMAIL.test(email.trim());
  // Availability is tagged with the studio/date it belongs to, so a stale response never shows.
  const [avail, setAvail] = useState<{ key: string; booked: number[] } | null>(null);
  const availKey = `${studioId}|${date}`;
  const loadingSlots = avail?.key !== availKey;
  const booked = loadingSlots ? [] : avail.booked;

  const studio = studios.find((s) => s.id === studioId)!;
  const hours = range ? range[1] - range[0] + 1 : 0;
  const subtotal = range ? hourlyTotal(studio, hours, engineer) : 0;
  const tax = taxOn(subtotal);
  const total = subtotal + tax;
  const isToday = date === now.date;

  useEffect(() => {
    const id = setInterval(() => setNow(torontoNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/availability?studio=${studioId}&date=${date}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setAvail({ key: `${studioId}|${date}`, booked: d.booked ?? [] }))
      .catch(() => !ctrl.signal.aborted && setAvail({ key: `${studioId}|${date}`, booked: [] }));
    return () => ctrl.abort();
  }, [studioId, date]);

  const unavailable = (h: number) => (isToday && h <= now.hour) || booked.includes(h);

  function tap(h: number) {
    if (range && range[0] === range[1] && h > range[0]) {
      // Extend only if every hour in between is free.
      const clear = Array.from({ length: h - range[0] }, (_, k) => range[0] + 1 + k).every((x) => !unavailable(x));
      setRange(clear ? [range[0], h] : [h, h]);
    } else {
      setRange([h, h]);
    }
  }

  const when = range ? `${dateLabel(date, { weekday: "short", month: "short", day: "numeric" })} · ${hourLabel(range[0])}–${hourLabel(range[1] + 1)}` : "";
  const payload = { type: "hourly", studio: studio.id, date, start: range?.[0], end: range ? range[1] + 1 : undefined, engineer, email: email.trim() };
  const ready = !!range && emailOk;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 pb-28 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0">
      <div className="min-w-0 space-y-10">
        <section aria-labelledby="s1">
          <Step id="s1" n={1} title="Pick a studio" />
          <div className="grid gap-3 sm:grid-cols-3">
            {studios.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={!s.available}
                aria-pressed={studioId === s.id}
                onClick={() => {
                  setStudioId(s.id);
                  setRange(null);
                }}
                className={`flex items-stretch overflow-hidden rounded-2xl border-2 border-ink text-left sm:flex-col ${
                  studioId === s.id ? "bg-brand ring-4 ring-ink/10" : "bg-white"
                } ${!s.available ? "opacity-45 grayscale" : ""}`}
              >
                <span className="relative block w-28 shrink-0 sm:aspect-[16/9] sm:w-full">
                  <Photo name={s.photo} alt="" sizes="(min-width: 640px) 33vw, 112px" className="absolute inset-0 h-full w-full" />
                </span>
                <span className="block p-4">
                  <span className="display block text-2xl">{s.name}</span>
                  <span className="mt-1 block text-sm font-semibold">
                    {s.available ? `${money(s.hourly)}/hr · ${money(s.day)}/day` : "Currently unavailable"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="s2">
          <Step id="s2" n={2} title="Pick a day" />
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {days.map((d) => {
              const sel = d === date;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => {
                    setDate(d);
                    setRange(null);
                  }}
                  className={`flex min-h-[76px] w-16 shrink-0 snap-start flex-col items-center justify-center rounded-xl border-2 border-ink ${
                    sel ? "bg-ink text-brand" : "bg-white"
                  }`}
                >
                  <span className="text-xs font-bold uppercase">{d === now.date ? "Today" : dateLabel(d, { weekday: "short" })}</span>
                  <span className="text-xl font-black">{Number(d.slice(8))}</span>
                  <span className="text-[10px] font-semibold uppercase">{dateLabel(d, { month: "short" })}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="s3">
          <Step id="s3" n={3} title="Pick your hours" />
          <p className="-mt-2 mb-3 text-sm text-neutral-600">
            {range && range[0] === range[1] ? "Now tap your last hour, or pay for just this one." : "Tap your first hour, then your last."}
          </p>
          <div className={`grid grid-cols-3 gap-2 sm:grid-cols-4 ${loadingSlots ? "animate-pulse" : ""}`} aria-busy={loadingSlots}>
            {slots.map((h) => {
              const off = unavailable(h);
              const taken = booked.includes(h);
              const inRange = range && h >= range[0] && h <= range[1];
              return (
                <button
                  key={h}
                  type="button"
                  disabled={off}
                  aria-pressed={!!inRange}
                  aria-label={`${hourLabel(h)} to ${hourLabel(h + 1)}${taken ? ", booked" : ""}`}
                  onClick={() => tap(h)}
                  className={`min-h-12 rounded-lg border-2 px-2 text-sm font-bold ${
                    inRange ? "border-ink bg-brand" : off ? "border-line bg-transparent text-neutral-400" : "border-ink bg-white"
                  } ${taken ? "slot-taken" : ""}`}
                >
                  {taken ? "Booked" : hourLabel(h)}
                </button>
              );
            })}
          </div>
          <label className="mt-5 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-ink bg-white px-4 text-sm font-semibold">
            <input type="checkbox" checked={engineer} onChange={(e) => setEngineer(e.target.checked)} className="h-5 w-5 accent-black" />
            Add an in-house engineer
            <span className="ml-auto font-bold">+{money(studio.engineer)}/hr</span>
          </label>
        </section>

        {!visitor.signedIn && (
          <section aria-labelledby="s4">
            <Step id="s4" n={4} title="Where to send your confirmation" />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email"
              className="min-h-12 w-full rounded-xl border-2 border-ink bg-white px-4 text-base sm:max-w-md"
            />
            <p className="mt-2 text-sm text-neutral-600">
              No account needed.{" "}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Kinde's login is a route handler; it needs a full navigation, not a client transition */}
              <a href="/api/auth/login?post_login_redirect_url=%2Fbook" className="font-bold underline">Members, log in</a> to use your hours.
            </p>
          </section>
        )}
      </div>

      {/* Desktop: sticky summary. Phones: the same info lives in the bottom pay bar. */}
      <aside className="h-fit space-y-4 lg:sticky lg:top-24">
        <div className="hidden rounded-2xl border-2 border-ink bg-white p-6 lg:block">
          <h2 className="display text-2xl">Your session</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row k="Studio" v={studio.name} />
            <Row k="When" v={range ? when : "Pick your hours"} />
            <Row k="Duration" v={`${hours} hr${hours === 1 ? "" : "s"}`} />
            {engineer && <Row k="Engineer" v={`${money(studio.engineer)}/hr`} />}
            <Row k="Subtotal" v={money(subtotal)} />
            <Row k="HST (13%)" v={money(tax, true)} />
          </dl>
          <p className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-sm font-bold uppercase">Total</span>
            <span className="display text-4xl not-italic">{money(total, true)}</span>
          </p>
          <div className="mt-5">
            <BuyButton disabled={!ready} payload={payload}>
              {!range ? "Pick your hours" : !emailOk ? "Enter your email" : `Pay ${money(total, true)} & book`}
            </BuyButton>
          </div>
          <p className="mt-3 text-xs text-neutral-600">Secure checkout by Stripe. Promo codes at checkout.</p>
        </div>

        <MembershipNudge studio={studio} hours={hours} sessionCost={range ? hourlyTotal(studio, hours, false) : 0} onSeeAll={onSwitchToMembership} />
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-cream px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-neutral-600">{range ? `${studio.name} · ${when}` : `${studio.name} · pick your hours`}</p>
            <p className="display text-2xl not-italic">
              {money(total, true)} <span className="text-xs font-semibold not-italic text-neutral-600">incl. HST</span>
            </p>
          </div>
          <div className="w-44 shrink-0">
            <BuyButton disabled={!ready} payload={payload}>
              {!range ? "Pick hours" : !emailOk ? "Add email" : "Pay & book"}
            </BuyButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Shows memberships at the moment of decision, priced against what they're about to pay. */
function MembershipNudge({
  studio,
  hours,
  sessionCost,
  onSeeAll,
}: {
  studio: Studio;
  hours: number;
  sessionCost: number;
  onSeeAll: () => void;
}) {
  const size: MembershipHours = hours > 8 ? 16 : 8; // compares pre-tax prices; HST applies to both
  const price = studio.memberships[size];
  const perHour = price / size;
  const extra = price - sessionCost;

  let headline: string;
  if (!hours) headline = `Booking ${studio.name} often? ${size} hours for ${money(price)}.`;
  else if (extra <= 0) headline = `A ${size}-hour membership costs less than this session.`;
  else headline = `For ${money(extra)} more, get ${size} hours instead of ${hours}.`;

  return (
    <div className="rounded-2xl border-2 border-ink bg-ink p-5 text-cream">
      <p className="text-xs font-black uppercase tracking-wide text-brand">Membership</p>
      <p className="mt-1 text-lg font-bold leading-snug">{headline}</p>
      <p className="mt-1 text-sm text-cream/75">
        {money(perHour, true)}/hr instead of {money(studio.hourly)}/hr, plus HST. Book your hours online any time.
      </p>
      <div className="mt-4 grid gap-2">
        <BuyButton payload={{ type: "membership", studio: studio.id, hours: size }} className="btn bg-brand text-ink hover:bg-cream">
          Get {size} hrs · {money(price)}
        </BuyButton>
        <button type="button" onClick={onSeeAll} className="min-h-11 text-sm font-bold underline">
          Compare all memberships
        </button>
      </div>
    </div>
  );
}

function Step({ id, n, title }: { id: string; n: number; title: string }) {
  return (
    <h2 id={id} className="mb-4 flex items-center gap-3 text-sm font-extrabold uppercase tracking-wide">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs text-brand">{n}</span>
      {title}
    </h2>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-600">{k}</dt>
      <dd className="text-right font-bold">{v}</dd>
    </div>
  );
}
