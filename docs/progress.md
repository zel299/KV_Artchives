# KV Artchives — Build Progress

**Project:** Web-Based Digital Storefront with Ordering System for KV Artchives
**Group:** NEXUS · **PM:** Bernardo, Ruzzel M.
**Stack:** Node.js / Express · Supabase (Auth + PostgreSQL + Storage)
**Repo:** https://github.com/zel299/KV_Artchives

> Update this file at the end of every working session. Move items between
> sections, add a dated entry under **Session Log**, and leave anything unclear
> under **Open Questions** so the next person is not guessing.

---

## Current Status

**Phase:** 4 of 8 — Product management (image upload wiring in progress)
**Last updated:** 2026-08-24

---

## How we build

- **Zel types all code by hand** to learn it. Code is shown in chat in small
  chunks — one function or section at a time — never as finished files or zips.
- Code is shown without inline comments, then explained afterwards.
- Discuss the approach before writing anything.
- **Double quotes** in JavaScript, not single quotes.
- Confirm each file is saved before moving on, or a missing file turns into a
  "Cannot find module" error several steps later.

---

## Build Phases

### Phase 1 — Database schema
**Status:** Done

- [x] Design tables and relationships
- [x] Write `database/schema.sql`
- [x] Create the Supabase project (`kv_artchives`)
- [x] Run the schema — 12 tables, 5 enums, triggers, RLS policies
- [x] Create the admin account and set `role = 'admin'`
- [x] Create Storage buckets with size and MIME limits:
      `product-images` (public, 5 MB), `receipts` (private, 5 MB),
      `settings` (public, 2 MB)
- [ ] Add a few test products to confirm everything works end to end

### Phase 2 — Project setup
**Status:** Done

- [x] Express app, folder structure, EJS + layouts, static file serving
- [x] `.gitignore` (excludes `.env` and `node_modules`) — verified with `git status`
- [x] `.env.example` documenting every required variable
- [x] `src/config/supabase.js` — three clients (see Key Conventions)
- [x] `src/config/index.js` — business rules in one place
- [x] `src/utils/money.js` — fixed 60% down payment, no rounding
- [x] Startup check that reports whether Supabase connected
- [x] README with setup instructions
- [x] Pushed to GitHub

### Phase 3 — Authentication
**Status:** Written, not yet tested against real Supabase

- [x] Email and password signup and login
- [x] Logout
- [x] Google OAuth flow (code written)
- [x] Forgot password / reset password
- [x] Session handling via `httpOnly` cookies
- [x] `requireAuth` middleware
- [x] `requireAdmin` middleware — reads `profiles.role`
- [x] Separate admin login page that re-checks the role after the password
- [ ] **Test every flow end to end with real credentials**
- [ ] **Enable the Google provider in Supabase** (needs OAuth credentials from
      Google Cloud Console; redirect URL `http://localhost:3000/auth/callback`)

### Phase 4 — Products (admin)
**Status:** In progress

Done:
- [x] `src/services/productService.js` — all product queries in one place
- [x] `src/controllers/adminProductController.js`
- [x] `src/routes/admin.js` — `router.use(requireAdmin)` protects everything
- [x] `src/views/layouts/admin.ejs` — sidebar shell
- [x] `src/views/admin/dashboard.ejs` — placeholder stats until Phase 6
- [x] `src/views/admin/products/list.ejs`, `form.ejs`, `detail.ejs`
- [x] `public/css/admin.css`
- [x] Verified admin routes redirect guests to `/admin/login`

Image upload (`src/utils/imageUpload.js`):
- [x] `compress()` — sharp: auto-rotate from EXIF, resize, convert to WebP
- [x] `uploadToBucket()` — random UUID filename, returns the storage path
- [x] `uploadProductImage()` / `uploadReceipt()` — wrappers holding the rules
      for each image type

Wiring multer into product routes (`src/middleware/upload.js`):
- [x] multer with `memoryStorage`, `fileSize` from config, `files: 5`
- [x] MIME fileFilter for jpeg/png/webp
- [x] exported as `productImages` = `.array("images", 5)`
- [x] `productService.addImages(productId, paths)` — reads max sort_order,
      appends, batch inserts
- [x] `productImages` middleware added to `POST /products` and
      `POST /products/:id` in `src/routes/admin.js`
