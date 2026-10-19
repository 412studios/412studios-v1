import { randomBytes } from "node:crypto";
import { OPEN_HOUR, type StudioId } from "./studios";

// Conventions inherited from the old site's database (see prisma/schema.prisma):
//   rooms   0/1/2 = Studio A/B/C
//   dates   YYYYMMDD integers, Toronto local date
//   slots   0–15, inclusive on both ends, hour = slot + 8 (so 8am–10am is start 0, end 1)
// The rest of this codebase talks in studio ids, ISO dates and hours; convert at the DB edge.

const STUDIO_BY_ROOM: StudioId[] = ["a", "b", "c"];

export const roomId = (studio: StudioId) => STUDIO_BY_ROOM.indexOf(studio);
export const studioOfRoom = (room: number): StudioId | undefined => STUDIO_BY_ROOM[room];

export const dateInt = (iso: string) => Number(iso.replaceAll("-", ""));
export const isoOfDateInt = (d: number) => {
  const s = String(d).padStart(8, "0");
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
};

/** Hour (8–23) → slot id (0–15). */
export const slotOf = (hour: number) => hour - OPEN_HOUR;
/** Slot id → hour. */
export const hourOf = (slot: number) => slot + OPEN_HOUR;

/** Booking and membership ids are 32 hex chars, unguessable, same as the old site. */
export const newId = () => randomBytes(16).toString("hex");
