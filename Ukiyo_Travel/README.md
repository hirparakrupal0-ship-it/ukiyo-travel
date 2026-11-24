# Ukiyo Travel — integrated project

One project, three parts, **one shared backend and one MongoDB database**:

| Part | Folder | Default URL | What it is |
|---|---|---|---|
| **User Panel** | `user-panel/` | http://localhost:3000 | The travel website (Ukiyo Travel Smart): destinations, packages, hotels, booking, payment, My Trips, reviews |
| **Admin Panel** | `admin-panel/` | http://localhost:3001 | The Command Center: dashboard, bookings, payments & refunds, reviews moderation, customers, enquiries, catalogue |
| **Backend API** | `backend/` | http://localhost:5000 | One Express + Mongoose app serving both panels |

Both panels keep their original design, pages and assets (vanilla HTML/CSS/JS + Bootstrap). They are separate sites on separate ports with separate login sessions, and talk only to the backend.

## Requirements
- Node.js 18+
- A MongoDB database (local `mongod` or a free MongoDB Atlas cluster)

## Install and run
```bash
cp .env.example .env            # then edit: MONGO_URI, JWT_SECRET, ADMIN_PASSWORD (+ Razorpay keys if you have them)
npm run install:all             # installs the backend dependencies (the panels need none)
npm run seed:admin              # creates the first admin account (ADMIN_EMAIL / ADMIN_PASSWORD from .env)
npm run dev:all                 # starts backend + user panel + admin panel together
```
Open http://localhost:3000 (customers) and http://localhost:3001 (admin sign-in). Ctrl+C stops all three.

`npm run dev:all` checks that ports 5000/3000/3001 are free first and prints a clear message instead of crashing with `EADDRINUSE`. Change ports in `.env` (`PORT`, `USER_PORT`, `ADMIN_PORT`).

Run pieces separately (three terminals): `npm run start:backend`, `npm run start:user`, `npm run start:admin`.

## Configuration (`.env`)
Everything is in one root `.env` (see `.env.example`, which documents every variable). No secret is stored in the code or in the frontends: the panels only receive public URLs through a generated `config.js`.
Important: `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` (the two panel origins allowed by CORS), `API_URL` / `USER_PANEL_URL` / `ADMIN_PANEL_URL`, Razorpay keys, `DEMO_PAYMENTS`.
If you change a port or host, update `CLIENT_ORIGIN`, `API_URL`, `USER_PANEL_URL`, `ADMIN_PANEL_URL` to match.

## How the pieces fit together
- **Accounts & roles** — one `User` collection. Customers register on the User Panel. The Admin Panel signs in with `portal: "admin"`; accounts without the `admin` role are refused, and every `/api/admin/*` route re-checks the role from the database on each request (regular users get 403, bad/missing tokens 401).
- **Bookings** — created on the User Panel as *Pending Payment*; they become *confirmed* only after a verified payment. Admin manages them under Bookings.
- **Payments** — one `Payment` record per attempt (pending / paid / failed / cancelled / refunded). A unique index guarantees a single paid payment per booking (double-submit safe). Dashboard revenue = sum of **paid** payments only; refunds and cancellations are excluded.
  - With `RAZORPAY_KEY_ID/SECRET` set: real Razorpay checkout; signatures verified on the server (HMAC); optional webhook `POST /api/payments/webhook` (`RAZORPAY_WEBHOOK_SECRET`); admin refunds call Razorpay.
  - Without keys: built-in **sandbox gateway** (nothing is charged). Success: any valid UPI id / card `4242 4242 4242 4242` / any bank. Decline: a UPI id containing `fail` (e.g. `test@fail`) or card `4000 0000 0000 0002`. In production it is off unless `DEMO_PAYMENTS=true`.
- **Reviews** — a customer reviews a *confirmed* trip from **My Trips** → saved as *pending* → admin approves/rejects under Reviews → only **approved** reviews appear in "Traveller Reviews" on the User Panel, and only approved ones count toward averages.
- **Catalogue** — destinations/packages/hotels live in MongoDB (seeded once from `backend/seed/catalog.seed.json`) and are editable in the Admin Panel.
- **Existing data** — old records from either original project are brought up to date automatically at startup (idempotent, non-destructive; disable with `AUTO_MIGRATE=false`; manual: `npm run migrate` to preview, `npm run migrate:apply`).

## Folder layout
```
Ukiyo_Travel/
├─ user-panel/    index/login/register/profile .html, css, js/, assets/, server.js (static server)
├─ admin-panel/   index.html (Command Center), login.html, admin.css, js/, assets/, server.js
├─ backend/       app.js, server.js, config/, models/, controllers/, routes/, services/, middleware/, utils/, seed/, tests/
├─ scripts/       dev-all.js (launcher), static-server.js, load-env.js
├─ .env.example   package.json   .gitignore   README.md
```

## Tests
`npm test` runs the backend unit/route tests (no database needed). `npm run test:integration` runs the full API integration suite. It **wipes the database it connects to**, so it refuses to run unless the database name ends in `_test` — run e.g. `MONGO_URI=mongodb://127.0.0.1:27017/ukiyo_travel_test npm run test:integration` (it never touches your `.env` database).

## Production notes
Set a strong `JWT_SECRET`, real `ADMIN_PASSWORD`, Razorpay **live** keys, `NODE_ENV=production`, and serve both panels behind HTTPS with `CLIENT_ORIGIN` / `API_URL` set to the public URLs. The included panel servers are minimal static servers; any static host (nginx, Netlify, …) also works as long as it serves a `config.js` that sets `window.UKIYO_CONFIG` (see the generated one at `http://localhost:3000/config.js`).
