import Link from "next/link";
import { notFound } from "next/navigation";
import BookingTable from "@/components/admin/BookingTable";
import UserMemberships from "@/components/admin/UserMemberships";
import { getUser, listUserRefs } from "@/lib/admin";

export default async function AdminUser({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const [user, users] = await Promise.all([getUser(decodeURIComponent(id)), listUserRefs()]);
  if (!user) notFound();

  return (
    <div>
      <Link href="/admin/users" className="text-sm font-bold underline">← All users</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display text-4xl">{user.name ?? "No name"}</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {user.email}
            {user.phone ? ` · ${user.phone}` : ""} · {user.role}
            {user.id.startsWith("guest_") ? " · guest (never logged in)" : ""}
          </p>
        </div>
        <Link href={`/admin/bookings/new?user=${encodeURIComponent(user.id)}`} className="btn btn-primary !min-h-10 !px-4 !text-xs">
          Book for {user.name?.split(" ")[0] ?? "them"}
        </Link>
      </div>

      <section className="mt-8">
        <h3 className="text-sm font-bold uppercase tracking-wide">Memberships</h3>
        <div className="mt-3">
          <UserMemberships userId={user.id} memberships={user.memberships} />
        </div>
      </section>

      <section className="mt-10">
        <h3 className="text-sm font-bold uppercase tracking-wide">Bookings ({user.bookings})</h3>
        <div className="mt-3">
          <BookingTable bookings={user.history} users={users} showUser={false} />
        </div>
      </section>
    </div>
  );
}
