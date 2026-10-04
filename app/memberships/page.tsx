import type { Metadata } from "next";
import Link from "next/link";
import MembershipCards from "@/components/MembershipCards";
import { bestSavings } from "@/lib/studios";

export const metadata: Metadata = { title: "Memberships — 412 Studios" };

export default function MembershipsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <p className="text-sm font-black uppercase tracking-wide">Save up to {bestSavings()}%</p>
      <h1 className="display mt-2 text-5xl sm:text-7xl">Memberships</h1>
      <p className="mb-8 mt-3 max-w-xl text-lg">
        Prepay 8 or 16 hours at a lower hourly rate, then use them across as many sessions as you like. Pick your studio, pay
        securely, and you&rsquo;re in. No account, no back-and-forth.
      </p>
      <MembershipCards />
      <p className="mt-8 text-sm">
        Just need one session? <Link href="/book" className="font-bold underline">Book by the hour</Link>.
      </p>
    </div>
  );
}
