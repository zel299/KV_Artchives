# KV Artchives Ordering System — Full Documentation

**Project:** KV Artchives Web Ordering System (Capstone)
**Business type:** Handmade, made-to-order clay business
**Stack:** Node.js / Express (backend), Supabase (Auth + PostgreSQL + Storage)

---

## 1. System Overview

KV Artchives sells handmade clay pieces through a website with a standard cart-and-checkout flow, similar to Shopee or TikTok Shop. Because every piece is made to order, payment is split into a down payment and a balance rather than a single upfront charge, and both payments are confirmed manually by the admin rather than through an automated payment gateway.

Fully custom commissions (pieces not in the catalog) are **not** handled by the website at all. Customers are directed to message the business on Instagram or Facebook to discuss custom work directly — this is a separate, independent channel with no technical connection to the website.

---

## 2. User Roles

| Role | Description |
|---|---|
| **Customer** | Browses the catalog, adds items to cart, checks out, uploads payment proof, tracks and manages their own orders. |
| **Admin** | Manages the product catalog, reviews and finalizes orders, manually confirms payments, manages production and shipping. |

Both roles share the same Supabase Auth system. A `role` field (`customer` or `admin`) on each account determines access. There is no public admin sign-up — the single admin account is created directly and assigned the admin role manually.

---

## 3. Authentication

- **Email + password** signup and login (Supabase Auth)
- **Google sign-in** offered as an alternative option, not a replacement (Supabase OAuth)
- **Forgot password** flow, handled by Supabase's built-in password reset email
- **Login is required only at checkout** — browsing the catalog is open to everyone
- **Separate admin login page**, backed by a server-side role check (not just a different-looking form)

---

## 4. Customer-Facing Flow (Happy Path)

