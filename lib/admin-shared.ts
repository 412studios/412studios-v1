import type { StudioId } from "./studios";

// Shapes the admin pages pass to their client components. Kept apart from lib/admin.ts, which is
// server-only (it imports the database), so client bundles can use these without pulling that in.

export const BOOKING_STATUSES = ["success", "pending", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type AdminUserRef = { id: string; name: string | null; email: string };

export type AdminBooking = {
  bookingId: string;
  studio: StudioId;
  date: string; // ISO
  start: number; // first hour, inclusive
  end: number; // last hour, exclusive
  status: string;
  type: string;
  engineerHours: number; // 0 = none
  price: number; // pre-tax CAD
  createdAt: string;
  user: AdminUserRef;
};

export type AdminMembership = {
  membershipId: string;
  studio: StudioId;
  status: string;
  hours: number;
  planId: string;
  createdAt: string;
};

export type AdminUser = AdminUserRef & { role: string; phone: string | null; memberships: AdminMembership[]; bookings: number };
