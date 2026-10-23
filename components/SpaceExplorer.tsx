/* eslint-disable @next/next/no-img-element -- renders are pre-sized WebP in /public/renders */
"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { blur } from "@/lib/blur";
import { grade, sky } from "@/lib/daylight";
import { TIMEZONE } from "@/lib/studios";

// Pre-rendered isometric stills + hotspots: the drakerelated.com technique.
// No WebGL, so it is quick on phones: each render is a 50–150KB WebP cut from the 3–7MB Blender PNGs.
// Hotspot x/y are percentages of the 16:9 render.

type Action = { kind: "book"; href: string; label: string } | { kind: "room"; to: string; label: string };
type Hotspot = { x: number; y: number; title: string; text: string; action?: Action; primary?: boolean };
type Room = { id: string; name: string; focus: number; hotspots: Hotspot[] };

const bookA: Action = { kind: "book", href: "/book?studio=a", label: "Book Studio A" };

export const rooms: Room[] = [
  {
    id: "room-a",
    name: "Studio A",
    focus: 58,
    hotspots: [
      { x: 63, y: 86, title: "Control desk", text: "Monitors, interface and MIDI keys, set up and ready when you walk in.", action: bookA, primary: true },
      { x: 30, y: 62, title: "Daybeds", text: "Room for the whole crew to listen back without crowding the engineer." },
      { x: 84, y: 26, title: "Guitar wall", text: "Acoustic and electrics on stands. Grab one mid-session." },
      { x: 88, y: 66, title: "Stage piano", text: "88 weighted keys beside the desk, headphones hanging ready." },
      { x: 6, y: 36, title: "Downtown view", text: "Floor-to-ceiling windows over Richmond St E.", action: { kind: "room", to: "live-room", label: "Next: the live room" } },
    ],
  },
  {
    id: "live-room",
    name: "Live Room",
    focus: 55,
    hotspots: [
      { x: 62, y: 86, title: "Drum kit", text: "A full kit, mic'd and ready to track.", action: bookA, primary: true },
      { x: 32, y: 32, title: "Keys", text: "Electric piano and a synth on top, with a mixer on the side table." },
      { x: 60, y: 33, title: "Keyboard stack", text: "Three tiers of keys for writing sessions." },
      { x: 10, y: 62, title: "Listening chair", text: "Sit back for playback.", action: { kind: "room", to: "lounge", label: "Next: the lounge" } },
    ],
  },
  {
    id: "lounge",
    name: "Lounge",
    focus: 32,
    hotspots: [
      { x: 23, y: 34, title: "Book your date", text: "Pick a studio and hours, pay online, done. No messages, no account.", action: { kind: "book", href: "/book", label: "Book now" }, primary: true },
      { x: 46, y: 58, title: "Record player", text: "Vinyl for between takes." },
      { x: 28, y: 72, title: "The couch", text: "Where the sessions breathe." },
      { x: 46, y: 30, title: "Doorway", text: "Through to the kitchen.", action: { kind: "room", to: "kitchen", label: "Go to the kitchen" } },
    ],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    focus: 55,
    hotspots: [
      { x: 20, y: 68, title: "Kitchen", text: "Fridge, sink and counter space to fuel up between takes." },
      { x: 66, y: 92, title: "Work table", text: "Answer emails, write lyrics, plan the rollout.", action: { kind: "room", to: "room-a", label: "Back to Studio A" } },
      { x: 69, y: 40, title: "Patio door", text: "Opens onto the patio. Step outside for air between takes." },
    ],
  },
];

type Mode = "day" | "night";

const src = (room: string, mode: Mode, w: 1280 | 1920) => `/renders/${room}-${mode}-${w}.webp`;
const srcSet = (room: string, mode: Mode) => `${src(room, mode, 1280)} 1280w, ${src(room, mode, 1920)} 1920w`;

// In development, ?sky=2026-06-21T17:30 (Toronto time) freezes the clock to preview any hour's lighting.
const frozen =
  process.env.NODE_ENV === "development" && typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("sky")
    : null;
const torontoOffset = (iso: string) => {
  // Toronto is UTC-4 in summer and UTC-5 in winter; good enough for a preview switch.
  const m = Number(iso.slice(5, 7));
  return m >= 4 && m <= 10 ? "-04:00" : "-05:00";
};

