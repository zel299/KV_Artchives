# KV Artchives — Security Notes

Running record of the security measures in this project: what is already in
place, what still needs building, and the reasoning behind each choice.

**Status key:** ✅ done · ⚠️ partial · ❌ not started

---

## 1. Authentication and sessions

| Measure | Status | Notes |
|---|---|---|
| Password hashing | ✅ | Handled by Supabase Auth (bcrypt). We never store or see raw passwords. |
| Session tokens in `httpOnly` cookies | ✅ | JavaScript cannot read them, so an XSS bug cannot steal a session. |
| `sameSite: lax` on cookies | ✅ | Blocks the cookie being sent on most cross-site requests. |
| `secure` flag in production | ✅ | Cookies only travel over HTTPS once `NODE_ENV=production`. |
| Vague login errors | ✅ | "That email and password do not match" rather than "no such user", so the login form cannot be used to discover which emails have accounts. |
| Password minimum length | ⚠️ | Currently 8 characters. No complexity rule, which is the modern recommendation, but there is also no check against common passwords. |
| Rate limiting on login | ❌ | **Gap.** Nothing currently stops thousands of password guesses. See section 6. |
| Account lockout | ❌ | Considered and rejected: lockout can be abused to lock a real user out on purpose. Rate limiting is the better answer here. |

---

## 2. Authorisation (who can do what)

| Measure | Status | Notes |
|---|---|---|
| Role stored in the database | ✅ | `profiles.role` is the single source of truth. Nothing the browser sends can grant admin. |
| `requireAdmin` applied at the router | ✅ | `router.use(requireAdmin)` in `routes/admin.js` protects every admin route at once, so a newly added route cannot be left unprotected by accident. |
| Admin login re-checks the role | ✅ | A valid customer password on `/admin/login` still fails, because the role is checked after the password. |
| Row Level Security on every table | ✅ | Defence in depth: even if a route forgets a check, the database refuses to return another customer's orders. |
| Per-user Supabase client | ✅ | `supabaseForUser(token)` runs customer queries as that customer, so RLS applies exactly as it would in the browser. |
| Insecure direct object references (IDOR) | ✅ | Changing an order ID in the URL returns nothing, because the RLS policy filters on `user_id = auth.uid()`. |

---

## 3. Secrets and configuration

| Measure | Status | Notes |
|---|---|---|
| `.env` excluded from git | ✅ | Verified: `git status` does not list it. |
| `.env.example` committed instead | ✅ | Documents which variables are needed without exposing values. |
| Secret key kept server-side only | ✅ | `SUPABASE_SECRET_KEY` bypasses RLS entirely. It is never sent to the browser and appears only in `config/supabase.js`. |
| Publishable key used for client-facing work | ✅ | Safe to expose; it still obeys RLS. |
| Session secret is random | ✅ | Generated with `crypto.randomBytes(32)`, not a guessable string. |

**If a secret ever leaks:** rotate it immediately in the Supabase dashboard
(Settings → API Keys). Deleting the commit is not enough — anything pushed to
GitHub should be treated as permanently public.

---

## 4. File uploads

| Measure | Status | Notes |
|---|---|---|
| Bucket-level size limits | ✅ | 5 MB on `product-images` and `receipts`, 2 MB on `settings`. |
| Bucket-level MIME restrictions | ✅ | Only `image/jpeg`, `image/png`, `image/webp` accepted. |
| Receipts bucket is private | ✅ | Payment screenshots contain transaction details and must not be publicly browsable. |
| Re-encoding through sharp | ✅ | Every upload is decoded and re-encoded to WebP. This strips EXIF metadata (including GPS location) and destroys any payload hidden inside a crafted image file. |
| Random filenames | ✅ | `crypto.randomUUID()` prevents collisions and stops anyone guessing the URL of a private receipt. |
| Server-side MIME check in multer | ❌ | **Gap.** The bucket enforces it, but the request should be rejected before it is ever processed. |
| Storage access policies | ⚠️ | Buckets show `Policies: 0`. This does **not** block uploads: the server uploads with the secret key, which bypasses RLS and storage policies alike. Policies only govern direct browser-to-Supabase access, which this architecture does not use. Worth adding as defence in depth so a future frontend mistake cannot expose receipts. |
| Signed URLs for receipts | ❌ | **To build when receipts are displayed.** The `receipts` bucket is private, so images cannot be linked directly. The server generates a short-lived signed URL (around 60 seconds) with the secret key; the browser loads that. The file stays private and the link expires. |

---

## 5. Input handling

| Measure | Status | Notes |
|---|---|---|
| SQL injection | ✅ | The Supabase client parameterises every query. No string-concatenated SQL anywhere in the project. |
| XSS in templates | ⚠️ | EJS `<%= %>` escapes HTML by default, which covers normal output. `<%- %>` does **not** escape — it is currently used only for the layout body, which is trusted. **Rule: never use `<%- %>` on anything a user typed.** |
| Server-side validation | ⚠️ | Products are validated in `adminProductController.validate()`. Browser `required` attributes are a convenience only and are trivially bypassed. Other forms still need the same treatment as they are built. |
| Amount tampering | ❌ | **To build.** Order totals must always be recalculated on the server from current product prices. Never trust a price or total submitted by the browser. |

---

## 6. Rate limiting (not yet built)

