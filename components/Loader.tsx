"use client";

import { useEffect, useRef, useState } from "react";
import LogoMark from "./LogoMark";
import { LOADER_KEY } from "@/lib/loader";

// Recreates the 412studios.ca intro: a faint logo on yellow that fills from the bottom
// as the page loads, then the screen fades away.
// Shown once per browser session; the inline script in layout.tsx hides it before
// first paint on repeat loads, so returning visitors never wait.

const MIN_MS = 900; // long enough to read as an animation
const MAX_MS = 3500; // never hold anyone back on a slow connection
const FADE_MS = 500;

export default function Loader() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "fading" | "gone">("loading");
  const started = useRef(0);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(LOADER_KEY) === "1";
      sessionStorage.setItem(LOADER_KEY, "1");
    } catch {}
    if (seen) return; // already hidden by CSS (html[data-loaded])

    started.current = performance.now();
    // What the visitor actually sees first: eager images (hero render, studio photos) and fonts.
    const imgs = [...document.images].filter((i) => i.loading !== "lazy");
    const tasks: Promise<unknown>[] = [
      document.fonts.ready,
      ...imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((r) => {
              img.addEventListener("load", r, { once: true });
              img.addEventListener("error", r, { once: true });
            }),
      ),
    ];
    let done = 0;
    tasks.forEach((t) => t.then(() => setProgress(Math.round((++done / tasks.length) * 100))));

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      const wait = Math.max(0, MIN_MS - (performance.now() - started.current));
      setTimeout(() => {
        setProgress(100);
        setTimeout(() => setPhase("fading"), 300);
        setTimeout(() => setPhase("gone"), 300 + FADE_MS);
      }, wait);
    };
    Promise.all(tasks).then(finish);
    const cap = setTimeout(finish, MAX_MS);
    return () => clearTimeout(cap);
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      id="loader"
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] grid place-items-center transition-opacity ease-out"
      style={{ backgroundColor: "#FFD60A", opacity: phase === "fading" ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      <div className="relative w-48 text-ink sm:w-56">
        <LogoMark className="h-auto w-full opacity-20" />
        <div
          className="absolute inset-0 transition-[clip-path] duration-500 ease-out"
          style={{ clipPath: `inset(${100 - progress}% 0 0 0)` }}
        >
          <LogoMark className="h-auto w-full" />
        </div>
      </div>
    </div>
  );
}
