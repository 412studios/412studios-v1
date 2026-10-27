import type { Metadata } from "next";
import Link from "next/link";
import MembershipCards from "@/components/MembershipCards";
import { loadStudios } from "@/lib/pricing";
import { bestSavings } from "@/lib/studios";

export const metadata: Metadata = { title: "Memberships — 412 Studios" };

export default async function MembershipsPage() {
  const studios = await loadStudios();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <p className="text-sm font-black uppercase tracking-wide">Save up to {bestSavings(studios)}%</p>
      <h1 className="display mt-2 text-5xl sm:text-7xl">Memberships</h1>
      <p className="mb-8 mt-3 max-w-xl text-lg">
        Prepay 8 or 16 hours at a lower hourly rate, then book them online in 4-hour sessions whenever you like. Pick your
        studio, pay securely, and your hours are waiting in your account.
      </p>
      <MembershipCards studios={studios} />
      <p className="mt-8 text-sm">
        Just need one session? <Link href="/book" className="font-bold underline">Book by the hour</Link>.
      </p>
    </div>
  );
}
