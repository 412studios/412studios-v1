// How dark it is in Toronto right now, from 0 (full daylight) to 1 (night).
// Sunrise and sunset come from the NOAA solar equations for 412 Richmond St E,
// so the walkthrough's lighting follows the real sky through the year instead of
// flipping at a fixed hour. Everything is done in UTC: no time-zone or DST maths.

const LAT = 43.653;
const LON = -79.371;
const RAD = Math.PI / 180;

/** Minutes after solar noon at which the sun sets today (sunrise is the mirror image). */
function halfDayMinutes(d: Date) {
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
  return { solarNoon, halfDay: 4 * ha };
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
  const { solarNoon, halfDay } = halfDayMinutes(d);
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  // Minutes from solar noon, wrapped to (-720, 720]: negative is morning, positive is afternoon.
  let t = (minutes - solarNoon) % 1440;
  if (t > 720) t -= 1440;
  if (t <= -720) t += 1440;
  return t >= 0 ? smooth((t - (halfDay - DUSK_LEAD)) / FADE) : 1 - smooth((t + halfDay + DAWN_LAG) / FADE);
}
