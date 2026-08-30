# KV Artchives — Web-Based Digital Storefront with Ordering System for KV Artchives

A web-based storefront and ordering system built for KV Artchives, a small
handmade clay business that currently takes all of its orders through
Instagram and Facebook direct messages.

The system replaces that manual process with a proper catalog, cart, and
checkout flow, and gives the shop owner an admin portal to manage products,
confirm payments, and track orders from placement through to delivery.

CC106 Project

---

## Group

**Group Name:** NEXUS
**Project Manager:** Bernardo, Ruzzel M.

| Member | Role |
|---|---|
| Bernardo, Ruzzel M. | Project Manager · Developer/Database |
| Carmen, Paul Genesis L. | Developer |
| Cuntapay, Karla S. | Research/Documents |
| Ileto, Kyle Sonrey G. | UI/UX |
| Pascual, Kit Eriana Arvee B. | UI/UX · Developer |
| Reyes, Tristan John Nicolas R. | Research/Documents |

---

## Features

**Customer**

- Browse a product catalog with search and category filters
- View product details with photos
- Add items to a cart, including while logged out
- Check out with a shipping address
- Pay a 60% down payment, then the balance once shipping is computed
- Submit a payment reference number with an optional receipt image
- Track an order through its full status timeline

**Admin**

- Create, edit, archive, and restore products
- Upload product photos, compressed automatically on upload
- Manage stock, with every change written to an audit log
- Review incoming orders and confirm or decline them
- Confirm payments manually and record shipping details
- Dashboard with sales figures and order status overview

---

## Technology

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Server | Express |
| Views | EJS with express-ejs-layouts |
| Database | PostgreSQL (Supabase) |
| Authentication | Supabase Auth — email/password and Google OAuth |
| File storage | Supabase Storage |
| Image processing | sharp |
| File uploads | multer |
| Styling | Plain CSS |

The frontend is server-rendered with EJS rather than a separate JavaScript
framework. The interface is built from the group's approved Figma design.

---

## Project structure

```
KV_Artchives/
├── database/
│   └── schema.sql              Full database schema, RLS policies, triggers
├── docs/
│   ├── feature.md              Feature specifications
│   └── security.md             Security audit and planned mitigations
├── public/
│   ├── css/                    Stylesheets
│   ├── js/                     Client-side scripts
│   └── img/                    Static images
├── src/
│   ├── config/                 Supabase clients and business rules
│   ├── middleware/             Authentication, role checks, file uploads
│   ├── routes/                 URL definitions
│   ├── controllers/            Request handling
│   ├── services/               Business logic and database queries
│   ├── utils/                  Money formatting, image upload helpers
│   ├── views/                  EJS templates
│   └── server.js               Application entry point
├── .env.example                Template for required environment variables
└── package.json
```

Requests flow **routes → controllers → services**. Controllers stay thin:
they read the request, call a service, and render. Database queries and
business rules live in the service layer so the same logic can be reused.

---

## Setup

### Requirements

- Node.js 18 or newer
- A Supabase project (free tier is sufficient)

### 1. Clone and install

```bash
git clone https://github.com/zel299/KV_Artchives.git
cd KV_Artchives
npm install
```

### 2. Set up Supabase

Create a new project at [supabase.com](https://supabase.com), then:

- Open the **SQL Editor** and run the contents of `database/schema.sql`
- Under **Storage**, create three buckets:

  | Bucket | Access | Size limit |
  |---|---|---|
  | `product-images` | Public | 5 MB |
  | `receipts` | Private | 5 MB |
  | `settings` | Public | 2 MB |

  Restrict all three to `image/jpeg`, `image/png`, and `image/webp`.

### 3. Configure environment variables

Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

| Variable | Where to find it |
|---|---|
| `PORT` | Any free port, e.g. `3000` |
| `NODE_ENV` | `development` locally |
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API Keys |
| `SUPABASE_SECRET_KEY` | Supabase → Settings → API Keys |
| `SESSION_SECRET` | Any long random string |

`.env` is excluded from version control and must never be committed.

### 4. Run

```bash
npm run dev     # with auto-restart on file changes
npm start       # plain
```

The site runs at `http://localhost:3000`.

### 5. Create an admin account

Sign up normally through the site, then open Supabase → **Table Editor** →
`profiles`, find your row, and change `role` from `customer` to `admin`.

There is deliberately no page for creating admin accounts. Promotions are
rare and the database dashboard is already protected, so adding a route for
it would only widen the attack surface.

---

## Security notes

Passwords are hashed by Supabase Auth and never stored by this application.
Sessions use httpOnly cookies. Every table has Row Level Security enabled,
so the database itself refuses queries a user should not be able to make,
independently of the application code. Uploaded images are re-encoded with
sharp, which strips EXIF metadata including GPS coordinates.

Known gaps and their planned fixes are tracked in `docs/security.md`.

---

## Status

Under active development.

**Complete:** database schema, project scaffold, authentication (email/password,
password reset, role-based access control), and admin product management
including image upload.

**In progress:** the customer-facing catalog, cart, checkout, and order
management.