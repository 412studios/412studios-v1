"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoMark from "./LogoMark";
import { bestSavings, cheapestMembership, money } from "@/lib/studios";

const links = [
  { href: "/#explore", label: "The Space" },
  { href: "/#studios", label: "Studios" },
  { href: "/book?plan=membership", label: "Memberships", badge: `-${bestSavings()}%` },
  { href: "/#artists", label: "Artists" },
  { href: "/#contact", label: "Contact" },
];

export function Logo() {
  return (
    <Link href="/" aria-label="412 Studios home" className="flex h-10 items-center">
      <LogoMark className="h-9 w-auto sm:h-10" />
    </Link>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-ink bg-cream">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide hover:underline">
              {l.label}
              {l.badge && <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-black">{l.badge}</span>}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/book" className="btn btn-primary !min-h-10 !px-4">
            Book
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
            className="flex h-10 items-center px-2 text-sm font-bold uppercase md:hidden"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-ink bg-cream md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="display flex items-center justify-between border-b border-line px-4 py-4 text-3xl"
            >
              {l.label}
              {l.badge && <span className="rounded-full bg-brand px-2 py-1 text-xs not-italic">Save {l.badge.slice(1)}</span>}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

/** Phones only: keeps both ways to pay one thumb away on every page except /book (which has its own pay bar). */
export function MobileActionBar() {
  const path = usePathname();
  if (path.startsWith("/book")) return null;
  return (
    <>
      <div aria-hidden className="h-20 md:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t-2 border-ink bg-cream px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden">
        <Link href="/book" className="btn btn-primary !px-3">
          Book now
        </Link>
        <Link href="/book?plan=membership" className="btn bg-ink !px-3 leading-tight text-cream">
          <span>
            Memberships
            <span className="block text-[10px] text-brand">from {money(cheapestMembership())}</span>
          </span>
        </Link>
      </div>
    </>
  );
}