- [x] `adminProductController.js` — added the `uploadProductImage` require and
      a `handleImages(files, productId)` helper (sequential loop, not
      `Promise.all` — five images decoding at once in sharp can spike memory
      on the free tier; paths are collected before calling `addImages` so a
      failed upload never leaves half-written database rows)
- [ ] **Call `handleImages()` from `doCreate` and `doEdit`** — not wired in yet
- [ ] Update the product form: `enctype="multipart/form-data"`, `name="images"`, `multiple`
- [ ] Save paths to `product_images`, display images in list and detail views

Still to do:
- [ ] Category management
- [ ] Test creating, editing, and archiving a product in the browser

### Phase 5 — Catalog and cart (customer)
**Status:** Not started

- [ ] Homepage / landing
- [ ] Catalog with search and category filter
- [ ] Product detail page
- [ ] "In stock" / "Sold out" only — never the raw number
- [ ] "One of a kind" badge
- [ ] Add to cart while logged out
- [ ] Cart page: update quantity, remove item
- [ ] **Guest cart merges into the account on login**
- [ ] Security: `helmet`, rate limiting on auth routes, CSRF tokens

### Phase 6 — Checkout and orders (customer)
**Status:** Not started

- [ ] Checkout page with shipping address form
- [ ] Create the order and decrease stock
- [ ] Order confirmation page
- [ ] My Orders list with status filters
- [ ] Order detail with status timeline
- [ ] Submit payment reference number (+ optional receipt upload)
- [ ] Customer cancel, with a non-refundable warning if already paid
- [ ] Security: atomic stock decrement, server-side total recalculation,
      cart quantity validation, rate limiting on order creation

### Phase 7 — Order management (admin)
**Status:** Not started

- [ ] Orders list with status filter and search
- [ ] Order detail page with every action in one place
- [ ] Finalize / decline order
- [ ] Request down payment (60% of subtotal, no rounding)
- [ ] Confirm down payment
- [ ] Enter shipping fee and request the balance
- [ ] Confirm the balance payment
- [ ] Add tracking number, mark shipped, mark completed
- [ ] Cancel order (returns stock)
- [ ] Dashboard: four stat cards, Units Sold line chart, order status, new orders
- [ ] Security: shorter admin session lifetime, signed URLs for receipt images

### Phase 8 — Polish and deployment
**Status:** Not started

- [ ] Settings page (GCash QR upload, account details, social links)
- [ ] Custom Order / Contact page pointing to Instagram and Facebook
- [ ] Shipped notification email with tracking number (Resend)
- [ ] Expiry job: sweep unpaid orders after 3 days, return stock
- [ ] Mobile responsiveness pass on customer screens
- [ ] Error pages and empty states
- [ ] Security: `trust proxy`, HTTPS redirect, storage policies, `npm audit`
- [ ] Deploy
- [ ] Seed with real product data

---

## Next Up

1. **Call `handleImages()` from `doCreate` and `doEdit`** in `adminProductController.js` — stopped exactly here
2. Update the product form to accept image files (`enctype`, `name="images"`, `multiple`)
3. Display images in list and detail views
4. Test the whole product flow in the browser: create, edit, archive
5. Test the auth flows that have never been run against real Supabase
6. Enable the Google provider in Supabase
7. Category management

---

## Key Conventions

**Three Supabase clients** (`src/config/supabase.js`) — which one you use matters:

| Client | Key | RLS | Use for |
|---|---|---|---|
| `supabaseAdmin` | secret | bypassed | Trusted server work: orders, payments, stock, admin reads |
| `supabaseAnon` | publishable | applies | Auth calls and customer-facing reads |
| `supabaseForUser(token)` | publishable + user token | applies as that user | Reading or writing a specific customer's data |

**Layering:** routes → controllers → services. Controllers stay thin: read the
request, call a service, render. No queries or business rules in a controller,
so the same logic can be reused outside an HTTP request.

**Stock is never written directly.** All changes go through
`productService.adjustStock()`, which updates the quantity and writes to
`stock_log` in the same call, so the audit trail cannot be skipped.

**Customers never see stock numbers.** `toPublicProduct()` returns
`inStock: true/false` instead of the quantity, so a template cannot leak it.

---

## Key Decisions (do not re-litigate)

