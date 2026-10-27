import type { Metadata } from "next";
import BookingFlow from "@/components/BookingFlow";
import { currentMember } from "@/lib/auth";
import { loadStudios } from "@/lib/pricing";

export const metadata: Metadata = { title: "Book a session or membership — 412 Studios" };

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const { plan, studio } = await searchParams;
  const [member, studios] = await Promise.all([currentMember(), loadStudios()]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <h1 className="display mb-6 text-5xl sm:text-7xl">Book time</h1>
      <BookingFlow
        // Remount when the header/footer links switch plans while already on /book.
        key={String(plan)}
        initialPlan={plan === "membership" ? "membership" : "hourly"}
        initialStudio={typeof studio === "string" ? studio : undefined}
        visitor={{ signedIn: !!member, email: member?.email ?? null }}
        studios={studios}
      />
    </div>
  );
}
