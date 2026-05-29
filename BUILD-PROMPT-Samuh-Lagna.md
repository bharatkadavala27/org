# BUILD PROMPT — Samuh Lagna & Fund Management App (MERN + Capacitor)

> Paste this into your coding agent. Build **phase by phase**, in order. After every phase, run the app and complete that phase's Self-Review Checklist before moving on. Do not skip ahead. Do not leave TODOs or stubbed functions in a phase you've marked done.

---

## 0. Your role & working discipline

You are a senior full-stack engineer with 10+ years of experience. You are careful, you re-read your own code before declaring anything done, and you care about the end user — who is often low-tech-literacy and reading Gujarati on a phone. Follow these rules on every phase:

1. **Plan before coding.** State what you'll build, the files you'll touch, and the acceptance criteria you're targeting.
2. **Build in small commits**, one logical unit at a time.
3. **Run it.** After each unit, actually start the app and exercise the feature — happy path, empty state, error path, and one edge case.
4. **Re-read your diff** as if reviewing a junior's PR. Look specifically for: unhandled promise rejections, missing input validation, missing loading/empty/error UI, hardcoded values that should be env vars, and any place that could throw on null/undefined.
5. **Never leave a broken build.** Each phase ends with the app running.
6. **No silent failures.** Every API call has try/catch and surfaces a human-readable error to the UI.
7. **Ask, don't assume,** only for the items in §14. Everything else, make the sensible call and note it.

---

## 1. Product context

Client: **Shree Sagar Samaj, Junagadh** (a community trust). They run an annual **Samuh Lagna** (mass community wedding) and welfare schemes (e.g., **Kuvarbai nu Mameru**). Today everything is cash, paper receipt books, and yearly Excel sheets.

The app digitizes: donation collection, donor records, the annual account statement (**Aheval**), and couple/scheme document handling.

- **Language:** Gujarati-first UI for donor and sub-admin screens; Gujarati labels on slips and the Aheval. Admin screens may be Gujarati + English. Store all names in original Gujarati script.
- **Branding:** community logo (provided), name "શ્રી સગર જ્ઞાતિ સમાજ વિભાગ, જૂનાગઢ", reg no. એ/૧૬૦૩.
- **Users:** Admin (trust office, desktop), Sub-admin (village fund collector, mobile), Donor (no login). Couples/beneficiaries are records, not logins.

---

## 2. Locked tech stack & repo structure

Do not substitute these.

- Frontend: **React + Vite** + **Tailwind CSS** (+ shadcn/ui optional). React Router. React Query (TanStack) for data fetching.
- Backend: **Node.js + Express**.
- DB: **MongoDB** via **Mongoose** (MongoDB Atlas in prod).
- Auth: **JWT** (access token) + **bcrypt** password hashing. Roles: `admin`, `subadmin`.
- File storage: **Cloudinary** (documents, receipts, photos). Never store binary files in Mongo.
- Excel: **SheetJS (`xlsx`)** in the browser.
- QR: **`qrcode`** package. UPI via deep link (no gateway).
- PDF: **`pdfmake`** or **`@react-pdf/renderer`**, with an embedded Gujarati font (Noto Sans Gujarati).
- Mobile: **Capacitor** wrapping the React build into an Android APK.
- Deploy: frontend on **Vercel/Netlify**, backend on **Render** (free), DB on **Atlas M0**.

Repo layout:
```
/server        Express API
  /src
    /models    Mongoose schemas
    /routes    Express routers
    /middleware  auth, rbac, errorHandler, audit
    /lib       cloudinary, db, jwt helpers
    /seed      seed script (admin user, schemes)
    app.js  server.js
/client        React + Vite
  /src
    /api       axios instance + per-resource calls
    /components
    /pages
    /hooks
    /lib       i18n, validators, upi, excel
    /context   auth context
/mobile        Capacitor config (added later)
.env files documented in README, never committed
```