Nothing currently limits how often an endpoint can be hit. The endpoints that
matter most, in rough order of risk:

| Endpoint | Risk | Suggested limit |
|---|---|---|
| `POST /login`, `POST /admin/login` | Password guessing | 5 attempts per 15 min per IP |
| `POST /signup` | Fake account flooding | 3 per hour per IP |
| `POST /forgot-password` | Email bombing a real user | 3 per hour per IP |
| Order creation | Stock exhaustion by repeated orders | 10 per hour per account |
| File upload routes | Filling the 1 GB storage quota | 20 per hour per account |

**Planned approach:** `express-rate-limit`, applied per route rather than
globally, so that browsing the catalog is never throttled.

**Note for deployment:** on a host behind a proxy, `app.set("trust proxy", 1)`
is required or every request appears to come from the same IP and the limiter
will throttle everyone at once.

---

## 7. Concurrency and data integrity

| Item | Status | Notes |
|---|---|---|
| Stock race condition | ❌ | **Serious. Fix when checkout is built.** `adjustStock()` currently reads the quantity, then writes the new value. Two customers checking out the last item at the same moment both read `1`, both write `0`, and one physical piece is sold twice. For one-of-a-kind handmade items this is a real customer-facing failure. **Solution:** move the decrement into a Postgres function so the read and write happen atomically in a single statement, and have it fail loudly when stock would go negative rather than silently clamping. |
| Cart quantity tampering | ❌ | **Fix when checkout is built.** Quantities arrive from the browser and could be negative or absurdly large. **Solution:** validate every quantity as a positive integer server-side, cap it at the available stock, and reject the request rather than correcting it silently. |
| Order total tampering | ❌ | **Fix when checkout is built.** **Solution:** never read a price or total from the request. Look up each product's current price from the database, compute the subtotal server-side, and store that. The browser sends product IDs and quantities only. |
| Guessable order codes | ⚠️ | `KV-001`, `KV-002` are sequential and enumerable. RLS still prevents reading someone else's order, so no data leaks, but the sequence does reveal roughly how many orders the shop has ever taken. Accepted for now: the format was chosen deliberately for readability. **Optional hardening:** add a short random suffix, e.g. `KV-001-7QF`. |

---

## 8. Session handling

| Item | Status | Notes |
|---|---|---|
| Customer session length | ✅ | 7 days. Reasonable for a storefront. |
| Admin session length | ❌ | **Fix when the admin area is finished.** Admin sessions also last 7 days. An unattended laptop stays logged in with full access to orders and customer data. **Solution:** a shorter cookie lifetime for admin sessions (12 hours is a sensible default), and an explicit "log out" that clears the cookie rather than relying on expiry. |
| Session invalidation on password change | ❌ | After a password reset, older sessions remain valid. **Solution:** Supabase can revoke other sessions on password change; wire that into the reset flow. |

---

## 9. Other gaps to close

| Item | Status | Notes |
|---|---|---|
| CSRF protection | ❌ | **Important gap.** The app uses cookie-based sessions with HTML forms, which is the exact pattern CSRF targets. `sameSite: lax` blocks the common cases, but a token per form is the proper fix. |
| Security headers | ❌ | `helmet` is not installed. It sets headers that mitigate clickjacking, MIME sniffing, and similar. One line to add. |
| HTTPS enforcement | ❌ | Deployment concern. Most hosts terminate TLS automatically; the app should still redirect HTTP to HTTPS in production. |
| Error detail leaking | ✅ | Stack traces and raw messages are only shown when `NODE_ENV=development`. Production shows a generic message. |
| Dependency vulnerabilities | ❌ | Run `npm audit` periodically. |

---

## 10. Deliberate non-features

Decisions that look like gaps but are intentional:

- **No payment gateway.** Payments are confirmed manually by admin against her
  own GCash or bank account. The reference number and optional screenshot are
  matching aids, not proof, and the system never treats them as authoritative.
- **No strict amount matching.** If a customer pays ₱500 instead of ₱499.80,
  admin can still confirm. The system presents information; a human decides.
- **Stock quantity hidden from customers.** Enforced in
  `productService.toPublicProduct()`, which returns a boolean rather than the
  number, so a template cannot leak it by accident.

---

## Priority order for closing gaps

Each item is scheduled for the phase where it becomes relevant, rather than
all at once.

**Now — while building product images (Phase 4)**
1. Multer MIME and size validation, so bad files are rejected at the door.

**Next — before the site is reachable by anyone else (Phase 5)**
2. `helmet` for security headers. One line.
3. Rate limiting on `/login`, `/admin/login`, `/signup`, `/forgot-password`.
4. CSRF tokens on every state-changing form.

**When checkout is built (Phase 6)**
5. Atomic stock decrement in a Postgres function, to close the race condition.
6. Server-side recalculation of every order total.
7. Cart quantity validation as positive integers, capped at available stock.
8. Rate limiting on order creation and uploads.

**When the admin area is finished (Phase 7)**
9. Shorter admin session lifetime.
10. Signed URLs for displaying private receipt images.

**Before deployment (Phase 8)**
11. `app.set("trust proxy", 1)` so rate limiting sees real client IPs.
12. HTTPS redirect in production.
13. Storage policies as defence in depth.
14. `npm audit` and dependency review.