// How dark it is in Toronto right now, from 0 (full daylight) to 1 (night).
// Sunrise and sunset come from the NOAA solar equations for 412 Richmond St E,
// so the walkthrough's lighting follows the real sky through the year instead of
// flipping at a fixed hour. Everything is done in UTC: no time-zone or DST maths.

const LAT = 43.653;
const LON = -79.371;
const RAD = Math.PI / 180;

/** Solar noon, the sun's declination and the minutes from noon to sunset for this date. */
function solar(d: Date) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start) / 86_400_000);
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (d.getUTCHours() - 12) / 24);
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const eqTime =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  // 90.833°: the sun's centre is 0.833° below the horizon at the moment the top edge disappears.
  const cosHa = Math.cos(90.833 * RAD) / (Math.cos(LAT * RAD) * Math.cos(decl)) - Math.tan(LAT * RAD) * Math.tan(decl);
  const ha = Math.acos(Math.max(-1, Math.min(1, cosHa))) / RAD;
  const solarNoon = 720 - 4 * LON - eqTime; // minutes after UTC midnight
  return { solarNoon, halfDay: 4 * ha, decl };
}

/** Minutes from solar noon, wrapped to (-720, 720]: negative is morning, positive is afternoon. */
function sinceNoon(d: Date, solarNoon: number) {
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  let t = (minutes - solarNoon) % 1440;
  if (t > 720) t -= 1440;
  if (t <= -720) t += 1440;
  return t;
}

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

// The night render fades in over the 80 minutes starting 20 minutes before sunset
// and fades out over the 80 minutes ending 30 minutes after sunrise.
const DUSK_LEAD = 20;
const DAWN_LAG = 30;
const FADE = 80;

export function nightAmount(d = new Date()) {
  const { solarNoon, halfDay } = solar(d);
  const t = sinceNoon(d, solarNoon);
  return t >= 0 ? smooth((t - (halfDay - DUSK_LEAD)) / FADE) : 1 - smooth((t + halfDay + DAWN_LAG) / FADE);
}

export type Sky = {
  /** 0 full day, 1 full night: how much of the night render to show. */
  night: number;
  /** The sun's elevation above the horizon in degrees (negative after sunset). */
  elevation: number;
  /** Before solar noon. Morning light is pinker, afternoon light is more golden. */
  morning: boolean;
  /** Degrees of hour angle from solar noon: negative in the morning, 15° per hour. */
  hourAngle: number;
};

export function sky(d = new Date()): Sky {
  const { solarNoon, decl } = solar(d);
  const t = sinceNoon(d, solarNoon);
  const ha = (t / 4) * RAD; // hour angle: 15° per hour
  const sinEl = Math.sin(LAT * RAD) * Math.sin(decl) + Math.cos(LAT * RAD) * Math.cos(decl) * Math.cos(ha);
  return { night: nightAmount(d), elevation: Math.asin(sinEl) / RAD, morning: t < 0, hourAngle: t / 4 };
}

// The "virtual lighting" pass: a colour grade over the single daytime render so the room
// warms up as the sun drops, goes golden near the horizon and turns blue through civil
// twilight, before the night render (lamps on) takes over. Shadows can't move, since there
// is one daytime image per room; this only shifts colour and brightness.
export type Grade = {
  /** CSS filter for the day render. */
  filter: string;
  /** Opacity of a soft-light warm layer; its colour. */
  warm: number;
  warmColor: string;
  /** Opacity of a multiplied blue layer for twilight. */
  cool: number;
};

const LOW_SUN = 25; // degrees: warming starts here
const TWILIGHT = 8; // degrees below the horizon: blue phase ends here

export function grade(s: Pick<Sky, "elevation" | "morning">): Grade {
  const e = s.elevation;
  const low = e >= LOW_SUN ? 0 : e >= 0 ? smooth((LOW_SUN - e) / LOW_SUN) : 1; // 0 high sun → 1 at the horizon
  const dusk = e >= 0 ? 0 : smooth(-e / TWILIGHT); // 0 at the horizon → 1 deep in twilight
  const warm = 0.55 * low * (1 - dusk);
  const cool = 0.6 * dusk;
  const brightness = 1 - 0.08 * low - 0.3 * dusk;
  const saturate = 1 + 0.18 * low - 0.35 * dusk;
  const contrast = 1 + 0.06 * low;
  return {
    filter: `brightness(${brightness.toFixed(3)}) saturate(${saturate.toFixed(3)}) contrast(${contrast.toFixed(3)})`,
    warm: Math.round(warm * 100) / 100,
    warmColor: s.morning ? "#ffb089" : "#ff9a3c",
    cool: Math.round(cool * 100) / 100,
  };
}

// Sun keyframes: rooms rendered from the Blender scenes at a handful of sun positions along an
// equinox path over Toronto. The explorer cross-fades between the two frames nearest the current
// elevation, on the morning or afternoon side, then into the night render after sunset.
export const SUN_FRAMES = {
  morning: [
    ["m03", 3],
    ["m12", 12],
    ["m25", 25],
    ["hi", 45],
  ],
  afternoon: [
    ["a03", 3],
    ["a12", 12],
    ["a25", 25],
    ["hi", 45],
  ],
} as const;
export type SunFrame = (typeof SUN_FRAMES)["morning"][number][0] | (typeof SUN_FRAMES)["afternoon"][number][0];

export type SunBlend = {
  /** Base frame, shown in full. */
  lower: SunFrame;
  /** Next frame up the path, shown at opacity t. */
  upper: SunFrame;
  t: number;
  /** The high-sun frame fades in over the 90 minutes either side of solar noon, so the switch from
   *  the morning path to the afternoon path happens behind it. */
  noon: number;
};

const NOON_HALF_WIDTH = 22.5; // degrees of hour angle: 1.5 hours

export function sunBlend(s: Pick<Sky, "elevation" | "morning" | "hourAngle">): SunBlend {
  const path = s.morning ? SUN_FRAMES.morning : SUN_FRAMES.afternoon;
  const e = Math.max(path[0][1], Math.min(path[path.length - 1][1], s.elevation));
  const noon = smooth(1 - Math.abs(s.hourAngle) / NOON_HALF_WIDTH);
  for (let k = 0; k < path.length - 1; k++) {
    const [lo, loE] = path[k];
    const [hiName, hiE] = path[k + 1];
    if (e <= hiE) return { lower: lo, upper: hiName, t: smooth((e - loE) / (hiE - loE)), noon };
  }
  const last = path[path.length - 1][0];
  return { lower: last, upper: last, t: 0, noon };
}
