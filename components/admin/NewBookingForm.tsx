"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorText, TimeRange, field, useRun } from "./ui";
import { createBookingAction } from "@/app/admin/actions";
import type { AdminUserRef } from "@/lib/admin-shared";
import { hourlyTotal, money, torontoNow, type Studio } from "@/lib/studios";

export default function NewBookingForm({ users, studios, initialUser }: { users: AdminUserRef[]; studios: Studio[]; initialUser?: string }) {
  const router = useRouter();
  const { pending, error, run } = useRun();
  const [filter, setFilter] = useState("");
  const [userId, setUserId] = useState(initialUser ?? "");
  const [studioId, setStudioId] = useState(studios[0].id);
  const [date, setDate] = useState(torontoNow().date);
  const [range, setRange] = useState<[number, number]>([10, 12]);
  const [engineer, setEngineer] = useState(false);
  const [fromHours, setFromHours] = useState(false);

  const needle = filter.trim().toLowerCase();
  const shown = users.filter((u) => !needle || u.name?.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle) || u.id === userId);
  const studio = studios.find((s) => s.id === studioId)!;
  const hours = range[1] - range[0];
  const price = fromHours ? 0 : hourlyTotal(studio, hours, engineer);

  return (
    <form
      className="grid max-w-2xl gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => createBookingAction({ userId, studio: studioId, date, start: range[0], end: range[1], engineer, type: fromHours ? "membership" : "hour" }),
          () => router.push("/admin"),
        );
      }}
    >
      <label className="grid gap-1 text-sm font-semibold">
        Customer
        <input type="search" placeholder="Filter by name or email" value={filter} onChange={(e) => setFilter(e.target.value)} className={field} aria-label="Filter customers" />
        <select required value={userId} onChange={(e) => setUserId(e.target.value)} className={field} size={Math.min(6, Math.max(2, shown.length))}>
          {shown.map((u) => (
            <option key={u.id} value={u.id}>{u.name ? `${u.name} · ${u.email}` : u.email}</option>
          ))}
        </select>
        <span className="text-xs font-normal text-neutral-600">Only people who have logged in or paid once are listed. Someone new can be added by booking from the public site.</span>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">
          Studio
          <select value={studioId} onChange={(e) => setStudioId(e.target.value as Studio["id"])} className={field}>
            {studios.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.available ? "" : " (unavailable to the public)"}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Date
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
      </div>

      <div className="grid gap-1 text-sm font-semibold">
        Time
        <TimeRange start={range[0]} end={range[1]} onChange={(s, e) => setRange([s, e])} disabled={pending} />
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={engineer} onChange={(e) => setEngineer(e.target.checked)} className="h-4 w-4 accent-black" />
        In-house engineer for the whole session (+{money(studio.engineer)}/hr)
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={fromHours} onChange={(e) => setFromHours(e.target.checked)} className="h-4 w-4 accent-black" />
        Pay with the customer’s membership hours in {studio.name}
      </label>

      <div className="rounded-xl border-2 border-ink bg-white p-4 text-sm">
        <p>
          <strong>{hours} hr{hours === 1 ? "" : "s"}</strong> in {studio.name}, recorded as paid.{" "}
          {fromHours ? `${hours} hours come off the membership.` : `Price on record: ${money(price)} before HST (collected outside the site).`}
        </p>
      </div>

      <ErrorText>{error}</ErrorText>
      <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending || !userId}>
        {pending ? "Booking…" : "Book it"}
      </button>
    </form>
  );
}
