"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "Bookings" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/pricing", label: "Pricing" },
];

export default function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
      {tabs.map((t) => {
        const active = t.href === "/admin" ? path === "/admin" || path.startsWith("/admin/bookings") : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`btn !min-h-10 !px-4 !text-xs ${active ? "bg-ink text-cream" : "bg-white"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
