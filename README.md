# 412 Studios

Website for [412studios.ca](https://412studios.ca): book a session or buy a membership and pay online (Stripe), plus a walkthrough of the space built from pre-rendered 3D stills.

## Run it

```bash
npm install
cp .env.example .env.local   # add a Stripe TEST key (sk_test_...)
npm run dev
```

Open http://localhost:3000.

## Where things live

- `lib/studios.ts`: rates, memberships, which studios are bookable. The checkout API prices from here, never from the browser.
- `lib/bookings.ts`: availability. Stripe is the booking ledger (paid bookings + 30-minute holds while someone pays), so there is no database.
- `components/BookingFlow.tsx`: the booking page, membership switch and upsell, mobile pay bar.
- `components/SpaceExplorer.tsx`: the 3D walkthrough. Hotspot positions are percentages of each render.
- `components/Loader.tsx`: the intro loader (once per browser session).
- `public/renders`, `public/photos`, `public/video`: pre-optimized WebP/MP4.

## Before going live

- Swap in the live Stripe key and set `NEXT_PUBLIC_SITE_URL`.
- Retire the old booking site at the same time, so bookings aren't split across two systems.
- Decide how members redeem their hours (currently: email or call).