| Decision | Value |
|---|---|
| Down payment | Fixed **60%** of subtotal, auto-calculated, **no rounding** |
| Why no rounding | Exact centavo amounts act as a fingerprint, making payments far easier for admin to match in her GCash or bank list |
| Payment confirmation | **Manual** by admin, no payment gateway |
| Proof of payment | Reference number **required**, screenshot **optional** |
| Shipping fee | Weight/distance based, entered manually, added **at balance stage** |
| Stock shown to customers | **Status only** ("In stock" / "Sold out") |
| Stock on expiry/cancel/decline | **Returns automatically**, logged in `stock_log` |
| Cart | Guest cart **survives login** |
| Order ID | `KV-001` format |
| Custom commissions | **Not on the website** — Instagram / Facebook DM only |
| Refunds | **None** on cancellation, either side |
| Images | **Compressed on upload** (~1200px products, ~1000px receipts, WebP) |
| Messaging feature | **Removed from scope** entirely |
| Frontend | Partner writes plain HTML/CSS/JS; Zel converts to EJS and wires in data |

---

## Open Questions

- [ ] Which email address should the shipped notification come from? (Resend
      needs a verified domain, or its test sender for now.)
- [ ] Confirm the real GCash account name and number for the Settings seed data.
- [ ] Admin account currently uses Zel's email. Decide at handover whether to
      change it or create a separate account for the shop owner.

---

## Session Log

### 2026-08-24 (session 4)
- Typed `src/middleware/upload.js`: multer with `memoryStorage`, MIME filter
  for jpeg/png/webp, exported as `productImages` = `.array("images", 5)`.
- Added `productService.addImages(productId, paths)`.
- Wired `productImages` middleware into `POST /products` and
  `POST /products/:id` in `admin.js`. Zel first duplicated the routes by
  accident — Express silently ignores a later duplicate route rather than
  erroring, which makes it a nasty bug to spot. Corrected to one line each.
- Added `handleImages(files, productId)` to `adminProductController.js`, a
  sequential loop (not `Promise.all`) that uploads each file, collects the
  returned storage paths, then saves them all in one `addImages` call.
- **Stopped before calling `handleImages()` from `doCreate` / `doEdit`.**
  That's the next thing to do.

### 2026-08-23 (session 3)
- Wrote `docs/security.md`: a full audit of what is in place, what is missing,
  and the fix for each gap, scheduled by the phase where it becomes relevant.
- Recorded four gaps worth knowing about:
  - **Stock race condition** — `adjustStock()` reads then writes, so two
    simultaneous checkouts of the last item can both succeed. Fix in Phase 6
    with an atomic Postgres function.
  - **No rate limiting** — nothing throttles login, signup, or password reset.
  - **No CSRF protection** — cookie sessions plus HTML forms is exactly the
    pattern CSRF targets.
  - **Order totals must be recalculated server-side** at checkout; never trust
    a price sent by the browser.
- Corrected an earlier mistake: storage policies do **not** block uploads,
  because the server uploads with the secret key which bypasses them. Worth
  adding as defence in depth, not as a blocker.
- Noted a free security benefit: sharp re-encoding strips EXIF data (including
  GPS) and destroys anything hidden inside a crafted image file.
- Agreed the working method: Zel types all code by hand, small chunks,
  double quotes, explanation after the code.
- Started `src/utils/imageUpload.js` — `compress()`, `uploadToBucket()`,
  `uploadProductImage()`, `uploadReceipt()`.

### 2026-08-23 (session 2)
- Ran `schema.sql` in Supabase; all 12 tables created.
- Created the three Storage buckets with size limits and image-only MIME types.
- Created the admin account and set `role = 'admin'`.
- Built the Phase 2 scaffold and Phase 3 auth.
- Built Phase 4 product management: service, controller, routes, admin layout
  and views, admin stylesheet.
- Verified the server boots with `supabase connected`, every route renders, and
  admin routes redirect guests to `/admin/login`.
- Initialised the repo, added `.gitignore` first, then pushed 26 files.

### 2026-08-23 (session 1)
- Closed the pre-build gaps: 60% down payment with no rounding, GCash QR via a
  Settings page, shipping fee at the balance stage, stock status hidden from
  customers, guest cart survives login, `KV-001` order format, reference number
  required with optional receipt, image compression required.
- Decided stock returns automatically on expiry, cancellation, and decline,
  with every change written to `stock_log`.
- Wrote `schema.sql`.