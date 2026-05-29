# Samuh Lagna & Fund Management — Shree Sagar Samaj, Junagadh

MERN app (React + Vite + Tailwind / Node + Express / MongoDB) that digitizes donation
collection, donor records, slips, cash handover/reconciliation, Excel import, and an
append-only audit trail. Gujarati-first UI. Wraps into an Android APK via Capacitor.

/ શ્રી સગર જ્ઞાતિ સમાજ વિભાગ, જૂનાગઢ · રજી. નં. એ/૧૬૦૩

## Repo layout

```
/server   Express API (Mongoose models, routes, middleware, seed)
/client   React + Vite front-end (admin desktop + sub-admin/donor mobile-first)
/mobile   Capacitor config (added in the deploy phase)
```

## Prerequisites
- Node 18+ (tested on Node 22)
- A MongoDB database (MongoDB Atlas M0 is fine)
- A Cloudinary account (for document/receipt/photo uploads)

## 1) Server setup

```bash
cd server
cp .env.example .env      # then fill in real values (see below)
npm install
npm run seed              # creates the admin user + schemes + Samuh Lagna form v1
npm run dev               # starts on http://localhost:5000  (GET /health to check)
```

### server/.env

| Var | Meaning |
|---|---|
| `PORT` | API port (default 5000) |
| `NODE_ENV` | `development` / `production` (prod hides error stacks) |
| `MONGODB_URI` | Full Mongo connection string **including the DB name** `samuh_lagna`. URL-encode the password. |
| `JWT_SECRET` | Long random string. **Change before prod.** |
| `JWT_EXPIRES_IN` | e.g. `7d` |
| `SEED_ADMIN_NAME` | Display name for the first admin |
| `SEED_ADMIN_LOGIN` | The login identifier for the admin (e.g. `admin@gmail.com`) |
| `SEED_ADMIN_PASSWORD` | The admin's password (used once by the seed) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | File storage |
| `CORS_ORIGINS` | Comma-separated allowlist. Includes the Capacitor origins `capacitor://localhost` and `https://localhost`. |

> **Sandbox note:** `mongodb+srv://` needs DNS SRV resolution. Some restricted networks
> block it; run on a normal network/your machine.

## 2) Client setup

```bash
cd client
cp .env.example .env      # set VITE_API_URL (default http://localhost:5000)
npm install
npm run dev               # http://localhost:5173
```

### client/.env
| Var | Meaning |
|---|---|
| `VITE_API_URL` | Base URL of the API. **Used everywhere via axios.** In prod, point at your Render URL. Never use relative `/api` (the APK needs an absolute URL). |

## Roles & main flows
- **Admin** (desktop): log in, manage sub-admins, confirm UPI/cheque payments, review &
  confirm cash handovers, import historic Excel, view/export the audit log, configure UPI.
- **Sub-admin** (mobile): log in, issue slips (geography-scoped to assigned villages),
  submit cash handovers.
- **Donor** (no login): open `/donate`, donate by UPI QR (named or anonymous), mark "I've
  paid" + optional screenshot, get a receipt. Office confirms payment manually.

## Money policy
Stored as **2-decimal-place rupees**. All arithmetic goes through `lib/money.js`
(server) / `lib/clientMoney.js` (client), which sum via integer paise to avoid float drift.

## UPI
No payment gateway. The donation QR is a `upi://pay?...` deep link built from admin
Settings (`payeeVpa`, `payeeName`, note). Donors pay in their UPI app, then tap "I've
paid"; the slip stays `paymentConfirmed=false` until the office confirms. Auto-verification
would require a gateway (Razorpay/Cashfree) — future phase.

## Security
bcrypt password hashing; JWT from env; RBAC enforced server-side on every protected route;
sub-admins are geography-scoped; helmet + CORS allowlist + rate limiting on auth and the
public donation route; Mongo-injection sanitized; uploads type/size validated; no hard
deletes (void/archive + reason); append-only audit log; no secrets in the client bundle.

## Build for production
```bash
cd client && npm run build        # outputs /client/dist
```

## Phases implemented (MVP)
0 setup · 1 auth/RBAC · 2 public donation + UPI · 3 sub-admin slips + handover/reconciliation ·
4 Excel import (dynamic headers, idempotent) · 11 audit log.
Follow-ups (5–10, 12, 13 deploy + APK) are scoped in the build prompt.
