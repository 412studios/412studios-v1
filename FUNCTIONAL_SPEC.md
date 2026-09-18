# 412 Studios — Functional Specification

This document describes **everything the current application does**, written so the
system can be rebuilt on a different tech stack with identical behaviour. It is
derived from reading the code as of commit `4a6c02e` (September 2026), not from
the README or any prior design docs.

Where the current code has a quirk or a likely bug, it is called out in a
`⚠️` note so you can decide whether to preserve or fix it in the rebuild. The
booking model, pricing rules and state machines are the parts that must be
preserved exactly; the marketing pages are described more briefly.

---

## Table of contents

1. [System overview](#1-system-overview)
2. [External services](#2-external-services)
3. [Data model](#3-data-model)
4. [Authentication, users and roles](#4-authentication-users-and-roles)
5. [Core booking concepts](#5-core-booking-concepts)
6. [Pricing rules](#6-pricing-rules)
7. [Booking flows](#7-booking-flows)
8. [Membership system](#8-membership-system)
9. [Engineer add-on](#9-engineer-add-on)
10. [Offer codes](#10-offer-codes)
11. [Payments (Stripe)](#11-payments-stripe)
12. [Post-payment fulfilment](#12-post-payment-fulfilment)
13. [Google Calendar integration](#13-google-calendar-integration)
14. [Email notifications](#14-email-notifications)
15. [Scheduled jobs](#15-scheduled-jobs)
16. [Public booking page UI behaviour](#16-public-booking-page-ui-behaviour)
17. [User profile area](#17-user-profile-area)
18. [Admin dashboard](#18-admin-dashboard)
19. [Marketing site](#19-marketing-site)
20. [Route map](#20-route-map)
21. [Environment configuration](#21-environment-configuration)
22. [Known quirks and rebuild decisions](#22-known-quirks-and-rebuild-decisions)

---

## 1. System overview

412 Studios is a Toronto recording studio. The application is a public
marketing site plus a **studio booking system** with three ways to book:

| Flow                  | Who            | Payment                     | Result                                         |
| --------------------- | -------------- | --------------------------- | ---------------------------------------------- |
| Standard booking      | Any logged-in user | Stripe Checkout (card, CAD, +13% tax) | Booking becomes `success` when Stripe webhook fires |
| Membership booking    | User with an active membership in that room | Free (draws down prepaid hours); Stripe only if an engineer is added | Booking is `success` immediately (free) or after webhook (paid engineer) |
| Admin booking         | Admin users    | None                        | Booking is `success` immediately               |

Plus **membership purchase** (a prepaid bundle of 8 or 16 hours in one room,
bought via Stripe), an **admin dashboard** for managing bookings, users,
memberships, pricing, offer codes and calendar sync, and background jobs for
cleanup and reminders.

Current stack (to be replaced): Next.js 16 App Router, React 19, Prisma 5 on
PostgreSQL, Kinde auth, Stripe, Resend, Google Calendar API, deployed on
Vercel with Vercel Cron.

---

## 2. External services

| Service          | Used for                                                           |
| ---------------- | ------------------------------------------------------------------ |
| Kinde            | Authentication (hosted login), session, and the `admin` permission |
| Stripe           | One-time Checkout Sessions for bookings and membership bundles; webhook for fulfilment |
| Resend           | Transactional email (4 templates)                                  |
| Google Calendar  | Service-account write access to a single studio calendar; one event per confirmed booking |
| Facebook Pixel   | `PageView` on every page; `InitiateCheckout` on booking submit     |
| PostgreSQL       | Primary data store                                                 |

---

## 3. Data model

Five tables. Field names are given as they exist today. Types are Postgres
via Prisma.

### 3.1 `User`

| Field                 | Type      | Notes                                                                 |
| --------------------- | --------- | --------------------------------------------------------------------- |
| `id`                  | string PK | The Kinde user id. Created on first visit to any `/user/*` or `/booking` page. |
| `name`                | string?   | `"{given_name} {family_name}"` from Kinde at creation                 |
| `email`               | string, unique |                                                                  |
| `role`                | string    | `"user"` (default) or `"admin"`. See §4 for how this relates to Kinde's `admin` permission. |
| `stripeCustomerId`    | string?, unique | Stripe Customer created on first visit (see §4.2)               |
| `verifyFormSubmitted` | bool      | default `false`. Set `true` when verification form is submitted.     |
| `isUserVerified`      | bool      | default **`true`**. Gates the "Book Now" link on the profile page only. |
| `userBio`             | string?   | From verification form ("Additional Details")                        |
| `acceptedTerms`       | bool      | default `false`. Set `true` by verification form.                     |
| `phone`               | string?   |                                                                       |
| `socialLinks`         | string?   | Free text, admin-editable only                                        |
| `categories`          | string?   | Single value chosen on verification form                             |

### 3.2 `Bookings`

| Field             | Type    | Notes                                                                                  |
| ----------------- | ------- | -------------------------------------------------------------------------------------- |
| `bookingId`       | string PK | 32-char hex (16 random bytes)                                                        |
| `roomId`          | int     | `0`, `1`, `2` = Studio A, B, C. Matches `Pricing.id` (as string).                      |
| `date`            | int     | **`YYYYMMDD` as an integer**, e.g. `20260918`. Local (server) date, no timezone.        |
| `type`            | string  | Always `"hour"`. Unused otherwise.                                                     |
| `startTime`       | int     | **Slot index 0–15** (see §5.2). `0` = 8:00 am.                                          |
| `endTime`         | int     | **Slot index 0–15, inclusive**. A booking covering 8–10 am has `startTime=0, endTime=1`. |
| `status`          | string  | `"pending"` → `"success"`. Admin can also set `"cancelled"`. API also accepts `"failed"`. |
| `userId`          | string FK → User |                                                                              |
| `stripeProductId` | string  | The env `STRIPE_PRICE_ID_STANDARD_BOOKING` for paid bookings, `"none"` for membership bookings. Informational only. |
| `totalHours`      | int     | Duration in hours as submitted (`endTime - startTime + 1`). ⚠️ Admin time edit writes `endTime - startTime` (off by one). |
| `totalPrice`      | float   | Pre-tax price in whole CAD dollars (after discount).                                    |
| `engineerTotal`   | int     | Engineer hours. `-1` = no engineer requested (customer flows), `0` = none (admin edit). |
| `engineerStart`   | int     | Slot index where engineer starts. `-1` if none (customer flows), `0` if none (admin edit). |
| `engineerStatus`  | string  | `"pending"` → `"success"` on payment. Admin edit sets `"pending"` or `"none"`.          |
| `addDetails`      | string  | **Holds the Google Calendar event id** (empty string if none). Despite the name, no other use. |
| `offerCodeId`     | string? FK → OfferCode |                                                                        |
| `discountAmount`  | float?  | default 0. Whole dollars.                                                              |
| `createdAt`       | datetime | Used by the cleanup cron.                                                             |

### 3.3 `Memberships`

| Field                | Type    | Notes                                                                                     |
| -------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `membershipId`       | string PK | 32-char hex                                                                             |
| `stripeSessionId`    | string  | Always `""` (never populated)                                                             |
| `stripeMembershipId` | string  | Always `""` (never populated)                                                             |
| `interval`           | string  | Always `"month"` (nominal; there is **no recurring billing**)                             |
| `status`             | string  | `"pending"` → `"active"` → `"cancelled"` (admin removal)                                  |
| `planId`             | string  | Stripe price id env value for purchased; `"admin_created"` for admin-created              |
| `currentPeriodStart` | int     | `YYYYMMDD`. Set to first day of current month on activation.                              |
| `currentPeriodEnd`   | int     | `YYYYMMDD`. Set to first day of next month on activation. **Nothing enforces expiry.**    |
| `roomId`             | int     | 0/1/2. A membership is per room.                                                          |
| `availableHours`     | int     | Prepaid hours remaining. Starts at 8 or 16. Decremented by booking duration.              |
| `updateHours`        | datetime | Last time hours were changed by admin                                                    |
| `userId`             | string FK → User |                                                                                  |
| `weekMax`            | bool    | default `true`. `false` = exempt from the weekly-limit rule (see §8.4).                    |
| `createdAt`, `updatedAt` | datetime | `updatedAt` column is physically named `updtedAt` (typo) in the DB                   |

### 3.4 `Pricing` (one row per studio room)

| Field              | Type   | Notes                                                                   |
| ------------------ | ------ | ----------------------------------------------------------------------- |
| `id`               | string PK | `"0"`, `"1"`, `"2"`. Numeric value == `roomId` in Bookings/Memberships. |
| `room`             | string | Display letter: `"A"`, `"B"`, `"C"`                                     |
| `hourlyRate`       | int    | CAD per hour                                                            |
| `dayRate`          | int    | CAD for a full 16-hour day (cap; see §6.1)                              |
| `membershipPrice`  | int    | CAD for the 16-hour membership bundle                                   |
| `membershipPrice8` | int    | CAD for the 8-hour bundle. `0` = not offered.                           |
| `engineerPrice`    | int    | CAD per hour for engineer add-on                                        |
| `img`              | string | Filename under `/public/images/`                                        |
| `blocked`          | bool   | `true` = room unavailable: all slots shown as booked, "Currently Unavailable" overlay |
| `userId`           | string? | Unused relation                                                        |

Rooms are **not** dynamically discovered everywhere: several UI places hardcode
`["A","B","C"]` and `[0,1,2]`. Treat "exactly three rooms with ids 0,1,2" as a
current constraint.

### 3.5 `OfferCode`

| Field           | Type   | Notes                                                       |
| --------------- | ------ | ----------------------------------------------------------- |
| `id`            | cuid PK |                                                             |
| `code`          | string, unique | Stored **upper-cased**                               |
| `description`   | string? |                                                            |
| `discountType`  | string | `"percentage"` or `"fixed"`                                 |
| `discountValue` | float  | `20` = 20 % or $20.00                                       |
| `isActive`      | bool   | default `true`                                              |
| `createdAt`, `updatedAt` | datetime |                                                   |

No usage limits, no expiry dates, no per-user restrictions, no minimum spend.

---

## 4. Authentication, users and roles

### 4.1 Authentication

- Hosted login via Kinde. Login URL: `/api/auth/login?post_login_redirect_url=<path>`.
  Logout via Kinde's logout link. Post-login default redirect is `/user`.
- Route protection (middleware on `/user/*`):
  - Any `/user/*` path requires an authenticated session.
  - `/user/admin/*` additionally requires the Kinde permission **`admin`**;
    otherwise redirect to `/`.
- `/booking` is **public**. Unauthenticated visitors can browse rooms, dates
  and availability; the submit button becomes "Login to Proceed to Payment" /
  "Login to Book Time".

### 4.2 User provisioning ("ensureUser")

On every render of the booking layout and the profile page, if a Kinde session
exists:

1. If no `User` row exists for the Kinde id, create it with `id`, `email`,
   `name = "{given} {family}"`.
2. If the row has no `stripeCustomerId`, create a Stripe Customer with the
   email and store the id.

Booking or membership purchase **throws** if the user has no Stripe customer
id ("Unable to get customer id").

### 4.3 Two notions of "admin" ⚠️

There are two independent admin flags and they are both used:

| Check                          | Used by                                                                 |
| ------------------------------ | ----------------------------------------------------------------------- |
| Kinde permission `admin`       | Middleware for `/user/admin/*`; all `/api/admin/*` routes except pricing; all `/api/booking/update-*` routes |
| `User.role === "admin"` in DB  | Navbar admin link; profile page "Admin" link; booking page admin mode (`isAdmin` → ADMIN BOOK button, full 16 slots for members, offer-code box hidden); `/api/admin/pricing/update` |

For a rebuild, collapse to one source of truth but be aware the booking page's
admin behaviour keys off the **DB role**.

### 4.4 Verification (soft, effectively off)

- `/user/profile/verification` shows a form: name/email (read-only), phone,
  category select (`corporate gatherings`, `listening and release parties`,
  `photo and film studio`, `brand activations`, `writing camps`), bio
  (required), terms checkbox (required).
- Submit stores `userBio` (sanitised to `[a-zA-Z0-9 ., _-]`), `phone`,
  `categories`, `acceptedTerms=true`, `verifyFormSubmitted=true`, then
  redirects to `/user/profile`.
- `isUserVerified` defaults to `true` and only controls whether the "Book Now"
  link appears on the profile page. **No booking flow checks it.** The
  verification page is not linked from anywhere in the UI.

---

## 5. Core booking concepts

### 5.1 Rooms

Three rooms, ids `0/1/2`, letters `A/B/C`, each with its own rates and a
`blocked` switch. The booking page defaults to the first room returned from
the Pricing table.

### 5.2 Time slot grid (standard)

The studio day is **16 one-hour slots from 8:00 am to 12:00 am (midnight)**.

| Slot id | Hour  | Display               |
| ------- | ----- | --------------------- |
| 0       | 08    | 8:00 am – 9:00 am     |
| 1       | 09    | 9:00 am – 10:00 am    |
| …       | …     | …                     |
| 15      | 23    | 11:00 pm – 12:00 am   |

`hour = slotId + 8`. A booking stores `startTime` and `endTime` as **inclusive
slot ids**; `duration = endTime - startTime + 1`.

### 5.3 Membership block grid

Members (non-admin) booking a room they hold a membership in see **four
4-hour blocks** instead of 16 slots:

| Block id | Covers slots | Display               |
| -------- | ------------ | --------------------- |
| 0        | 0–3          | 8:00 am – 12:00 pm    |
| 1        | 4–7          | 12:00 pm – 4:00 pm    |
| 2        | 8–11         | 4:00 pm – 8:00 pm     |
| 3        | 12–15        | 8:00 pm – 12:00 am    |

Conversion when submitting: `startTime = block*4`, `endTime = block*4 + 3`,
`duration = 4`. Bookings are always stored in the 16-slot representation.

Conversion when displaying availability in block mode: an existing booking
with slots `s..e` marks blocks `floor(s/4)..floor(e/4)` as booked.

### 5.4 Availability rules (what makes a slot unbookable)

A slot is shown as booked/disabled if **any** of:

1. It overlaps an existing booking for that room and date, **of any status**
   (pending bookings hold the slot; the cleanup cron releases them after
   15 minutes).
2. The room is `blocked` → every slot is disabled.
3. The date is today and the slot's start hour is **less than 2 hours** from
   now (`slotStart - now < 2h`).
4. Dates before today cannot be selected in the calendar.
5. In membership block mode: the user has fewer than 4 available hours →
   clicks are ignored (no slot is selectable).

There is **no server-side conflict check** when a customer submits a booking.
The only server-side conflict check is the admin edit endpoint
(`/api/booking/check-conflict`). Race conditions between two users are
possible today; a rebuild should add a transactional check.

### 5.5 Selection behaviour (standard mode)

- Click a slot: it is added to the selection and the selection becomes the
  **contiguous range** from the lowest to the highest selected slot.
- If any slot inside that range is booked, the selection collapses to just
  the clicked slot.
- Clicking a booked slot does nothing.
- "Clear selection" resets to nothing.
- Changing room or date resets the selection (and engineer choice).

### 5.6 Selection behaviour (membership block mode)

- Exactly one block can be selected at a time; clicking another replaces it.

### 5.7 Validation before submit

| Mode       | Rule                                          | Message                              |
| ---------- | --------------------------------------------- | ------------------------------------ |
| Both       | A slot/block must be selected                 | "Please select a time slot"          |
| Standard   | `duration >= 2` hours                         | "Please select a minimum of 2 hours" |
| Membership | Exactly one 4-hour block                      | "Please select one 4 Hour session"   |
| Membership | Membership for this room exists and `availableHours >= 4` | "Hours are not available" |

---

## 6. Pricing rules

All prices are whole CAD dollars, pre-tax, until the Stripe step.

### 6.1 Standard booking price (client preview and server recompute are identical)

```
duration   = endTime - startTime + 1
base       = duration * hourlyRate
if duration == 16:
    base   = min(dayRate, 16 * hourlyRate)      # day-rate cap applies ONLY to a full 16-hour day
engineer   = hasEngineer ? engineerPrice * duration : 0   # ⚠️ uses BOOKING duration, not engineer hours
subtotal   = base + engineer
discount   = percentage: round(subtotal * value / 100)
             fixed:      min(value, subtotal)      # server also rounds
total      = max(0, subtotal - discount)
```

⚠️ The engineer charge is `engineerPrice × booking duration` regardless of how
many engineer hours were chosen. The UI displays the chosen engineer hours but
charges for the full booking length. Decide whether to preserve.

⚠️ The day-rate cap only kicks in at exactly 16 hours. A 15-hour booking pays
`15 × hourly` even if that exceeds `dayRate`.

The server **ignores the client-submitted price and discount** and recomputes
from the Pricing and OfferCode tables (security fix already in place).

### 6.2 Membership booking price

```
total = 0
if hasEngineer: total = engineerPrice * 4
```

Offer codes are **not** available on membership bookings. The room time itself
costs nothing (it is drawn from prepaid hours).

⚠️ For membership bookings the server trusts the client price (`input.price`);
it is not recomputed.

### 6.3 Admin booking price

Whatever the admin's booking page computed (standard formula, no offer code)
is stored as `totalPrice`. No payment is taken. Server trusts client value.

### 6.4 Membership bundle price

```
hours = (input.hours == 8) ? 8 : 16          # anything else → 16
price = hours == 8 ? membershipPrice8 : membershipPrice
if price <= 0: error "not available"
```

Recomputed on the server.

### 6.5 Tax and Stripe amount

```
amountCents = round( (price * 100) * 1.13 )   # 13 % HST, applied to every Stripe charge
```

Stripe automatic tax is disabled; tax is baked into the line item.

---

## 7. Booking flows

### 7.1 Standard paid booking

1. User selects room, date, ≥2 contiguous slots, optional engineer, optional
   offer code, clicks **"Proceed to Payment"**. (Pixel: `InitiateCheckout`,
   `content_type: "studio_booking"`.)
2. If not logged in → redirect to Kinde login with return to `/booking`.
3. Server:
   - Recomputes price (§6.1).
   - Inserts `Bookings` row: `status="pending"`, `engineerStatus="pending"`,
     `stripeProductId=<env price id>`, `totalHours=duration`,
     `engineerTotal/engineerStart` as chosen (or `-1`), `addDetails=""`,
     `offerCodeId`, `discountAmount`.
   - Creates a Stripe Checkout Session (§11) and redirects the browser to it.
4. User pays → Stripe redirects to `/user/success/{bookingId}` (informational
   only) and fires the webhook.
5. Webhook fulfils the booking (§12.1).
6. If the user abandons: Stripe's cancel URL → `/user/cancel/{bookingId}`
   (§7.5), or the cleanup cron deletes it after 15 minutes (§15.1).

### 7.2 Membership booking (free path)

1. Member selects a room they hold a membership in. The page shows a blue
   banner per membership ("Membership In Studio X / Status / Remaining Hours"),
   4-hour blocks, and a "Membership Details" summary with Available Hours and
   Remaining Hours (after this booking).
2. Clicks **"Book Time"**. (Pixel `content_type: "membership_booking"`.)
3. Server inserts `Bookings` row with `status="pending"`,
   `stripeProductId="none"`, `totalPrice=input.price`.
4. Because price is 0:
   - Booking updated to `status="success"`.
   - Google Calendar event created; id stored in `addDetails`.
   - **First** membership found for `(userId, roomId)` has
     `availableHours -= 4`.
   - "Membership Hours Used" email sent with remaining hours.
   - Redirect to `/user/profile`.

⚠️ Note that in this path `engineerStatus` stays `"pending"` and no booking
confirmation email is sent (only the usage email).

### 7.3 Membership booking with engineer (paid path)

Same as 7.2 through step 3, but `price = engineerPrice × 4 > 0`, so the server
creates a Stripe session and redirects. On webhook fulfilment (§12.1) the
booking is marked success, the calendar event is created, membership hours are
decremented by 4, and **both** the usage email and the booking confirmation
email are sent.

### 7.4 Admin booking

Admins (DB role) on `/booking` see the standard 16-slot grid for every room
(never block mode), no offer-code box, and an **"ADMIN BOOK"** button.

Server (`PostAdminBooking`):

1. Creates the Google Calendar event first (status `"success"`).
2. Inserts `Bookings` with `status="success"`, `engineerStatus="pending"`,
   `totalPrice=input.price`, `addDetails=<event id>`, `userId = input.user.id`
   (the admin's own id; there is no "book on behalf of" picker on this page —
   reassigning to a customer is done afterwards in the admin dashboard).
3. Sends the booking confirmation email to that user.
4. Redirects to `/user/admin`.

No payment, no membership decrement.

### 7.5 Cancel page (`/user/cancel/{id}`)

Rendering this page (Stripe's cancel URL) performs a delete:

- If `id` is a booking: delete **all `pending` bookings** with the same
  `roomId`, `date`, `startTime`, `endTime` (not just this id).
- If `id` is a membership: delete that membership row.

Then shows "Payment Cancelled". ⚠️ This is a GET with side effects and takes no
auth check beyond the `/user` login requirement.

### 7.6 Success page (`/user/success/{id}`)

Purely informational: "Payment Successful… A confirmation email will arrive
shortly." Link to `/user/profile`. It must **not** mutate anything (a previous
version did, and that was a payment-bypass bug).

---

## 8. Membership system

### 8.1 What a membership is

A prepaid bundle of studio hours in **one specific room**, consumed in 4-hour
blocks. Not a subscription: one-time payment, no renewal, no expiry
enforcement. `interval="month"` and the period fields are set but unused.

### 8.2 Purchase (`/user/membership/{roomId}`)

- Page lists a button per room; shows the selected room's image (with
  "Currently Unavailable" overlay if blocked → "Return to Booking" instead of
  purchase UI).
- Two selectable bundles: **16-Hour** ("4 × 4-hour sessions") and **8-Hour**
  ("2 × 4-hour sessions") with prices from Pricing. 16 is pre-selected.
- "Proceed to Purchase — $X.00":
  1. Requires login.
  2. Server recomputes price (§6.4).
  3. Inserts `Memberships` row: `status="pending"`, `availableHours=hours`,
     `planId=<env price id>`, `interval="month"`, period start/end = today.
  4. Stripe Checkout with the **membership id in the `bookingId` metadata
     field** (shared key).
- Webhook → `activateMembershipPayment` (§12.2).
- No check prevents buying a second membership for the same room. Multiple
  memberships per user per room can coexist; the booking code uses the
  **first** one found.

### 8.3 "Active" memberships (what the booking page and profile use)

```
status == "active"
OR (status == "cancelled" AND availableHours > 0)
```

ordered by `roomId`. So a cancelled membership with leftover hours can still
be used to book.

### 8.4 Weekly limit rule ⚠️ (implemented, effectively not enforced)

`getMembershipWeek(roomId, date, user)` returns `true` when the user already
has **any booking in that room during the Monday–Sunday week** containing the
selected date, unless the user has a membership in that room with
`weekMax=false`.

The UI only uses this result **when the room is also `blocked`**, and a
blocked room disables every slot anyway. So in practice the weekly limit never
changes what the user can do. The admin UI has no control for `weekMax`
(only the DB). Decide in the rebuild whether the intended rule ("members can
book at most one session per room per week unless exempted") should actually
be enforced.

### 8.5 Hours decrement

- Free membership booking: `-4` (duration) on the first membership for
  `(userId, roomId)` immediately.
- Any paid booking fulfilled by the webhook: `availableHours -= duration` on
  **every** membership for `(userId, roomId)`. ⚠️ This means a member who pays
  full price for a standard booking (e.g. a 6-hour session outside block mode
  is impossible for members, but an admin-mode user with a membership, or a
  membership-with-engineer booking) also has hours deducted. For the
  engineer path this is intended (4 hours). Hours can go negative; there is
  no floor.

### 8.6 Admin management of memberships

From the Users tab (§18.3):

- **Add**: creates `status="active"`, `planId="admin_created"`,
  `availableHours` as entered (default 16), period = today → +1 month.
  Rejected if an active membership already exists for that user+room.
- **Edit hours**: sets `availableHours` (must be ≥ 0), updates `updateHours`.
- **Remove**: sets `status="cancelled"` (soft delete; hours are retained and
  remain usable per §8.3).

---

## 9. Engineer add-on

Available on standard, membership and admin bookings after a time range is
selected. Per-room `engineerPrice` shown as "Engineering Fee: $X.00 per hour".

- Checkbox **"Add Engineer"** enables two selects:
  - **Start Time**: every slot in the booking **except the last one**
    (`startTime .. endTime-1` in 16-slot ids; for a membership block,
    `block*4 .. block*4+2`).
  - **Duration**: from **2** up to the number of hours remaining until the end
    of the booking from the chosen start. Example: booking slots 0–2 (3 h);
    start at slot 0 → durations {2, 3}; start at slot 1 → {2}.
- Stored as `engineerStart` (slot id) and `engineerTotal` (hours).
- Unchecking or changing the time selection resets both to `-1`.
- Price impact: see §6.1 / §6.2 (charged on booking duration, not engineer
  duration).
- `engineerStatus` becomes `"success"` when the webhook fulfils payment;
  otherwise stays `"pending"`. Nothing reads `engineerStatus` except the admin
  booking list (shows "Yes" if `engineerTotal > 0`).
- Booking summary shows Engineering Start Time, Engineering Duration and
  Engineering Total when `engineerTotal >= 1 && engineerStart >= 0`.
- Calendar event description includes `Engineer: N hours (starts at HH:00)`.

---

## 10. Offer codes

- Input box "Have an Offer Code?" on the booking page, **hidden for
  membership-mode and admin users**. Typed input is upper-cased.
- **Apply** → `POST /api/booking/validate-offer-code { code }` (public, no
  auth):
  - Not found → 404 "Invalid offer code"
  - Inactive → 400 "This offer code is no longer active"
  - OK → returns id, code, type, value, description; UI shows green
    "{CODE} applied — 20% off / $20.00 off" with an ✕ to remove.
- Discount line appears in the booking summary as "Discount (CODE) −$X.00".
- Server revalidates on submit: only applied if the code exists and is
  active; discount recomputed (§6.1). `offerCodeId` and `discountAmount`
  stored on the booking.
- Admin CRUD in §18.5.

---

## 11. Payments (Stripe)

One function builds every Checkout Session:

| Parameter                     | Value                                                                  |
| ----------------------------- | ---------------------------------------------------------------------- |
| `mode`                        | `payment` (one-time)                                                   |
| `customer`                    | user's `stripeCustomerId`                                              |
| `currency`                    | `cad`                                                                  |
| `line_items[0]`               | ad-hoc `price_data`, product name **"412 Studios Booking"** (also for memberships), `unit_amount = amountCents` (§6.5), quantity 1 |
| `metadata.bookingId`          | booking id **or** membership id                                        |
| `payment_method_types`        | `["card"]`                                                             |
| `billing_address_collection`  | `auto`; `customer_update: {address: auto, name: auto}`                 |
| `success_url`                 | `{domain}/user/success/{id}`                                           |
| `cancel_url`                  | `{domain}/user/cancel/{id}`                                            |
| `automatic_tax`               | disabled                                                               |

`domain` = `PRODUCTION_URL` in production, else `http://localhost:3000`.

The env `STRIPE_PRICE_ID_STANDARD_BOOKING` is stored on records but **not**
used as the Stripe line item.

### 11.1 Webhook (`POST /api/webhook/stripe`)

- Verifies `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`; 400 on failure.
- Handles `checkout.session.completed` only:
  1. Read `metadata.bookingId`.
  2. If a booking with that id exists → `fulfillBookingPayment(id)`.
  3. Else if a membership with that id exists → `activateMembershipPayment(id)`.
  4. Else log an error.
- `payment_intent.succeeded` is ignored. Other events logged.
- Any handler error → HTTP 500 so Stripe retries; handlers are idempotent.

---

## 12. Post-payment fulfilment

These run **only** from the verified webhook.

### 12.1 `fulfillBookingPayment(bookingId)`

1. Atomic claim: `UPDATE Bookings SET status='success', engineerStatus='success'
   WHERE bookingId=? AND status<>'success'`. If 0 rows → return (already done
   or unknown).
2. If `addDetails` is empty, create the Google Calendar event and store its id.
3. `UPDATE Memberships SET availableHours = availableHours - duration WHERE
   userId=? AND roomId=?` (all matching rows; `duration = endTime+1-startTime`).
4. If step 3 touched ≥1 row → send "Membership Hours Used" email.
5. Send "Booking Confirmation" email.

Email/calendar failures are logged and do not roll back the status change.

### 12.2 `activateMembershipPayment(membershipId)`

1. Atomic claim: set `status='active'`, `currentPeriodStart = 1st of this
   month`, `currentPeriodEnd = 1st of next month` where `status<>'active'`.
2. If claimed → send "Membership Confirmation" email.

---

## 13. Google Calendar integration

- Auth: service-account JWT (`GOOGLE_SERVICE_ACCOUNT_EMAIL`,
  `GOOGLE_PRIVATE_KEY` with `\n` unescaping), scope `calendar`, single
  calendar `GOOGLE_CALENDAR_ID`. No attendees (would require domain-wide
  delegation).
- **Event shape**:
  - `summary`: `"Studio {letter} - {user name | 'Booking'}"`
  - `start`/`end`: `YYYY-MM-DDTHH:00:00` with `timeZone: "America/Toronto"`.
    Start hour = `startTime + 8`; end hour = `endTime + 8 + 1`. Hour 24 rolls
    to 00:00 of the next day.
  - `description` (create):
    ```
    Studio: Studio A
    Client: {name}
    Email: {email}
    Duration: {n} hours
    Engineer: {n} hours (starts at {h}:00)     ← only if engineerTotal > 0
    Status: {status}

    Created via 412 Studios Booking System
    ```
    Update variant also includes `Price: ${totalPrice}` and ends "Updated via…".
- Event id is stored in `Bookings.addDetails`.
- **When events are touched**:

  | Trigger                                  | Action  |
  | ---------------------------------------- | ------- |
  | Webhook fulfilment (paid bookings)       | create  |
  | Free membership booking                  | create  |
  | Admin booking                            | create  |
  | Admin edits times / user / status        | update  |
  | Admin deletes booking                    | delete  |
  | Admin "Sync" button                      | create for up to 50 `success` bookings with empty `addDetails`, 100 ms apart, batches of 10 with 500 ms gaps |
  | Admin "Reset" button                     | clears `addDetails` on **all** `success` bookings (so Sync recreates them; old events are **not** deleted) |
  | Admin "Test" button                      | verifies env + fetches calendar metadata |

- All calendar failures are swallowed (logged) and never block a booking.

---

## 14. Email notifications

Sender: `412 Studios <{RESEND_FROM_EMAIL}>` via Resend. HTML + plain-text
versions. Shared wrapper: header image `/images/email-head.gif`, studio
address block with "Get Directions" button, contact block, copyright footer.

Constants used in templates:

| Constant       | Value                                    |
| -------------- | ---------------------------------------- |
| Address        | 412 Richmond St E, Toronto, ON M5A 1P8   |
| Support email  | alec@412studios.com                      |
| Phone          | 647-540-2321                             |
| Website        | https://412studios.ca                    |

| Template                   | Subject                                                     | Sent when                                              | Fields |
| -------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ | ------ |
| Booking confirmation       | `Your Studio Booking Confirmation - Studio {X}`             | Webhook fulfilment; admin booking                      | studio, date, time range, duration, "Engineering Services: Included/Not included", total price (template supports original price + discount lines but callers never pass them) |
| Membership confirmation    | `Your 412 Studios Membership Confirmation`                  | Membership activation                                  | studio, available hours, membership price (⚠️ always the 16-h price even for 8-h), billing cycle, status, valid-through (1st of next month) |
| Membership hours used      | `Membership Hours Used - 412 Studios`                       | Free membership booking; webhook fulfilment when user has a membership in that room | studio, date, time range, hours used, remaining hours, booking id |
| Booking reminder           | `Reminder: Your studio session is tomorrow at Studio {X}`   | Daily cron (§15.2)                                     | same as confirmation |

Admin test page `/user/admin/email-template` renders a preview and has four
buttons that send each template to the logged-in admin's own address.

---

## 15. Scheduled jobs

Both are HTTP endpoints (GET or POST, no auth) triggered by Vercel Cron.

### 15.1 Cleanup — every 30 minutes (`*/30 * * * *`) → `/api/cron/cleanup`

Delete `Bookings` where `status="pending"` and `createdAt < now − 15 min`.
Delete `Memberships` under the same condition. This is how abandoned checkouts
release their slots.

### 15.2 Reminders — daily 10:00 (`0 10 * * *`) → `/api/cron/reminders`

Find bookings with `date = tomorrow (YYYYMMDD)` and **`status = "confirmed"`**,
send the reminder email to each user.

⚠️ No code path ever sets `status="confirmed"` (paid bookings become
`"success"`), so **this job currently sends nothing**. The intent is clearly
"remind tomorrow's confirmed customers"; the rebuild should query `success`.

---

## 16. Public booking page UI behaviour

Route `/booking`, single page, sections top to bottom:

1. **Heading** "BOOK TIME".
2. **Membership banner** (non-admin members only): one line per active
   membership: studio letter, `status` upper-cased, remaining hours.
3. **STUDIOS**: three cards (desktop row / mobile carousel) with image,
   "Currently Unavailable" overlay when blocked, a **Studio {letter}** button
   (pressed state = selected), "Hourly rate: N | Day rate: N", and a link
   "Memberships — 16hr: $N · 8hr: $N" to `/user/membership/{id}`.
4. **SELECT DATE**: single-date calendar, past dates disabled, defaults to
   today.
5. **SELECT TIME**: fixed-height scrollable list of 16 slots (or 4 blocks in
   membership mode), with a spinner while loading, and a "CLEAR SELECTION"
   button (disabled when nothing selected). Booked slots use a distinct style
   and are not clickable.
6. **Engineering Fee** panel (§9); shows "No time selected" until a range is
   picked.
7. **Have an Offer Code?** panel (§10) — hidden in membership/admin mode.
8. **Booking Details / Membership Details** summary table and the action
   button:
   - Not logged in → "Login to Proceed to Payment" / "Login to Book Time".
   - Validation error → inline message instead of a button.
   - Otherwise "Proceed to Payment" / "Book Time" / "ADMIN BOOK"; shows
     "Redirecting…" while loading. During data loading the panel shows
     "Loading…".

Summary rows (standard): Studio, Date, Start Time, End Time, Booking Duration
(h), Booking Total (pre-cap `duration × hourly`), [Engineering Start Time,
Engineering Duration, Engineering Total], [Discount (CODE)], Total. All money
rendered as `$N.00 CAD`.

Summary rows (membership): Studio, Date, Start/End, Duration, [Available
Hours, Remaining Hours] (only if ≥4 hours available), [Engineering rows],
Total.

Selection resets: changing room resets date to today and clears time and
engineer; changing date clears time; changing time clears engineer.

---

## 17. User profile area

All under `/user/*` (login required).

| Route                        | Behaviour                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `/user/profile`              | Card with name/email; "Admin" link if DB role admin; "Membership" badge (⚠️ checks `status==="success"`, which never occurs, so never shows); if the user has any active membership: "View Bookings" and "Manage Memberships" (links back to profile — no management page exists); links: Settings, Book Now (if `isUserVerified`), Log Out. |
| `/user/profile/bookings`     | Table of the user's bookings with `date >= today`, ascending: Studio letter, long date, start time, end time (12-hour format). Includes pending bookings. |
| `/user/profile/settings`     | Name and email shown **disabled**; Submit re-saves name (no-op in practice).                         |
| `/user/profile/verification` | See §4.4.                                                                                            |
| `/user/membership/{room}`    | Membership purchase (§8.2).                                                                          |
| `/user/success/{id}`, `/user/cancel/{id}` | §7.6 / §7.5.                                                                            |

---

## 18. Admin dashboard

Route `/user/admin` (Kinde `admin` permission). A tabbed page: **Bookings ·
Users · Pricing · Offer Codes · Calendar**.

### 18.1 Bookings tab

**List view**

- Filters: room (All / A / B / C), "show previous" toggle (default hides
  bookings before today), free-text search on customer name.
- Columns: Room, Date (e.g. "Thu, Sep 18, 2026"), Start, End, User,
  Engineer (Yes / N/A), Details action. A duration helper exists but computes
  `end − start` (⚠️ one hour short of the real duration).

**Detail / edit view** for one booking:

- Customer: searchable dropdown (name/email) of all users → reassign.
- Status select: Pending / Success / Cancelled.
- Start time select (slot display start) and end time select (slot display
  end). Client rules: end > start and `end − start + 1 ≥ 2`; invalid picks
  snap back.
- Engineer: Yes/No; when Yes, start select limited to `[start, end)` and end
  select limited to `(engStart, end]`; shows computed hour count.
- **Save Changes** performs, in order, only the parts that changed:
  1. Times → conflict check `POST /api/booking/check-conflict` (any other
     booking in same room/date overlapping `[start,end]`, any status) → on
     conflict "Time conflict detected"; else `POST /api/booking/update-times`
     (server re-validates ≥2 h; writes `totalHours = end − start` ⚠️; updates
     calendar event).
  2. User → `POST /api/booking/update-user` (404 if user unknown; updates
     calendar).
  3. Status → `POST /api/booking/update-status` (accepts pending/success/
     cancelled/failed; updates calendar description). Changing status does
     **not** refund, decrement or restore membership hours, or send email.
  4. Engineer → `POST /api/booking/update-engineer`: `engineerTotal =
     end − start + 1` or `0`; `engineerStart` or `0`; `engineerStatus`
     `"pending"` or `"none"`. **Price is not recalculated.**
- **Reset** restores the form. **Delete** → server action: deletes the
  calendar event (if any) then the booking row. No email, no hours restored.

### 18.2 Creating bookings as admin

Done on the public `/booking` page (§7.4), then reassigned to the customer
here.

### 18.3 Users tab

- Loads all users with memberships (`GET /api/admin/users/detailed`).
- Filters: search name/email; membership filter All / Members / Non-members
  (member = has ≥1 `active` membership).
- Detail view: Name and Email displayed disabled; editable Phone, Bio, Social
  Links; Membership Status (read-only text: "No Membership" / "Member" /
  "Member (N studios)"); Membership Management list: per membership studio +
  hours input + remove; "Add" per room not already held (default 16 h).
- Save: `POST /api/admin/users/update` (validates email format, role in
  {user, admin}, unique email) then creates / cancels / updates memberships
  via the three membership endpoints (§8.6), then refreshes.

### 18.4 Pricing tab

Table with one row per room: Blocked checkbox, Day Rate, Hourly Rate,
Membership (16 h), Membership 8 h, Engineer Fee. Numeric-only inputs. Save →
`POST /api/admin/pricing/update` with the whole array (auth: **DB role**
admin). Browser `alert()` on result.

### 18.5 Offer Codes tab

- List with usage count (number of bookings referencing the code), active
  toggle, edit, delete.
- Create/edit form: code (upper-cased, unique), description, type
  percentage/fixed, value (percentage must be 0–100; never negative), active.
- Endpoints: `GET/POST /api/admin/offer-codes`, `PATCH/DELETE
  /api/admin/offer-codes/{id}`. Delete is hard; ⚠️ will fail at the DB level
  if any booking references the code (FK, no cascade).

### 18.6 Calendar tab

Three buttons: **Sync** (`POST /api/admin/calendar/sync`), **Test**
(`GET /api/admin/calendar/test`), **Reset** (`POST /api/admin/calendar/reset`).
See §13. Sync has a 60 s max duration.

### 18.7 Legacy admin pages (still routable, not linked)

- `/user/admin/pricing` — older full-page pricing form (server action; lacks
  the 8-hour price field).
- `/user/admin/membership` and `/user/admin/membership/{membershipId}` — list
  and edit hours; redirects to a non-existent `/admin/users/...` path after
  save. ⚠️ Broken.
- `/user/admin/users/{userId}` — per-user bookings/membership table.
- `/user/admin/email-template` — email preview + test send (§14).

A rebuild can drop the first three; keep the email test page if useful.

---

## 19. Marketing site

Single home page `/` with anchor sections, plus global navbar and footer.

- **Navbar**: HOME / STUDIOS / ARTISTS / CONTACT (smooth-scroll anchors on
  the home page), BOOK NOW → `/booking`, LOGIN (Kinde) or profile/admin links
  when authenticated. Collapsible on mobile.
- **Banner**: full-screen room render carousel (Studio A, Live Room, Lounge,
  Kitchen) that swaps between day and night imagery depending on the current
  time in Toronto; hotspot links ("Book Now") positioned by percentage
  coordinates; a live Toronto clock with the address overlay.
- **OUR STUDIOS**: carousel of studio photos with copy and a booking CTA.
- **ARTISTS**: roster cards (currently Rans Gundo, Sainty) with social links.
- **OUR ORIGIN**: history section with images.
- **CONTACT**: `Info@412studios.ca`, `647-540-2321`, Instagram, TikTok,
  YouTube, SoundCloud links.
- **Footer**: same socials/contact.
- A route-change loading overlay (excluded on `/api` and `/user/admin`).
- 404 page.
- Facebook Pixel id `1699908830923677`: `PageView` on load; `InitiateCheckout`
  on the three booking submit buttons with room, studio name, value (CAD),
  user email, booking date and hours.
- Site metadata: title "412 Studios", description "412 is an independent
  record label and studio based in Toronto, Canada.", base URL
  `https://www.412studios.ca/`.

---

## 20. Route map

### Pages

| Path                                  | Auth            | Purpose                       |
| ------------------------------------- | --------------- | ----------------------------- |
| `/`                                   | public          | Marketing home                |
| `/booking`                            | public (submit needs login) | Booking page      |
| `/user/profile`                       | user            | Profile hub                   |
| `/user/profile/bookings`              | user            | Upcoming bookings             |
| `/user/profile/settings`              | user            | Read-only profile             |
| `/user/profile/verification`          | user            | Verification form             |
| `/user/membership/{room}`             | user            | Buy membership bundle         |
| `/user/success/{id}`                  | user            | Stripe success landing        |
| `/user/cancel/{id}`                   | user            | Stripe cancel landing (deletes pending) |
| `/user/admin`                         | admin           | Dashboard (tabs)              |
| `/user/admin/email-template`          | admin           | Email preview/test            |
| `/user/admin/pricing`, `/user/admin/membership[/{id}]`, `/user/admin/users[/{id}]` | admin | Legacy |

### Server actions (called from the UI, not HTTP endpoints)

`getBooking(roomId, date)`, `getMembershipWeek(roomId, date, user)`,
`getAllBooking()`, `deleteBooking(id)`, `getPricing()`, `PostBooking(input)`,
`PostAdminBooking(input)`, `PostMembership({id, hours})`,
`PostMembershipBooking(input, start, end, duration)`.

### HTTP API

| Method | Path                                      | Auth                 |
| ------ | ----------------------------------------- | -------------------- |
| GET    | `/api/auth/*`                             | Kinde handlers       |
| POST   | `/api/webhook/stripe`                     | Stripe signature     |
| GET/POST | `/api/cron/cleanup`, `/api/cron/reminders` | none               |
| POST   | `/api/booking/validate-offer-code`        | none                 |
| POST   | `/api/booking/check-conflict`             | none ⚠️              |
| POST   | `/api/booking/update-times`               | Kinde admin          |
| POST   | `/api/booking/update-user`                | Kinde admin          |
| POST   | `/api/booking/update-status`              | Kinde admin          |
| POST   | `/api/booking/update-engineer`            | Kinde admin          |
| GET    | `/api/admin/users`                        | Kinde admin          |
| GET    | `/api/admin/users/detailed`               | Kinde admin          |
| POST   | `/api/admin/users/update`                 | Kinde admin          |
| POST   | `/api/admin/users/membership/create`      | Kinde admin          |
| POST   | `/api/admin/users/membership/update`      | Kinde admin          |
| POST   | `/api/admin/users/membership/delete`      | Kinde admin          |
| POST   | `/api/admin/pricing/update`               | DB role admin        |
| GET/POST | `/api/admin/offer-codes`                | Kinde admin          |
| PATCH/DELETE | `/api/admin/offer-codes/{id}`       | Kinde admin          |
| GET/POST | `/api/admin/calendar/sync`              | Kinde admin          |
| GET    | `/api/admin/calendar/test`                | Kinde admin          |
| POST   | `/api/admin/calendar/reset`               | Kinde admin          |

---

## 21. Environment configuration

| Variable                              | Purpose                                              |
| ------------------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`, `DIRECT_URL`          | Postgres                                             |
| `KINDE_CLIENT_ID`, `KINDE_CLIENT_SECRET`, `KINDE_ISSUER_URL`, `KINDE_SITE_URL`, `KINDE_POST_LOGOUT_REDIRECT_URL`, `KINDE_POST_LOGIN_REDIRECT_URL` | Auth |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Payments                                       |
| `STRIPE_PRICE_ID_STANDARD_BOOKING`    | Stored on records only                               |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Email                                                |
| `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Calendar |
| `PRODUCTION_URL`                      | Absolute URL for Stripe redirects and email images   |
| `NEXT_PUBLIC_GOOGLE_CALENDAR_ID`      | Declared, unused                                     |

---

## 22. Known quirks and rebuild decisions

Collected from the ⚠️ notes above. Each is a deliberate choice to make before
or during the rebuild.

**Booking model**

1. `endTime` is inclusive; duration is `end − start + 1`. Admin time edit
   stores `totalHours = end − start` and the admin list displays `end − start`
   (both one hour short). `totalHours` is never used for pricing.
2. Pending bookings block slots for up to 15 minutes; cleanup is a
   30-minute cron, so effective hold is 15–45 minutes.
3. No server-side double-booking check on customer submit.
4. Weekly membership limit is computed but never effectively enforced (§8.4).
5. Reminder cron queries `status="confirmed"`, which never exists (§15.2).
6. Cancelling in Stripe deletes **all** pending bookings for the same
   room/date/slot range, not just the caller's.

**Pricing**

7. Engineer fee is charged for the full booking duration, not the chosen
   engineer hours.
8. Day-rate cap applies only at exactly 16 hours.
9. Membership-booking price and admin-booking price are trusted from the
   client (standard bookings and membership purchases are recomputed server
   side).
10. 13 % tax hard-coded; Stripe product name is always "412 Studios Booking"
    even for memberships.

**Memberships**

11. One-time purchase labelled `interval: month`; no renewal, no expiry, period
    fields unused.
12. Webhook decrements hours on **all** memberships for the user+room, and
    for any paid booking by a member in that room (not just block bookings).
    Hours can go negative.
13. Cancelled memberships with hours remain bookable.
14. Duplicate memberships per user+room are possible via purchase (admin
    create prevents it).
15. Membership confirmation email always reports the 16-hour price.

**Auth / roles**

16. Two admin sources of truth (Kinde permission vs DB role). Pricing update
    and all admin-mode booking UI use the DB role; everything else uses Kinde.
17. `check-conflict` and `validate-offer-code` are unauthenticated.
18. Verification flow exists but gates nothing (`isUserVerified` defaults
    true).

**UI dead ends**

19. Profile "Membership" badge checks a status that never occurs; "Manage
    Memberships" links to itself; settings form is read-only.
20. Legacy admin pages under `/user/admin/pricing|membership|users` are
    partially broken and unlinked.
21. Offer-code delete will fail if the code has ever been used (FK).
22. Rooms are hardcoded to A/B/C (ids 0/1/2) in several UI components.
