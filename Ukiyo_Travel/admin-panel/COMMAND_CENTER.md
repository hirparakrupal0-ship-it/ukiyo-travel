# Ukiyo Travel Command Center — notes

## Run it
```bash
cd server
npm install
cp .env.example .env        # only if you don't already have a .env; keep your own MONGO_URI / JWT_SECRET
npm run seed:admin          # creates/promotes the admin from ADMIN_EMAIL / ADMIN_PASSWORD in .env
npm run migrate:bookings    # ONLY if you already have bookings: dry run; add --apply to write
npm start                   # http://localhost:5000  (SERVE_FRONTEND=true serves the site too)
npm test                    # logic tests (no database needed)
```
Open http://localhost:5000, log in with the admin account, then **Admin** in the navbar (or `/admin.html`).
On first start the catalog (6 destinations, 3 packages, 6 hotels from `js/data.js`) is copied into MongoDB. Existing collections are never overwritten.

**Admin login:** whatever `ADMIN_EMAIL` / `ADMIN_PASSWORD` are in your `.env` (the example file uses `admin@ukiyo.com` / `Admin@123` — change it).

## Environment variables
Unchanged: `PORT, NODE_ENV, MONGO_URI, JWT_SECRET, JWT_EXPIRES_IN, CLIENT_ORIGIN, SERVE_FRONTEND, ADMIN_EMAIL, ADMIN_PASSWORD`.
New (optional): `APP_TIMEZONE` (default `Asia/Kolkata`) — decides what "today" means for the past-date rule and analytics.
No secret is ever sent to the browser; the frontend only knows the API address.

## Database changes
| Collection | Change |
|---|---|
| bookings | + `reference, amount, unitPrice, destinationSlug/Name, paymentStatus, paidAt, cancelledAt` (all optional) |
| users | + `isActive` (default true), `lastLogin` |
| enquiries | + `status` (new/handled), `handledAt` |
| payments | **new** — one doc per payment attempt |
| reviews | **new** — one per confirmed booking; `approved`/`hidden` |
| destinations, packages, hotels | **new** — catalog, seeded from `js/data.js`; `isActive, isFeatured, priority` |
| banners | **new** — homepage banners / promo strips |
| alertstates | **new** — which alerts each admin has read/cleared |

## Rules enforced on the server
* Booking is created as **Pending Payment**; only a successful payment sets **Confirmed** and issues `UKY-<year>-XXXXX`. Admin can't confirm an unpaid booking either.
* Failed payment: booking stays Pending Payment, **Retry Payment** appears in My Trips.
* Price is taken from the catalog, never from the browser.
* Past travel dates are rejected by the API (`Please select today or a future date.`) and disabled in every date input (`js/date-rules.js`; "today" comes from the server clock, falling back to the visitor's).
* 401 (or a deactivated account) → login. 403 → "no admin access". 400/409/500/network → a message, no redirect.
* Deactivated users can't log in and their existing tokens stop working.

## Payments are a sandbox
`server/utils/gateway.js` simulates a gateway; **no real money moves**. Test: card `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined, UPI `fail@upi` is declined, bank "Test Bank – Down" fails. Only masked details are stored. To go live, replace `charge()` with Razorpay/Stripe (keep the return shape).

## New API endpoints
Public: `GET /api/catalog`, `GET /api/reviews`.
User (JWT): `GET /api/bookings/:id`, `GET /api/bookings/payment-options`, `POST /api/bookings/:id/pay`, `POST /api/reviews`. `DELETE /api/bookings/:id` now **cancels** (keeps history, refunds if paid).
Admin (JWT + admin): `GET /api/admin/{dashboard,trending,insights,calendar,calendar/day,alerts,payments,payments/:id,reviews,users/:id,catalog/:type}`,
`POST /api/admin/{alerts/state,alerts/state-all,payments/:id/refund,catalog/:type,catalog/:type/reorder}`,
`PATCH /api/admin/{users/:id/active,enquiries/:id,reviews/:id,catalog/:type/:id/flags}`, `PUT /api/admin/catalog/:type/:id`, `DELETE /api/admin/{reviews/:id,catalog/:type/:id}`.
`:type` = `destinations | packages | hotels | banners`.

## Files
New: `server/models/{Payment,Review,Destination,Package,Hotel,Banner,AlertState}.js`, `server/controllers/{paymentController,reviewController,catalogController,analyticsController}.js`, `server/routes/{reviewRoutes,catalogRoutes}.js`, `server/utils/{dates,money,reference,gateway,catalog,bookingOps,analytics,insights,alertsEngine}.js`, `server/seed/migrateBookings.js`, `server/tests/*`, `js/date-rules.js`, `js/admin-{core,dashboard,ops,people,catalog,settings}.js`.
Modified: `server/{server.js,package.json,.env.example}`, `server/models/{Booking,User,Enquiry}.js`, `server/controllers/{adminController,authController,bookingController,userController}.js`, `server/routes/{adminRoutes,bookingRoutes}.js`, `server/middleware/{authMiddleware,errorMiddleware}.js`, `server/utils/publicUser.js`, `admin.html`, `admin.css`, `pages.css`, `index.html`, `profile.html`, `login.html`, `register.html`, `js/{auth-api,data,site}.js`.
Removed: `js/admin.js` (replaced by the `admin-*.js` modules).

## Testing checklist
1. Register a customer; book a package with today's date → payment screen appears; try yesterday → blocked in the picker and by the API.
2. Pay with `4000 0000 0000 0002` → "Payment Failed", booking still Pending Payment, **Retry Payment** in My Trips.
3. Retry with `4242 …` → Confirmed, `UKY-…` reference, ticket. In admin the booking, payment (Paid) and revenue update.
4. Admin → Bookings: Confirmed is disabled for unpaid bookings. Cancel a paid one → payment becomes Refunded.
5. Calendar: click a date; switch travel/booking basis. Trending, Insights and Alerts change as data changes (and say "Not enough data…" when empty).
6. Customer rates a confirmed trip (My Trips → Rate) → Reviews page; Hide it → disappears from `GET /api/reviews`.
7. Featured Content: feature a destination, deactivate a hotel, add a banner, reorder → reload the homepage.
8. Users: open a profile, deactivate → that user's next request returns 403 and login is refused.
9. Stop the server → admin shows "Unable to reach the server" with Try again, **not** the login page.
10. Resize to phone width: sidebar becomes a slide-in menu; tables scroll horizontally.

## Known limitations
* Payments are simulated (see above). No emails/SMS or PDF tickets are sent.
* Only one image URL per item (no file uploads). Reviews can't be edited by customers.
* "Low availability" alert is not implemented because the project has no inventory model.
* Existing hotel/package ids must stay unique; ids and slugs can't be renamed after creation (bookings reference them).
* Alerts refresh every 60 s while the admin is open; there is no push/email.
* The admin chart helpers are hand-written SVG (no chart library), so charts are simple by design.
