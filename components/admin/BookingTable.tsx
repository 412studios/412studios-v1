"use client";

import Link from "next/link";
import { useState } from "react";
import { ErrorText, StatusPill, TimeRange, field, smallBtn, useRun } from "./ui";
import {
  deleteBookingAction,
  reassignBookingAction,
  setBookingEngineerAction,
  setBookingStatusAction,
  updateBookingTimesAction,
} from "@/app/admin/actions";
import { BOOKING_STATUSES, type AdminBooking, type AdminUserRef } from "@/lib/admin-shared";
import { dateLabel, getStudio, hourLabel, money } from "@/lib/studios";

export default function BookingTable({ bookings, users, showUser = true }: { bookings: AdminBooking[]; users: AdminUserRef[]; showUser?: boolean }) {
  if (!bookings.length) return <p className="py-10 text-center text-neutral-600">No bookings here.</p>;
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-left text-xs uppercase tracking-wide">
            <th className="py-2 pr-3">Date</th>
            <th className="py-2 pr-3">Time</th>
            <th className="py-2 pr-3">Studio</th>
            {showUser && <th className="py-2 pr-3">Customer</th>}
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Engineer</th>
            <th className="py-2 pr-3">Price</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <Row key={b.bookingId} b={b} users={users} showUser={showUser} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ b, users, showUser }: { b: AdminBooking; users: AdminUserRef[]; showUser: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className={`border-b border-line ${b.status === "cancelled" ? "text-neutral-500" : ""}`}>
        <td className="py-2 pr-3 whitespace-nowrap">{dateLabel(b.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</td>
        <td className="py-2 pr-3 whitespace-nowrap">
          {hourLabel(b.start)}–{hourLabel(b.end)} <span className="text-neutral-500">({b.end - b.start}h)</span>
        </td>
        <td className="py-2 pr-3 whitespace-nowrap">{getStudio(b.studio)?.name}</td>
        {showUser && (
          <td className="py-2 pr-3">
            <Link href={`/admin/users/${encodeURIComponent(b.user.id)}`} className="font-bold hover:underline">
              {b.user.name ?? "No name"}
            </Link>
            <span className="block text-xs text-neutral-600">{b.user.email}</span>
          </td>
        )}
        <td className="py-2 pr-3">
          <StatusPill status={b.status} />
          {b.type === "membership" && <span className="ml-1 text-[11px] font-bold uppercase text-neutral-500">hours</span>}
        </td>
        <td className="py-2 pr-3">{b.engineerHours ? `${b.engineerHours}h` : "—"}</td>
        <td className="py-2 pr-3 whitespace-nowrap">{b.type === "membership" ? "prepaid" : money(b.price)}</td>
        <td className="py-2 text-right">
          <button type="button" className={`${smallBtn} ${open ? "bg-ink text-cream" : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : "Edit"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-line bg-white">
          <td colSpan={showUser ? 8 : 7} className="p-4">
            <Editor b={b} users={users} onDone={() => setOpen(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

function Editor({ b, users, onDone }: { b: AdminBooking; users: AdminUserRef[]; onDone: () => void }) {
  const { pending, error, run } = useRun();
  const [range, setRange] = useState<[number, number]>([b.start, b.end]);
  const [status, setStatus] = useState(b.status);
  const [engineer, setEngineer] = useState(b.engineerHours);
  const [userId, setUserId] = useState(b.user.id);
  const timesChanged = range[0] !== b.start || range[1] !== b.end;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Group label="Times">
        <TimeRange start={range[0]} end={range[1]} disabled={pending} onChange={(s, e) => setRange([s, e])} />
        <button type="button" className={`${smallBtn} btn-primary`} disabled={pending || !timesChanged} onClick={() => run(() => updateBookingTimesAction(b.bookingId, range[0], range[1]))}>
          Save times
        </button>
      </Group>

      <Group label="Status">
        <select aria-label="Status" className={field} value={status} disabled={pending} onChange={(e) => setStatus(e.target.value)}>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>{s === "success" ? "paid (success)" : s}</option>
          ))}
        </select>
        <button type="button" className={`${smallBtn} btn-primary`} disabled={pending || status === b.status} onClick={() => run(() => setBookingStatusAction(b.bookingId, status))}>
          Save status
        </button>
      </Group>

      <Group label="Engineer hours (0 = none)">
        <input type="number" aria-label="Engineer hours" min={0} max={b.end - b.start} className={`${field} w-24`} value={engineer} disabled={pending} onChange={(e) => setEngineer(Number(e.target.value))} />
        <button type="button" className={`${smallBtn} btn-primary`} disabled={pending || engineer === b.engineerHours} onClick={() => run(() => setBookingEngineerAction(b.bookingId, engineer))}>
          Save engineer
        </button>
      </Group>

      <Group label="Customer">
        <select aria-label="Customer" className={`${field} max-w-72`} value={userId} disabled={pending} onChange={(e) => setUserId(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name ? `${u.name} · ${u.email}` : u.email}</option>
          ))}
        </select>
        <button type="button" className={`${smallBtn} btn-primary`} disabled={pending || userId === b.user.id} onClick={() => run(() => reassignBookingAction(b.bookingId, userId))}>
          Reassign
        </button>
      </Group>

      <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
        <ErrorText>{error}</ErrorText>
        <button
          type="button"
          className={`${smallBtn} ml-auto border-red-700 text-red-700 hover:bg-red-700 hover:text-white`}
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this booking for good? Cancelling keeps a record; deleting doesn't.")) run(() => deleteBookingAction(b.bookingId), onDone);
          }}
        >
          Delete booking
        </button>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-600">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
