"use client";

import { useState } from "react";
import { ErrorText, StatusPill, field, smallBtn, useRun } from "./ui";
import { cancelMembershipAction, createMembershipAction, setMembershipHoursAction } from "@/app/admin/actions";
import type { AdminMembership } from "@/lib/admin-shared";
import { TIMEZONE, getStudio, studios, type StudioId } from "@/lib/studios";

export default function UserMemberships({ userId, memberships }: { userId: string; memberships: AdminMembership[] }) {
  return (
    <div className="space-y-4">
      {memberships.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {memberships.map((m) => (
            <MembershipRow key={m.membershipId} m={m} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-600">No memberships.</p>
      )}
      <NewMembership userId={userId} />
    </div>
  );
}

function MembershipRow({ m }: { m: AdminMembership }) {
  const { pending, error, run } = useRun();
  const [hours, setHours] = useState(m.hours);
  const spendable = m.status === "active" || (m.status === "cancelled" && m.hours > 0);
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 text-sm">
      <div className="min-w-40">
        <p className="font-bold">{getStudio(m.studio)?.name}</p>
        <p className="text-xs text-neutral-600">
          {m.planId === "admin_created" ? "added by admin" : m.planId} · {new Date(m.createdAt).toLocaleDateString("en-CA", { timeZone: TIMEZONE, month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>
      <StatusPill status={m.status === "active" ? "success" : m.status} />
      {m.status === "pending" ? (
        <span className="text-xs text-neutral-600">awaiting payment</span>
      ) : (
        <>
          <label className="flex items-center gap-2">
            <input type="number" min={0} aria-label="Hours left" className={`${field} w-24`} value={hours} disabled={pending} onChange={(e) => setHours(Number(e.target.value))} />
            <span>hrs left</span>
          </label>
          <button type="button" className={`${smallBtn} btn-primary`} disabled={pending || hours === m.hours} onClick={() => run(() => setMembershipHoursAction(m.membershipId, hours))}>
            Save hours
          </button>
          {m.status === "active" && (
            <button
              type="button"
              className={smallBtn}
              disabled={pending}
              onClick={() => {
                if (confirm("Cancel this membership? Any hours left stay usable until they run out.")) run(() => cancelMembershipAction(m.membershipId));
              }}
            >
              Cancel
            </button>
          )}
          {!spendable && <span className="text-xs text-neutral-500">used up</span>}
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </li>
  );
}

function NewMembership({ userId }: { userId: string }) {
  const { pending, error, run } = useRun();
  const [studio, setStudio] = useState<StudioId>("a");
  const [hours, setHours] = useState(16);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createMembershipAction(userId, studio, hours));
      }}
    >
      <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-neutral-600">
        Add hours in
        <select value={studio} onChange={(e) => setStudio(e.target.value as StudioId)} className={`${field} normal-case tracking-normal`}>
          {studios.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-neutral-600">
        Hours
        <input type="number" min={1} max={200} value={hours} onChange={(e) => setHours(Number(e.target.value))} className={`${field} w-24`} />
      </label>
      <button type="submit" className={`${smallBtn} btn-primary`} disabled={pending}>
        {pending ? "Adding…" : "Add membership"}
      </button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