**Config rule:** the API base URL lives in `VITE_API_URL`. Use it everywhere (axios `baseURL`). No relative `/api` calls — this is required for the Capacitor APK to work.

---

## 3. Global quality bar (apply to every screen)

- **Loading / empty / error states** on every list and form. No blank screens.
- **Confirm dialogs** for any irreversible or money/permission action (void slip, confirm handover, approve expense, merge donor). Show what will happen.
- **Validation** both client (inline messages) and server (reject + clear error). Never trust the client.
- **No hard deletes** of slips, donors, registrations, expenses, or audit rows. Use `status`/`archived` + a void reason.
- **Audit everything** that changes money, documents, users, or permissions (see §5 AuditLog, §Phase 11).
- **Mobile-first** for donor and sub-admin pages: large tap targets, single-column, minimal typing, Gujarati labels.
- **Money is integer paise or 2-dp decimal stored consistently** — pick one and document it; never float-add rupees loosely.
- **Never store** card numbers, bank account numbers, CVV, or full IDs in plain fields. UPI = reference strings only.
- **Accessibility basics:** labels tied to inputs, sufficient contrast, focus states.

---

## 4. Data model (Mongoose)

Implement these with timestamps and indexes noted. Refine fields as phases require, but keep names stable.

- **User**: `name, phone(unique), passwordHash, role('admin'|'subadmin'), status('active'|'disabled')`.
- **VillageAssignment**: `userId(ref User), village, taluka, jilla`. Index `userId`.
- **Donor**: `name, fatherOrHusbandName, village, taluka, jilla, mobile?, mergedIntoId?(ref Donor), archived(bool)`. Text index on `name`; index `{village}`.
- **Slip**: `slipId(unique), bookNumber?, donorId(ref Donor)?, isAnonymous(bool), schemeId(ref Scheme), year, amount, paymentMode('cash'|'upi'|'cheque'), paymentRef?, paymentConfirmed(bool), collectedBy(ref User), status('active'|'void'), voidReason?, issuedAt`. Index `{schemeId,year}`, `{donorId}`, `{collectedBy}`.
- **Handover**: `subAdminId(ref User), slipIds([ref Slip]), expectedTotal, receivedTotal, variance, status('submitted'|'confirmed'|'disputed'|'resolved'), confirmedBy(ref User)?, note?`. A slipId may appear in only one `confirmed` handover (enforce in code).
- **Scheme**: `name, type('samuh_lagna'|'mameru'|'other'), active(bool)`.
- **FormTemplate**: `schemeId(ref Scheme), version(int), fields([{key,label,type,required,validation,order}]), active(bool)`. type ∈ text|number|date|select|file|checkbox.
- **Registration**: `schemeId, year, side('groom'|'bride'|'na'), formTemplateVersion, values(Object), coupleId?(ref Couple), status('draft'|'submitted'|'verified'|'rejected')`.
- **Couple**: `year, groomRegistrationId, brideRegistrationId, village, registrationNo(patrika no), status`.
- **Document**: `registrationId(ref Registration), type, fileUrl, version(int), status('pending'|'verified'|'resubmit'), rejectReason?, expiryDate?`.
- **Expense**: `schemeId, year, category, amount, vendor, receiptUrl, gstNumber?, taxAmount?, status('submitted'|'approved'|'rejected'), submittedBy, approvedBy?`.
- **Budget**: `schemeId, year, category, plannedAmount`.
- **AuditLog**: `ts, userId, role, action, entityType, entityId, before?, after?`. Append-only; never update/delete. Index `{ts}`, `{role}`, `{action}`.
- **Setting**: `key, value` (used for UPI config, theme/homepage config). Single source for admin-configurable values.

Seed script must create: one admin user (credentials from env), and default schemes (Samuh Lagna, Mameru) with a starter Samuh Lagna couple FormTemplate v1 (see §Phase 5 for fields taken from the real registration form).

---

## 5. Build phases