1. Customer browses the catalog freely — no login required.
2. Customer adds item(s) to their cart. No login required yet.
3. Customer proceeds to checkout — prompted to log in or sign up if not already.
4. Order is created with status **pending**.
5. Admin reviews the order and finalizes it (checks stock, backlog, and feasibility).
6. Down payment is requested — 60–70% of the order total.
7. Customer pays externally (GCash, bank transfer, etc.) and uploads a payment screenshot plus reference number through **My Orders**.
8. Admin manually verifies and confirms the down payment.
9. Order moves to **in production**.
10. Once production is done, admin requests the remaining balance plus the shipping fee (calculated based on the customer's address).
11. Customer uploads proof of the balance payment; admin manually confirms it.
12. Admin marks the order **ready to ship**, ships it via J&T, and adds the tracking number.
13. Customer receives an automatic email notification with the tracking number.
14. Customer receives the parcel. Order status becomes **completed**.

---

## 5. Order Status Reference

| Status | Meaning | Type |
|---|---|---|
| `pending` | Order just created from checkout, awaiting admin review. | In progress |
| `confirmed by admin` | Admin finalized the order. | In progress |
| `awaiting down payment` | Down payment requested; expires after 3 days if unpaid. | In progress |
| `in production` | Item is being made. | In progress |
| `awaiting balance` | Balance + shipping fee requested. | In progress |
| `ready to ship` | Balance confirmed, tracking number being added. | In progress |
| `shipped` | Parcel is with J&T; tracking number provided; shipped email sent. | In progress |
| `completed` | Customer has received the order. | Terminal (success) |
| `declined` | Admin declined the order while finalizing. No payment was made. | Terminal (stop) |
| `expired` | Automatic. The down payment window (3 days) lapsed unpaid. | Terminal (stop) |
| `cancelled` | Cancelled by customer or admin, at any stage. No refund. | Terminal (stop) |

---

## 6. Negative Paths

| Scenario | What happens |
|---|---|
| **Admin declines the order while finalizing** | Order is marked `declined`. No payment has occurred yet, so there is nothing to refund. |
| **Down payment is never paid** | Order automatically expires after 3 days of being unpaid. This protects admin from holding a production slot for an order that was never going to happen. |
| **Customer cancels the order** | Allowed at any stage, even after paying the down payment. If any payment has already been made, the customer sees a clear warning that it is non-refundable before the cancellation is confirmed. |
| **Admin cancels the order** | Same no-refund rule applies, regardless of which side initiates the cancellation. |
| **Item arrives damaged, or the wrong item is sent** | Not handled inside the system. The order detail page displays a message directing the customer to contact KV Artchives on Instagram or Facebook, along with the Order ID and item details so the issue can be resolved directly. |
| **Customer wants a fully custom piece** | Not handled by the website at all. Customer is directed to message KV Artchives on Instagram or Facebook to discuss design and price. No record of this is kept in the system. |

---

## 7. Product Catalog & Stock

Products support full CRUD (Create, Read, Update, Delete) from the admin dashboard:

- **Create** — name, description, price, photos, and an available/unavailable toggle.
- **Read** — list and detail views.
- **Update** — edit any product field, including marking items sold out.
- **Delete** — a genuine hard delete is only safe for products that have never been ordered. Products with existing order history should instead be **soft-deleted** (marked unavailable/inactive) so past order records are not broken by a missing product reference.

**Stock model:** every product has a `quantity` field.

- A quantity of `1` represents a one-of-a-kind handmade piece.
- A higher quantity represents a restockable item KV Artchives can remake.
- Stock decreases when an order is **created** (at checkout), not when an item is merely added to a cart, to prevent inventory from being locked by abandoned carts.
- When quantity reaches `0`, the product is automatically shown as sold out and removed from active browsing.
- Admin can manually raise the quantity again if a design is remade.

---

## 8. Payment Handling

- No automated payment gateway. All payments (down payment and balance) are confirmed **manually** by admin.
- Customers upload a **payment screenshot** and a **reference/transaction number** through My Orders for both the down payment and the balance payment.
- The screenshot is supporting evidence only — order status changes only after admin manually verifies and confirms the payment. Uploading a screenshot does not automatically change the order status.
- Files are stored using **Supabase Storage**, which is required for a live, publicly deployed app — saving uploads to local server disk is unreliable on most free or cheap hosting, since the filesystem can be wiped on redeploy.

---

## 9. Admin Screens

**Note:** The admin/seller has a dedicated dashboard as the main landing page after logging in — this is not optional or an afterthought, it's the primary way she interacts with the system day to day.

**Dashboard contents (finalized):**
- Four stat cards: **Total Sales**, **Total Orders**, **Transactions**, **Customers** — plain current numbers, no growth percentage indicators (no period-over-period comparison logic needed).
- **Units Sold** line chart — replaces the earlier Customer Activity and Sales Overview charts. Tracks item count sold over time, pulled directly from order data.
- **Order Status** overview (kept as-is).
- **New Orders** table — recent orders needing admin attention.

The "Transactions" stat card is a plain count only (e.g., confirmed payments). It does not reintroduce a separate transactions ledger/page — full payment details (screenshot, reference number, amount) still live inside each order's detail page.

| Screen | Purpose |
|---|---|
| **Admin login** | Separate login page, gated by the `admin` role. |
| **Dashboard** | At-a-glance view of what needs attention: new orders to review, orders awaiting down payment or balance confirmation, and orders ready to ship. |
| **Orders list** | All orders, filterable by status, searchable by customer or order ID. |
| **Order detail page** | Everything about one order in a single place: items, customer info, price breakdown, payment screenshots, and every action button (finalize, decline, confirm payment, add tracking number, mark shipped/completed, cancel). |
| **Product management (CRUD)** | Add, edit, soft-delete/hard-delete, and manage stock quantity for catalog products. |

---

## 10. Customer Screens

| Screen | Purpose |
|---|---|
| **Catalog / Browse** | Open to everyone, no login required. |
| **Product detail** | Individual item view, with Add to Cart. |
| **Cart** | Review items before checkout. |
| **Checkout** | Requires login or signup. |
| **My Orders** | List of past and current orders. Each order shows status, tracking number (once shipped), and lets the customer upload payment proof, cancel the order, or (for shipped/completed orders) see contact details for reporting a problem via Instagram/Facebook. |
| **Login / Signup** | Email + password or Google. Includes Forgot Password. |

---

## 11. Notifications

Kept intentionally minimal for this project's scope:

- **One automated email** is sent when an order's status changes to `shipped`, containing the J&T tracking number.
- All other status updates are check-the-site only, viewable through My Orders.

---

## 12. What Is Explicitly Out of Scope

These were considered and deliberately excluded to keep the system focused:

- **In-site messaging / discussion threads** — removed entirely. Custom orders go through Instagram/Facebook DM instead.
- **Price negotiation on the website** — catalog items have fixed prices; no inquiry-and-proposal system.
- **Real-time chat** — not applicable, since messaging was removed.
- **Automated payment gateway integration** — payments are confirmed manually.
- **Formal return/refund logistics feature** — damaged or wrong items are handled by directing the customer to contact the business on social media, not through an in-system return flow.
- **Notifications beyond the shipped email** — no notifications for down payment reminders, balance requests, etc.

---

## 13. Pre-Build Implementation Decisions

These gaps were identified and resolved before development began, so the build does not stall on undecided details.

### Down payment
- Fixed at **60%** of the order total, calculated automatically. Admin never enters a percentage or does any math — the system shows the down payment and remaining balance, and admin simply requests it.
- **No rounding.** The exact amount, centavos included, is shown to the customer, following the same pattern as Shopee and TikTok Shop: *"Pay exactly ₱499.80."*
- Unrounded amounts are deliberate. They make payments much easier for admin to match in her GCash or bank transaction list — three customers each owing a round ₱500 are indistinguishable, but ₱499.80, ₱612.40, and ₱388.20 each act as an accidental fingerprint.
- The amount is displayed prominently with a copy button, since typing centavos on mobile is error-prone.

### Payment instructions
- Admin can **upload a GCash QR code** and update it at any time, rather than having payment details hardcoded. The shop can change accounts without needing a developer.
- The payment screen shows: exact amount due, the uploaded QR code / account details, a reference number field, and an optional screenshot upload.

### Proof of payment
- The **reference/transaction number is required**; the **screenshot is optional**.
- Admin verifies payments by checking her own GCash or bank account directly. The reference number and optional screenshot exist to help her match a payment quickly, not to serve as authoritative proof.
- Together, amount + reference number + optional receipt give admin three independent ways to match a payment; only one needs to work.
- **No strict amount-matching validation.** If a customer pays slightly off (₱500 instead of ₱499.80), admin can still confirm manually. The system presents information; admin makes the final call.

### Shipping fee
- Shipping is based on **weight and distance**, so it is **not** calculated at the down payment stage. It is determined and added later, when the balance is requested.
- Admin enters the shipping fee manually per order.

### Stock display
- Exact stock quantity is tracked **internally only** and never shown to customers.
- Customers see status instead: **In stock** (quantity ≥ 1) or **Sold out** (quantity 0, with Add to Cart disabled).
- Optionally, one-of-a-kind pieces can carry a **"One of a kind"** badge — a selling point for handmade work rather than a stock disclosure.
- This keeps inventory accurate and prevents overselling without exposing numbers that either read as "slow-moving" or state the obvious for handmade items.

### Cart persistence
- A cart built while logged out **survives login**. Customers browse and add to cart without an account, and the cart is preserved when they log in or register at checkout.

### Order ID format
- Format is **#KV-001**, used consistently across the customer view, admin dashboard, emails, and search.

### Image storage and compression
- **Images must be compressed on upload.** Product photos should be resized to roughly 1200px wide and payment screenshots to roughly 1000px before saving — typically an 80–90% file size reduction with no visible quality loss on a phone screen.
- A **file size limit** of around 5 MB should be enforced on uploads.
- Rationale: Supabase's free tier provides 1 GB of file storage. Payment screenshots are small (roughly 800 KB per order across both payments, or about 1,250 orders per GB), but **product photos are the real consideration** — they are permanent and can run 3–5 MB each uncompressed, which could consume over half the quota before a single receipt is stored. With compression, total usage should stay well under 200 MB.

---

## 14. Hosting & Free Tier Notes

- **Supabase free tier** covers this project comfortably: 500 MB database, 1 GB file storage, 50,000 monthly active users for Auth, 5 GB bandwidth.
- **Google OAuth** is free at any scale.
- **Known limitation:** Supabase's free tier automatically pauses a project after 7 days of inactivity. No data is lost, but the site will not respond until someone manually resumes it from the dashboard. Worth checking before any live demo or defense.
- **Known limitation:** the free tier does not include automatic backups. Acceptable for a capstone project, but worth stating clearly in project documentation as a known limitation rather than an oversight.

---

*This document reflects the system design as agreed upon during planning discussions and should be read alongside the Lucidchart process flow diagram for the full visual reference.*