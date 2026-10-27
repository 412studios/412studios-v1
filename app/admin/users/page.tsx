import Link from "next/link";
import { listUsers } from "@/lib/admin";
import { getStudio } from "@/lib/studios";

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const users = await listUsers(q || undefined);

  return (
    <div>
      <form className="flex flex-wrap items-end gap-2" action="/admin/users">
        <input name="q" type="search" placeholder="Name or email" defaultValue={q} aria-label="Search users" className="min-h-10 w-64 rounded-lg border-2 border-ink bg-white px-3 text-sm font-semibold" />
        <button className="btn !min-h-10 !px-4 !text-xs" type="submit">Search</button>
      </form>
      <p className="mt-4 text-sm text-neutral-600">{users.length} {q ? `matching “${q}”` : "users"}{users.length === 500 ? " (first 500; search to narrow)" : ""}.</p>
      <div className="-mx-4 mt-4 overflow-x-auto px-4">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-left text-xs uppercase tracking-wide">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Memberships</th>
              <th className="py-2 pr-3">Bookings</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const live = u.memberships.filter((m) => m.status === "active" || (m.status === "cancelled" && m.hours > 0));
              return (
                <tr key={u.id} className="border-b border-line">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/users/${encodeURIComponent(u.id)}`} className="font-bold hover:underline">{u.name ?? "No name"}</Link>
                    {u.id.startsWith("guest_") && <span className="ml-2 text-[11px] font-bold uppercase text-neutral-500">guest</span>}
                  </td>
                  <td className="py-2 pr-3">{u.email}</td>
                  <td className="py-2 pr-3">{u.role}</td>
                  <td className="py-2 pr-3">
                    {live.length ? live.map((m) => `${getStudio(m.studio)?.name.replace("Studio ", "")}: ${m.hours}h`).join(" · ") : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="py-2 pr-3">{u.bookings}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!users.length && <p className="py-10 text-center text-neutral-600">Nobody matches.</p>}
      </div>
    </div>
  );
}
