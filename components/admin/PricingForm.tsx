"use client";

import { useState } from "react";
import { ErrorText, field, useRun } from "./ui";
import { savePricingAction } from "@/app/admin/actions";
import type { PricingRow } from "@/lib/pricing";

type Col = { key: keyof Omit<PricingRow, "id" | "room" | "blocked">; label: string };
const cols: Col[] = [
  { key: "hourlyRate", label: "Hourly" },
  { key: "dayRate", label: "Day rate" },
  { key: "membershipPrice8", label: "8-hr membership" },
  { key: "membershipPrice", label: "16-hr membership" },
  { key: "engineerPrice", label: "Engineer / hr" },
];

/** One row per studio. `rows` is the table as saved (may be empty); `defaults` are the constants in lib/studios.ts. */
export default function PricingForm({ rows, defaults, names }: { rows: PricingRow[]; defaults: PricingRow[]; names: Record<string, string> }) {
  const { pending, error, run } = useRun();
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<PricingRow[]>(() => defaults.map((d) => rows.find((r) => r.id === d.id) ?? d));
  const set = (id: string, patch: Partial<PricingRow>) => {
    setSaved(false);
    setDraft((d) => d.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => savePricingAction(draft.map((r) => ({ id: r.id, hourlyRate: r.hourlyRate, dayRate: r.dayRate, membershipPrice: r.membershipPrice, membershipPrice8: r.membershipPrice8, engineerPrice: r.engineerPrice, blocked: r.blocked }))),
          () => setSaved(true),
        );
      }}
    >
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-left text-xs uppercase tracking-wide">
              <th className="py-2 pr-3">Studio</th>
              {cols.map((c) => (
                <th key={c.key} className="py-2 pr-3">{c.label}</th>
              ))}
              <th className="py-2">Blocked</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((r) => (
              <tr key={r.id} className="border-b border-line">
                <td className="py-2 pr-3 font-bold">{names[r.id] ?? `Studio ${r.room}`}</td>
                {cols.map((c) => (
                  <td key={c.key} className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1">
                      $
                      <input type="number" min={0} step={1} aria-label={`${names[r.id]} ${c.label}`} className={`${field} w-24`} value={r[c.key]} disabled={pending} onChange={(e) => set(r.id, { [c.key]: Number(e.target.value) })} />
                    </span>
                  </td>
                ))}
                <td className="py-2">
                  <input type="checkbox" aria-label={`${names[r.id]} blocked`} className="h-5 w-5 accent-black" checked={r.blocked} disabled={pending} onChange={(e) => set(r.id, { blocked: e.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary !min-h-10 !px-5 !text-xs" disabled={pending}>
          {pending ? "Saving…" : "Save prices"}
        </button>
        <button type="button" className="btn !min-h-10 !px-5 !text-xs" disabled={pending} onClick={() => { setSaved(false); setDraft(defaults); }}>
          Use site defaults
        </button>
        {saved && <span className="text-sm font-semibold">Saved. The public pages now show these prices.</span>}
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