Each phase has: **Goal → Build → UX → Acceptance Criteria → Self-Review Checklist.** Mark a phase done only when every acceptance criterion passes and every checklist item is verified by actually running the app.

> Phases 0–4 + 11 = the MVP that replaces the most painful manual work. Phases 5–10, 12 are follow-ups. Build in order; you can stop and ship after Phase 4 + 11 if time is short.

### Phase 0 — Project setup
**Goal:** Both apps run locally and talk to each other.
**Build:** Scaffold `/server` (Express, Mongoose, dotenv, cors, helmet, morgan, a global error handler, a `/health` route) and `/client` (Vite + React + Tailwind + React Router + React Query + axios instance using `VITE_API_URL`). Connect to a local/Atlas Mongo. Write the README with all env vars. Add the seed script.
**Acceptance:** `GET /health` returns ok; client renders a page that successfully calls `/health`; seed creates the admin + schemes.
**Self-Review:** env vars documented and not committed; CORS configured; error handler returns JSON `{message}` not stack traces in prod; app starts with zero console errors.

### Phase 1 — Auth & RBAC
**Goal:** Admin and sub-admins log in; routes are protected by role and (for sub-admins) by assigned geography.
**Build:** Register/login endpoints (admin creates sub-admins; no public signup). JWT issue + verify middleware. `requireRole(...)` and `requireAssignedVillage` middleware. Client: login page, auth context, protected routes, role-based nav, logout, token refresh-or-expire handling.
**UX:** Phone + password login (large fields, Gujarati labels, show/hide password). Clear "wrong credentials" message. Auto-redirect by role after login.
**Acceptance:** sub-admin cannot hit admin-only endpoints (403); sub-admin queries return only their assigned villages' data; expired/invalid token → forced re-login.
**Self-Review:** passwords bcrypt-hashed (never returned in any response); JWT secret from env; every protected route actually checks the middleware; test the 403 and the expiry paths by hand.

### Phase 2 — Donor donation (public, no login) + UPI
**Goal:** A donor opens a public link, identifies themselves (or stays anonymous), and donates via UPI QR.
**Build:** Public donation page. Donor types name + mobile + village (typeahead suggests existing donors to avoid dupes) OR ticks "anonymous". On submit, create a Donor (unless anonymous/existing) and a Slip with `paymentMode='upi'`, `paymentConfirmed=false`. Generate the UPI QR (see §6). After scanning, donor taps "I've paid" and optionally uploads a payment screenshot (Cloudinary) → slip flagged for admin/sub-admin confirmation. Admin endpoint to confirm payment → `paymentConfirmed=true`.
**UX:** Gujarati, single column, big amount field with quick-pick chips (₹101 / ₹501 / ₹1100 / custom). Show the QR large with the trust name + amount. Success screen shows slip number and a "save/share receipt" button (PDF/image). Make clear payment is confirmed by the office.
**Acceptance:** QR opens a UPI app pre-filled with payee + amount; anonymous donation works without name; existing-donor typeahead prevents an obvious duplicate; slip is created and visible to admin as "payment unconfirmed".
**Self-Review:** UPI deep link string is correct and URL-encoded; amount validated > 0; no payment auto-marked paid; screenshot upload size/type validated; XSS-safe rendering of donor input.

### Phase 3 — Sub-admin slip entry + handover & reconciliation
**Goal:** Sub-admin issues cash slips and reconciles cash with the admin.
**Build:** Sub-admin slip form (donor fields + amount + scheme + payment mode + optional physical book number). Slip list filtered to their villages. Handover: select slips → system computes `expectedTotal` → sub-admin enters `receivedTotal` → submit. Admin: review handover, see `variance`, confirm/dispute. Enforce a slip can be in only one confirmed handover.
**UX:** Mobile-first slip form, minimal typing, donor typeahead, instant slip PDF/share after save. Handover screen shows running total clearly; variance shown in red if non-zero with a required note.
**Acceptance:** sub-admin sees only own data; expected total = sum of selected active slips; confirming a handover locks those slips; voiding a slip records a reason and removes it from expected totals (and flags if already in a confirmed handover).
**Self-Review:** money summed with the agreed precision; concurrency — two handovers can't both claim the same slip; void path audited; test variance both zero and non-zero.

