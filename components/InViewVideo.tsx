"use client";

import { useEffect, useRef } from "react";

/** Muted loop that only downloads and plays while on screen (saves data on phones). */
export default function InViewVideo({ name, label, className = "" }: { name: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={`/video/${name}.mp4`}
      poster={`/video/${name}.webp`}
      aria-label={label}
      muted
      loop
      playsInline
      preload="none"
      className={`object-cover ${className}`}
    />
  );
}