// Toronto sky + wall clock as an external store: "" on the server, "0.37|12.5|1|10:26 p.m." in the
// browser: night amount (0 day, 1 night), sun elevation in degrees, 1 if morning, clock label.
// Re-read every 30s so the lighting drifts through the day and cross-fades at dusk and dawn.
const clockStore = {
  subscribe(cb: () => void) {
    const id = setInterval(cb, 30_000);
    return () => clearInterval(id);
  },
  get() {
    const d = frozen ? new Date(`${frozen}${torontoOffset(frozen)}`) : new Date();
    const label = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit" }).format(d);
    const s = sky(d);
    return `${s.night.toFixed(2)}|${s.elevation.toFixed(1)}|${s.morning ? 1 : 0}|${label}`;
  },
  server: () => "",
};

export default function SpaceExplorer() {
  const [i, setI] = useState(0);
  const now = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.server);
  const [override, setOverride] = useState<Mode | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [panned, setPanned] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const autoScrolled = useRef(false); // our own centering scroll is not a user pan
  const room = rooms[i];
  const spot = active === null ? null : room.hotspots[active];

  // Lights follow the real sky over Toronto: the night render fades in around sunset and out
  // around sunrise. Visitors can still flip them. null until hydrated, so we never download
  // the wrong lighting first.
  const [amountStr, elevationStr, morningStr, clock] = now.split("|");
  const night = override ? (override === "night" ? 1 : 0) : now ? Number(amountStr) : null;
  const mode: Mode | null = night === null ? null : night >= 0.5 ? "night" : "day";
  // Forcing "day" shows the plain midday render; otherwise the day render is colour-graded by the sun.
  const tint = override || !now ? null : grade({ elevation: Number(elevationStr), morning: morningStr === "1" });
  const dayMounted = night !== null && (night < 1 || loaded[`${room.id}-day`]);

  // On phones the render is wider than the screen: start centred on the room's focal point.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    autoScrolled.current = true;
    el.scrollLeft = (el.scrollWidth * room.focus) / 100 - el.clientWidth / 2;
  }, [room]);

  // Warm the cache for the next room so moving around feels instant.
  useEffect(() => {
    if (!mode) return;
    const next = rooms[(i + 1) % rooms.length];
    const img = new Image();
    img.srcset = srcSet(next.id, mode);
    img.sizes = "(min-width: 640px) min(1152px, 100vw), 125vh";
  }, [i, mode]);

  const goTo = (idx: number) => {
    setI((idx + rooms.length) % rooms.length);
    setActive(null);
  };

  const key = `${room.id}-${mode ?? "day"}`;

  return (
    <div>
      <div
        className="relative -mx-4 overflow-hidden border-y-2 border-ink bg-ink sm:mx-0 sm:rounded-2xl sm:border-2"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") goTo(i + 1);
          if (e.key === "ArrowLeft") goTo(i - 1);
          if (e.key === "Escape") setActive(null);
        }}
      >
        <div
          ref={scroller}
          onScroll={() => {
            if (autoScrolled.current) autoScrolled.current = false;
            else if (!panned) setPanned(true);
          }}
          className="h-[60svh] max-h-[600px] min-h-[400px] overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] sm:h-auto sm:max-h-none sm:min-h-0 sm:overflow-hidden"
        >
          <div
            className="relative aspect-video h-full sm:h-auto sm:w-full"
            style={{ backgroundImage: `url(${blur[key]})`, backgroundSize: "cover" }}
          >
            {(["day", "night"] as const).map((m) =>
              // Mount a lighting only while it is visible (both during dusk and dawn) or once it has loaded.
              night === null || ((m === "day" ? night >= 1 : night <= 0) && !loaded[`${room.id}-${m}`]) ? null : (
              <img
                key={`${room.id}-${m}`}
                src={src(room.id, m, 1920)}
                srcSet={srcSet(room.id, m)}
                sizes="(min-width: 640px) min(1152px, 100vw), 125vh"
                alt={m === mode ? `${room.name}, 3D render at ${m === "day" ? "daytime" : "night"}` : ""}
                aria-hidden={m !== mode}
                fetchPriority={m === mode && i === 0 ? "high" : "auto"}
                decoding="async"
                onLoad={() => setLoaded((l) => ({ ...l, [`${room.id}-${m}`]: true }))}
                // Day is the base layer, graded by the sun; night sits on top and fades in with the sky.
                style={{
                  opacity: !loaded[`${room.id}-${m}`] ? 0 : m === "day" ? 1 : night ?? 0,
                  filter: m === "day" && tint ? tint.filter : undefined,
                }}
                // z-[1] keeps the night render above the lighting layers below.
                className={`absolute inset-0 h-full w-full transition-[opacity,filter] duration-700 ${m === "night" ? "z-[1]" : ""}`}
              />
            ))}

            {/* Virtual lighting: warm light as the sun drops, blue through twilight. Sits between the day and night renders. */}
            {tint && dayMounted && (
              <>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 transition-opacity duration-700"
                  style={{ backgroundColor: tint.warmColor, mixBlendMode: "soft-light", opacity: tint.warm }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 transition-opacity duration-700"
                  style={{ backgroundColor: "#1f3a7a", mixBlendMode: "multiply", opacity: tint.cool }}
                />
              </>
            )}

            {room.hotspots.map((h, idx) => (
              <button
                key={h.title}
                type="button"
                aria-label={h.title}
                aria-expanded={active === idx}
                onClick={() => setActive(active === idx ? null : idx)}
                style={{ left: `${h.x}%`, top: `${h.y}%` }}
                className="group absolute z-10 grid h-11 -translate-x-1/2 -translate-y-1/2 place-items-center"
              >
                {h.primary && h.action?.kind === "book" ? (
                  <span className="hotspot-pulse flex items-center gap-1 whitespace-nowrap rounded-full border-2 border-ink bg-brand px-3 py-1.5 text-xs font-black uppercase shadow-lg">
                    <span aria-hidden>+</span> {h.action.label}
                  </span>
                ) : (
                  <span
                    className={`hotspot-pulse grid h-8 w-8 place-items-center rounded-full border-2 border-ink text-lg font-black leading-none shadow-lg ${
                      active === idx ? "bg-ink text-brand" : "bg-cream"
                    }`}
                  >
                    {h.action?.kind === "room" ? "→" : "+"}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Fixed overlays (do not scroll with the render) */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="whitespace-nowrap rounded-full border-2 border-ink bg-cream px-3 py-1 text-xs font-black uppercase">{room.name}</span>
          <button
            type="button"
            onClick={() => setOverride(mode === "night" ? "day" : "night")}
            className="pointer-events-auto flex min-h-9 items-center gap-2 whitespace-nowrap rounded-full border-2 border-ink bg-cream px-3 text-xs font-black uppercase"
            aria-label={`Switch to ${mode === "night" ? "day" : "night"} lighting`}
          >
            <span aria-hidden>{mode === "night" ? "☾" : "☀"}</span>
            <span className="hidden min-[400px]:inline">Toronto</span>
            {clock}
          </button>
        </div>

        {!panned && !spot && (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center sm:hidden">
            <span className="rounded-full bg-ink/80 px-3 py-1.5 text-xs font-bold text-cream">← Drag to look around · tap + →</span>
          </p>
        )}

        {spot && (
          <div role="dialog" aria-label={spot.title} className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border-2 border-ink bg-cream p-4 shadow-xl sm:inset-x-auto sm:left-3 sm:w-80">
            <div className="flex items-start justify-between gap-3">
              <h3 className="display text-2xl">{spot.title}</h3>
              <button type="button" onClick={() => setActive(null)} aria-label="Close" className="-mr-2 -mt-2 grid h-10 w-10 place-items-center text-xl">
                ×
              </button>
            </div>
            <p className="mt-1 text-sm">{spot.text}</p>
            {spot.action &&
              (spot.action.kind === "book" ? (
                <Link href={spot.action.href} className="btn btn-primary mt-3 w-full">
                  {spot.action.label}
                </Link>
              ) : (
                <button type="button" onClick={() => goTo(rooms.findIndex((r) => r.id === (spot.action as { to: string }).to))} className="btn btn-ghost mt-3 w-full">
                  {spot.action.label} →
                </button>
              ))}
          </div>
        )}
      </div>

      <div role="tablist" aria-label="Rooms" className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {rooms.map((r, idx) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={idx === i}
            onClick={() => goTo(idx)}
            className={`btn whitespace-nowrap !min-h-10 ${idx === i ? "bg-ink text-brand" : "btn-ghost"}`}
          >
            {r.name}
          </button>
        ))}
      </div>
    </div>
  );
}
