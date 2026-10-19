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

- `lib/studios.ts`: rates, memberships, which studios are bookable. The checkout API prices from here, never from the browser.
- `prisma/schema.prisma`: the studio's existing database, shared with the old site, field names untouched. `lib/legacy.ts` translates its conventions (room 0/1/2, YYYYMMDD dates, inclusive slot ids).
- `lib/bookings.ts`: availability and holds. A pending row is created before Stripe opens and blocks its slots for 15 minutes; `/api/webhook/stripe` marks it paid; `/api/cron/cleanup` frees abandoned ones.
- `lib/members.ts`: User rows for members and pay-now guests (a login claims a guest's bookings by email), hour balances, pending memberships.
- `lib/fulfillment.ts`: what happens once Stripe says paid. Calendar event and emails are still TODO (see the old repo's lib/calendar.ts and lib/email.ts).
- `lib/auth.ts`, `proxy.ts`, `app/account/`: member logins via Kinde. Without `KINDE_*` vars the site runs logged-out and `/account` says so.
- `components/BookingFlow.tsx`: the booking page, membership switch and upsell, mobile pay bar.
- `components/SpaceExplorer.tsx`: the 3D walkthrough. Hotspot positions are percentages of each render.
- `components/Loader.tsx`: the intro loader (once per browser session).
- `public/renders`, `public/photos`, `public/video`: pre-optimized WebP/MP4.

## Before going live

- Swap in the live Stripe key, add the webhook endpoint (`/api/webhook/stripe`, event `checkout.session.completed`) and set `NEXT_PUBLIC_SITE_URL`.
- Point `DATABASE_URL` at the production database and the `KINDE_*` vars at the studio's tenant.
- Retire the old booking site at the same time, so bookings aren't split across two systems.
- Build the member booking flow (4-hour blocks drawn from prepaid hours) and a minimal admin view; until then members email or call to use hours.