### Phase 4 — Excel import with dynamic headers
**Goal:** Import 5 years of inconsistent donor/slip Excel files.
**Build:** Admin upload (.xlsx/.csv) → SheetJS parses → read **row 1 as headers** → show a **column-mapping UI** (map each source header to a system field; remember mappings) → **preview** parsed rows with validation → on commit, run donor dedup (§Phase 8 matching, suggest don't auto-merge) → insert. Make it **idempotent** via a per-row hash so re-importing the same file doesn't duplicate. Produce a downloadable **error report** for bad rows.
**UX:** Stepper: Upload → Map columns → Preview & fix → Import → Result summary (X imported, Y skipped duplicates, Z errors). Show progress for large files.
**Acceptance:** a messy real sheet (e.g., columns: ક્રમ / નામ / ફાળો / ગામ) maps and imports; re-import imports zero new rows; bad rows are reported, not silently dropped.
**Self-Review:** parsing handles empty cells, merged header quirks, Gujarati text, and number-vs-string amounts; import wrapped so a mid-file error doesn't leave half-written state (batch + report); import is audited.

### Phase 5 — Couple/beneficiary registration + dynamic form builder
**Goal:** Register couples (groom + bride) and scheme beneficiaries against configurable forms.
**Build:** Admin form builder (add/reorder fields, set type + validations, version on change). Registration screens render the active FormTemplate. Link groom + bride registrations into a Couple with a registration/patrika number. Seed the Samuh Lagna couple form from the **real registration card** fields:
`patrika no, side(groom/bride), photo, full name, father name, date of birth, age, full address, village, taluka, jilla, mobile, education, witness name, witness mobile`.
**UX:** Photo capture/upload, date pickers, Gujarati labels, save-as-draft, clear required-field errors. Show couple as a paired card (groom | bride).
**Acceptance:** editing a form doesn't corrupt older submissions (version pinned on the registration); a couple shows both sides; required validations enforced server-side.
**Self-Review:** form versioning actually works (change a field, old record still renders with old schema); file uploads validated; values stored as a clean object.

### Phase 6 — Document verification
**Goal:** Field-level document verification with resubmission.
**Build:** Inline PDF/image viewer. Per-document status Pending/Verified/Resubmit with a reason. Field-level rejection (reject one document without failing the whole registration). Resubmission reopens that item and keeps version history. Optional expiry date per document with an "expiring soon" dashboard.
**UX:** Side-by-side: document viewer + verify/reject controls. A "Resubmit" stamp is obvious. Family-facing status list shows exactly what's pending/rejected and why.
**Acceptance:** rejecting one document leaves others verified; resubmit creates v2 and preserves v1; registration becomes 'verified' only when all required docs are verified.
**Self-Review:** signed/limited file access (documents not publicly guessable URLs); status transitions audited; viewer handles large PDFs and missing files gracefully.

### Phase 7 — Expense management
**Goal:** Track and approve event expenses with budget vs actual.
**Build:** Expense entry (category, amount, vendor, GST/tax, receipt upload) submitted by sub-admin/admin → admin approves/rejects. Budget per category/year. Variance view (planned vs approved actual).
**UX:** Category dropdown (Venue, Catering, Decoration, Gifts, Admin, Misc — admin-editable), receipt thumbnail, clear approve/reject with reason, variance shown with color.
**Acceptance:** only admin approves; approved totals feed the variance and the Aheval; receipt required to submit.
**Self-Review:** GST/tax math correct; rejected expenses excluded from totals; approval audited.

### Phase 8 — Donor dedup & merge
**Goal:** Unify duplicate donors.
**Build:** Matching on normalized `name + fatherOrHusbandName + village (+ mobile)` with a confidence score. Suggestions list. Merge tool: pick primary → reassign all slips → set `mergedIntoId` on losers (don't delete) → log merge.
**UX:** Side-by-side compare, show combined contribution preview before confirming, require explicit confirm.
**Acceptance:** merged donor's slips all reattach to primary; lifetime totals correct after merge; merge appears in audit and is reversible-or-traceable.
**Self-Review:** normalization handles Gujarati spelling variants and whitespace; never auto-merges; totals reconcile before/after.

### Phase 9 — Admin analytics & sorting
**Goal:** Answer the trust's real questions.
**Build:** Donor list sortable/filterable by village, amount, date, **yearly average**, retention (donated N of last 5 years), new vs returning, top donors. Village leaderboard per year. Year-over-year totals.
**UX:** Fast filters, sticky table headers, CSV export of any filtered view, simple charts.
**Acceptance:** yearly average and retention computed correctly against imported history; CSV matches on-screen filter.
**Self-Review:** aggregation excludes voided slips and unconfirmed-but-counted edge cases per agreed rule; large lists paginate.

### Phase 10 — Aheval (annual statement) PDF
**Goal:** Auto-generate the yearly account statement.
**Build:** Compile per year/scheme: income (by village / scheme / donor), expense (by category), net balance, married-couples list, donor list with amounts. Render a clean **Gujarati PDF** with the trust header/logo. Provide full + per-village output and a share link.
**UX:** Preview before export; one-tap share (WhatsApp/PDF).
**Acceptance:** numbers tie out to slips (confirmed) and approved expenses; Gujarati renders correctly (font embedded); totals add up.
**Self-Review:** cross-check PDF totals against the analytics screen; font embedding tested on a clean machine; large donor lists paginate in the PDF.

### Phase 11 — Audit log (build incrementally from Phase 1, finalize here)
**Goal:** Complete, filterable, exportable audit trail.
**Build:** Central audit middleware/helper called on every money/document/user/permission change. Admin viewer with filters (date range, role, action type, user) + CSV export.
**Acceptance:** every state-changing action across phases produces an audit row; filters work; export matches filter.
**Self-Review:** audit is append-only (no update/delete routes); before/after captured where relevant; no sensitive payload (passwords, tokens) logged.

### Phase 12 — Theme / homepage CMS (lowest priority)
**Goal:** Admin controls the public homepage.
**Build:** Setting-driven homepage sections: toggle visibility, reorder, edit text, logo/colors.
**Acceptance:** changes reflect on the public page without code changes.
**Self-Review:** sanitized rich text; sensible defaults if a section is empty.

### Phase 13 — Deploy + Android APK
**Goal:** Live web app + installable APK.
**Build:**
1. Backend → Render (free). Set all env vars (Mongo URI, JWT secret, Cloudinary keys). Note free-tier cold start (~50s after idle) and handle a slow first request gracefully in the UI (loading state + retry).
2. Frontend → Vercel/Netlify with `VITE_API_URL` pointing at Render.
3. Atlas M0 with IP allowlist + a least-privilege DB user.
4. Capacitor: `npm i @capacitor/core @capacitor/cli`, `npx cap init`, build the React app, `npx cap add android`, `npx cap copy`, open in Android Studio, build APK. Configure CORS on Express to allow `capacitor://localhost`, `https://localhost`, and the web domain. Confirm all API calls use the absolute `VITE_API_URL`.
**Acceptance:** web app works end-to-end on the deployed URLs; APK installs and performs login + a donation + a slip against the live backend.
**Self-Review:** no secrets in client bundle; CORS allowlist correct; cold-start handled; test the APK on a real phone, not just emulator.

---

## 6. UPI implementation spec
- Admin sets UPI in Settings: `payeeVpa` (UPI ID), `payeeName`, optional `defaultNote`. Store in `Setting`.
- Build the deep link: `upi://pay?pa={payeeVpa}&pn={encoded payeeName}&am={amount}&cu=INR&tn={encoded note}`. URL-encode all values.
- Render it as a QR with the `qrcode` package and also offer a tap-to-pay button on mobile (the link opens the UPI app).
- **There is no payment callback** without a gateway. So: donor taps "I've paid" (+ optional screenshot) → slip stays `paymentConfirmed=false` → admin/sub-admin confirms manually. Make this status visible everywhere a slip appears. Document that auto-verification needs a gateway (Razorpay/Cashfree) as a future phase.

## 7. Excel import spec (detail)
- Use SheetJS `read` → `sheet_to_json({header:1})` to get raw rows; row[0] is the header.
- Mapping UI maps each source header → system field; allow "ignore this column".
- Validate per row (amount numeric, required fields present); collect errors with row numbers.
- Idempotency: hash `(name|village|amount|year|source-row)` → skip if a slip/donor with that import-hash exists.
- Commit as a batch; produce a summary + downloadable error CSV. Audit the import batch.

## 8. Gujarati PDF spec
- Embed **Noto Sans Gujarati** (don't rely on system fonts). With pdfmake, register the font in the vfs; with @react-pdf/renderer, `Font.register`.
- Test rendering of conjuncts and matras on a machine without the font installed.
- Keep slip and Aheval templates in one place so branding stays consistent.

## 9. Security checklist (verify before deploy)
- [ ] bcrypt for passwords; passwords never in responses or logs.
- [ ] JWT secret + all keys in env; nothing secret in the client bundle.
- [ ] RBAC enforced server-side on every protected route; sub-admins geography-scoped.
- [ ] No card/bank/CVV/full-ID storage; UPI = reference strings only.
- [ ] Cloudinary uploads: validate type + size; documents not publicly enumerable.
- [ ] helmet, CORS allowlist (incl. Capacitor origins), rate limit on auth + public donation routes.
- [ ] Input validation on every endpoint; Mongo injection guarded (sanitize).
- [ ] No hard deletes; audit on every sensitive change.

## 10. Per-phase Self-Review Checklist (run every time)
1. Did I actually run the app and use the feature (happy + empty + error + one edge case)?
2. Loading, empty, and error states present on all new screens?
3. All new endpoints: auth + role check + input validation + try/catch + audit (if sensitive)?
4. Any irreversible action behind a confirm dialog?
5. Re-read my diff for null/undefined access, unhandled promises, hardcoded values, leftover console.logs/TODOs?
6. Money math uses the agreed precision and excludes voided/rejected items?
7. Gujarati renders correctly on the new screens?
8. Did I break any earlier phase? (smoke-test the prior phase's main flow)
9. README/env updated if I added config?

## 11. Definition of Done (whole project)
- All P0 phases (0–4, 11) pass acceptance + self-review and run on deployed URLs.
- Admin can: log in, manage sub-admins, import history, see donors/analytics, generate Aheval, view audit, configure UPI.
- Sub-admin can: log in (mobile), issue slips, submit handovers (geography-scoped).
- Donor can: donate via public link (named/anonymous) with UPI QR and get a receipt.
- APK installs and performs login + donation + slip against the live backend.
- Security checklist fully ticked.

## 12. Assumptions to confirm with the client (don't block on these; note your choice)
1. Money precision: storing as 2-dp rupees (confirm vs paise).
2. Anonymous donations appear in the Aheval as a single "Anonymous" line — confirm.
3. A donor giving in multiple villages in one year is attributed to the village on each slip (not merged) — confirm for the leaderboard.
4. Exact required-document lists for Samuh Lagna couples vs Mameru, and which documents expire.
5. Whether UPI auto-verification (a payment gateway) is wanted soon or manual confirmation is fine for v1.
6. Default donation quick-pick amounts (using ₹101 / ₹501 / ₹1100 until told otherwise).
