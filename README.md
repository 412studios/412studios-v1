# 412 Studios

Website for [412studios.ca](https://412studios.ca): book a session or buy a membership and pay online (Stripe), plus a walkthrough of the space built from pre-rendered 3D stills.

## Run it

```bash
npm install
cp .env.example .env.local   # add a Stripe TEST key (sk_test_...) and a DATABASE_URL
npx prisma db push           # creates the tables in an empty local Postgres
npm run dev
```

Open http://localhost:3000.

## Where things live

- `lib/studios.ts`: default rates, memberships, which studios are bookable, and the seed values for the `Pricing` table. `lib/pricing.ts` lays that table over them (`/admin/pricing` edits it; a 0 means "use the default", an empty table means defaults only), cached until the next admin save. The checkout API prices from there, never from the browser.
- `prisma/schema.prisma`: the studio's existing database, shared with the old site, field names untouched. `lib/legacy.ts` translates its conventions (room 0/1/2, YYYYMMDD dates, inclusive slot ids).
- `lib/bookings.ts`: availability and holds. A pending row is created before Stripe opens and blocks its slots for 15 minutes; `/api/webhook/stripe` marks it paid; `/api/cron/cleanup` frees abandoned ones.
- `lib/members.ts`: User rows for members and pay-now guests (a login claims a guest's bookings by email), hour balances, pending memberships.
- `lib/fulfillment.ts`: what happens once Stripe says paid. Calendar event and emails are still TODO (see the old repo's lib/calendar.ts and lib/email.ts).
- `lib/auth.ts`, `proxy.ts`, `app/account/`: member logins via Kinde. Without `KINDE_*` vars the site runs logged-out and `/account` says so.
- `app/admin/`: the owners' admin (see below). `lib/admin.ts` does the reads and writes, `app/admin/actions.ts` the server actions, `components/admin/` the UI.
- `components/BookingFlow.tsx`: the booking page, membership switch and upsell, mobile pay bar.
- `components/SpaceExplorer.tsx`: the 3D walkthrough. Hotspot positions are percentages of each render.
- `components/Loader.tsx`: the intro loader (once per browser session).
- `public/renders`, `public/photos`, `public/video`: pre-optimized WebP/MP4.

## Admin

`/admin` replaces the old site's `/user/admin`. It needs the Kinde permission `admin` (the same flag as before, checked in `proxy.ts` and again inside every server action); logged-in people without it land on the home page. Admins get an Admin link in the header. Locally, with no Kinde tenant, `ADMIN_DEV_BYPASS=1` in `.env.local` opens it under `next dev` only.

- **Bookings**: upcoming (or past) sessions across studios with customer, room, time, status, engineer hours and price; filter by studio, search by name or email. Edit a booking's times (same overlap check as the public page; `totalHours` is the slot count, which the old admin got off by one), status (`success` = paid, `pending`, `cancelled`), engineer hours and customer, or delete it.
- **New booking**: book a customer in without Stripe, confirmed at once, either as a paid session (price recorded, money collected outside the site) or from the customer's prepaid hours (the hours come off their membership).
- **Users**: everyone with an account or a past guest checkout, with role, memberships and booking count. A user's page lists their bookings and memberships; add a membership (`planId: "admin_created"`), set the hours left, or cancel one (hours left stay usable, as before).
- **Pricing**: the three `Pricing` rows. Saving writes the table and refreshes the public pages, the booking page and checkout. "Use site defaults" fills in the constants from `lib/studios.ts` (nothing changes until saved).

Not ported, still on the old admin: offer codes, the Google Calendar sync and the email-template page. Bookings edited here are not pushed to Google Calendar.

## Before going live

- Swap in the live Stripe key, add the webhook endpoint (`/api/webhook/stripe`, event `checkout.session.completed`) and set `NEXT_PUBLIC_SITE_URL`.
- Point `DATABASE_URL` at the production database and the `KINDE_*` vars at the studio's tenant.
- Retire the old booking site at the same time, so bookings aren't split across two systems.
- Open `/admin/pricing` right after the first deploy: the production `Pricing` table still holds the old site's higher prices, and the new site now reads it. Press "Use site defaults" and save to put the Oct 2026 sheet prices in (the old site reads the same table, so it will show them too).
- Build the member booking flow (4-hour blocks drawn from prepaid hours); until then members email or call and an admin books them in from `/admin`.
