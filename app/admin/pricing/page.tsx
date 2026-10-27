import PricingForm from "@/components/admin/PricingForm";
import { readPricingRows, seedRow } from "@/lib/pricing";
import { studios } from "@/lib/studios";

export default async function AdminPricing() {
  const rows = await readPricingRows();
  const defaults = studios.map(seedRow);
  const names = Object.fromEntries(defaults.map((d, i) => [d.id, studios[i].name]));
  return (
    <div>
      <h2 className="display text-3xl">Pricing</h2>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-neutral-600">
        Whole dollars before HST. A blocked studio shows as “currently unavailable” and can’t be booked by the public (you can still book it here).
        {rows.length ? " These are the saved prices; the public site, the booking page and checkout all use them." : " Nothing is saved yet, so the site is using its built-in defaults shown here. Save to write them to the database."}
      </p>
      <PricingForm rows={rows} defaults={defaults} names={names} />
      <p className="mt-6 max-w-2xl text-xs text-neutral-500">
        “Use site defaults” fills in the prices from the owners’ Oct 2026 sheet (the site’s built-in values); nothing changes until you save. The old admin reads and writes this same table.
      </p>
    </div>
  );
}
