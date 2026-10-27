"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/admin/actions";
import { CLOSE_HOUR, OPEN_HOUR, hourLabel } from "@/lib/studios";

// Small shared pieces for the admin's client components.

export const field = "min-h-10 rounded-lg border-2 border-ink bg-white px-3 text-sm font-semibold";
export const smallBtn = "btn !min-h-9 !px-3 !text-xs";

/** Runs a server action inside a transition so the page re-renders with the action's fresh data. */
export function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error);
      else after?.();
    });
  return { pending, error, run, clear: () => setError(null) };
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm font-semibold text-red-700">
      {children}
    </p>
  );
}

export const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, k) => OPEN_HOUR + k);

/** Start and end selects for a session, end exclusive (8am–10am is 8 and 10). */
export function TimeRange({
  start,
  end,
  onChange,
  disabled,
}: {
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <select aria-label="Start" className={field} value={start} disabled={disabled} onChange={(e) => {
        const s = Number(e.target.value);
        onChange(s, Math.max(end, s + 1));
      }}>
        {HOURS.map((h) => (
          <option key={h} value={h}>{hourLabel(h)}</option>
        ))}
      </select>
      <span className="text-sm">to</span>
      <select aria-label="End" className={field} value={end} disabled={disabled} onChange={(e) => onChange(start, Number(e.target.value))}>
        {HOURS.filter((h) => h > start).map((h) => (
          <option key={h + 1} value={h + 1}>{hourLabel(h + 1)}</option>
        ))}
      </select>
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "success" ? "bg-ink text-brand" : status === "cancelled" ? "border border-line text-neutral-500 line-through" : "bg-brand";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-black uppercase ${tone}`}>{status === "success" ? "paid" : status}</span>;
}
