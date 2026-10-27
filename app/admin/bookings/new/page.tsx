import NewBookingForm from "@/components/admin/NewBookingForm";
import { listUserRefs } from "@/lib/admin";
import { loadStudios } from "@/lib/pricing";

export default async function NewBooking({ searchParams }: PageProps<"/admin/bookings/new">) {
  const { user } = await searchParams;
  const [users, studios] = await Promise.all([listUserRefs(), loadStudios()]);
  return (
    <div>
      <h2 className="display text-3xl">New booking</h2>
      <p className="mb-6 mt-1 text-sm text-neutral-600">No payment is taken; the slot is confirmed straight away. The same overlap check as the public booking page applies.</p>
      <NewBookingForm users={users} studios={studios} initialUser={typeof user === "string" ? user : undefined} />
    </div>
  );
}
