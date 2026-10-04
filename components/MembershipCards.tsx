"use client";

import { useState } from "react";
import BuyButton from "./BuyButton";
import Photo from "./Photo";
import { membershipSavings, money, studios, type MembershipHours } from "@/lib/studios";

export default function MembershipCards({ dark = false }: { dark?: boolean }) {
  const [hours, setHours] = useState<MembershipHours>(16);
  const border = dark ? "border-cream" : "border-ink";

  return (
    <div>
      <div role="radiogroup" aria-label="Membership size" className={`mb-6 inline-flex rounded-full border-2 ${border} p-1`}>
        {([8, 16] as const).map((h) => (
          <button
            key={h}
            type="button"
            role="radio"
            aria-checked={hours === h}
            onClick={() => setHours(h)}
            className={`min-h-11 rounded-full px-6 text-sm font-extrabold uppercase ${
              hours === h ? "bg-brand text-ink" : ""
            }`}
          >
            {h} hours
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {studios.map((s) => {
          const save = membershipSavings(s, hours);
          return (
            <article
              key={s.id}
              className={`flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-white text-ink ${
                !s.available ? "opacity-60" : ""
              }`}
            >
              <div className="relative aspect-[16/9]">
                <Photo name={s.photo} alt={s.name} sizes="(min-width: 768px) 33vw, 100vw" className="absolute inset-0 h-full w-full" />
                {s.available && (
                  <span className="absolute right-3 top-3 rounded-full border-2 border-ink bg-brand px-3 py-1 text-xs font-black uppercase">
                    Save {save}%
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="display text-3xl">{s.name}</h3>
                <p className="mt-4">
                  <span className="display text-5xl not-italic">{money(s.memberships[hours])}</span>
                  <span className="ml-2 text-sm font-semibold text-neutral-600">for {hours} hrs</span>
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  <strong>{money(s.memberships[hours] / hours, true)}/hr</strong>{" "}
                  <span className="line-through">{money(s.hourly)}/hr</span> drop-in
                </p>
                <div className="mt-auto pt-5">
                  {s.available ? (
                    <BuyButton payload={{ type: "membership", studio: s.id, hours }}>
                      Buy {hours} hrs · {money(s.memberships[hours])}
                    </BuyButton>
                  ) : (
                    <button className="btn btn-ghost w-full" disabled>
                      Currently unavailable
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
