import Link from "next/link";
import BookingTable from "@/components/admin/BookingTable";
import { listBookings, listUserRefs } from "@/lib/admin";
import { studios, type StudioId } from "@/lib/studios";

const field = "min-h-10 rounded-lg border-2 border-ink bg-white px-3 text-sm font-semibold";

export default async function AdminBookings({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const past = sp.past === "1";
  const studio = studios.find((s) => s.id === sp.studio)?.id as StudioId | undefined;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const [bookings, users] = await Promise.all([listBookings({ past, studio, q }), listUserRefs()]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <form className="flex flex-wrap items-end gap-2" action="/admin">
          <select name="studio" aria-label="Studio" defaultValue={studio ?? ""} className={field}>
            <option value="">All studios</option>
            {studios.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input name="q" type="search" placeholder="Name or email" defaultValue={q} aria-label="Search by name or email" className={`${field} w-56`} />
          <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="past" value="1" aria-label="Show past bookings" defaultChecked={past} className="h-4 w-4 accent-black" />
            Past bookings
          </label>
          <button className="btn !min-h-10 !px-4 !text-xs" type="submit">Filter</button>
        </form>
        <Link href="/admin/bookings/new" className="btn btn-primary !min-h-10 !px-4 !text-xs">
          New booking
        </Link>
      </div>
      <p className="mt-4 text-sm text-neutral-600">
        {past ? `Most recent ${bookings.length} past bookings` : `${bookings.length} upcoming`}
        {studio ? ` in ${studios.find((s) => s.id === studio)?.name}` : ""}
        {q ? ` matching “${q}”` : ""}. Times are Toronto time.
      </p>
      <div className="mt-4">
        <BookingTable bookings={bookings} users={users} />
      </div>
    </div>
  );
}
