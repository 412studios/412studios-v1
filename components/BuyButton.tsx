"use client";

import { useState } from "react";

/** POSTs to /api/checkout and sends the visitor straight to Stripe Checkout. */
export default function BuyButton({
  payload,
  children,
  className = "btn btn-primary",
  disabled,
}: {
  payload: Record<string, unknown>;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Something went wrong");
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button type="button" className={`${className} w-full`} onClick={go} disabled={disabled || loading}>
        {loading ? "Opening secure checkout…" : children}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
