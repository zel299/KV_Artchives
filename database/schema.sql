
-- ============================================================
-- KV Artchives Ordering System — Database Schema
-- Platform: Supabase (PostgreSQL)
-- ============================================================
-- Run this in the Supabase SQL Editor.
-- Supabase already provides auth.users; we extend it with profiles.
-- ============================================================


-- ============================================================
-- ENUMS
-- ============================================================
-- Using enums instead of free-text keeps invalid statuses out of
-- the database entirely, rather than relying on app code to behave.

CREATE TYPE user_role AS ENUM ('customer', 'admin');

CREATE TYPE order_status AS ENUM (
  'pending',                -- created at checkout, awaiting admin review
  'confirmed',              -- admin finalized the order
  'awaiting_down_payment',  -- down payment requested; expires in 3 days
  'in_production',          -- down payment confirmed, item being made
  'awaiting_balance',       -- balance + shipping requested
  'ready_to_ship',          -- balance confirmed, tracking being added
  'shipped',                -- with J&T, tracking number provided
  'completed',              -- customer received the order
  'declined',               -- admin declined during finalizing (no payment made)
  'expired',                -- down payment window lapsed unpaid
  'cancelled'               -- cancelled by customer or admin (no refund)
);

CREATE TYPE payment_type AS ENUM ('down_payment', 'balance');

CREATE TYPE payment_status AS ENUM (
  'awaiting',   -- requested, customer has not submitted a reference yet
  'submitted',  -- customer submitted reference number / screenshot
  'confirmed',  -- admin verified against GCash/bank
  'rejected'    -- admin could not verify
);

CREATE TYPE stock_reason AS ENUM (
  'order_placed',      -- stock decreased at checkout
  'order_expired',     -- stock returned, unpaid after 3 days
  'order_cancelled',   -- stock returned, cancelled by customer or admin
  'order_declined',    -- stock returned, admin declined at finalizing
  'manual_adjustment'  -- admin edited the quantity directly
);


-- ============================================================
-- PROFILES
-- ============================================================
-- Supabase's auth.users holds credentials. This table holds everything
-- else and, critically, the role that gates admin access.
-- Role lives here (not in app code) so the check is enforced at the
-- data layer and cannot be bypassed by hitting a URL directly.

CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  email        TEXT NOT NULL,
  contact_no   TEXT,
  role         user_role NOT NULL DEFAULT 'customer',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create a profile whenever someone signs up (email or Google).
-- Without this, a Google sign-in would create an auth user with no profile.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- CATEGORIES
-- ============================================================

CREATE TABLE categories (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- PRODUCTS
-- ============================================================
-- is_archived is a soft delete. Products with order history must never
-- be hard-deleted or past orders would reference a missing product.

CREATE TABLE products (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,          -- e.g. PRD-001
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  quantity      INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  category_id   BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  is_one_of_a_kind BOOLEAN NOT NULL DEFAULT FALSE,  -- drives the badge, not the stock logic
  is_archived   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_active ON products (is_archived, quantity);


-- ============================================================
-- PRODUCT IMAGES
-- ============================================================
-- Separate table because a product can have several photos.
-- Stores the Supabase Storage path, not the file itself.

CREATE TABLE product_images (
  id           BIGSERIAL PRIMARY KEY,
  product_id   BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON product_images (product_id, sort_order);


-- ============================================================
-- CARTS
-- ============================================================
-- One open cart per customer. A guest cart is held in the browser and
-- merged into this table on login, so nothing is lost at checkout.

CREATE TABLE carts (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cart_items (
  id          BIGSERIAL PRIMARY KEY,
  cart_id     BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, product_id)   -- adding the same item again bumps quantity
);


-- ============================================================
-- ORDERS
-- ============================================================
-- Money fields are stored on the order rather than recalculated, so a
-- later price change never rewrites the history of a past order.
--
-- shipping_fee is nullable on purpose: it depends on weight and distance
-- and is only set when the balance is requested, not at checkout.

CREATE TABLE orders (
  id                   BIGSERIAL PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,      -- e.g. KV-001
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status               order_status NOT NULL DEFAULT 'pending',

  -- Shipping snapshot, captured at checkout
  ship_full_name       TEXT NOT NULL,
  ship_contact_no      TEXT NOT NULL,
  ship_address         TEXT NOT NULL,
  ship_city            TEXT NOT NULL,
  ship_province        TEXT NOT NULL,

  -- Money
  subtotal             NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  shipping_fee         NUMERIC(10,2) CHECK (shipping_fee >= 0),
  down_payment_amount  NUMERIC(10,2) NOT NULL CHECK (down_payment_amount >= 0),
  -- Balance = subtotal - down_payment + shipping_fee, computed at request time.

  -- Fulfilment
  tracking_no          TEXT,

  -- Lifecycle timestamps
  down_payment_due_at  TIMESTAMPTZ,   -- set when down payment is requested (+3 days)
  placed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shipped_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  cancel_reason        TEXT,

  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user   ON orders (user_id, placed_at DESC);
CREATE INDEX idx_orders_status ON orders (status, placed_at DESC);
-- Supports the expiry job that sweeps unpaid orders
CREATE INDEX idx_orders_dp_due ON orders (down_payment_due_at)
  WHERE status = 'awaiting_down_payment';


-- ============================================================
-- ORDER ITEMS
-- ============================================================
-- name and unit_price are copied in, not joined. If a product is later
-- renamed or repriced, the order still shows what was actually bought.

CREATE TABLE order_items (
  id           BIGSERIAL PRIMARY KEY,
  order_id     BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  unit_price   NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  line_total   NUMERIC(10,2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX idx_order_items_order ON order_items (order_id);


-- ============================================================
-- PAYMENTS
-- ============================================================
-- Two rows per order in the normal case: down_payment and balance.
-- Separate rows (not columns) mean the down payment record is never
-- overwritten when the balance is submitted.
--
-- reference_no is required from the customer; receipt_path is optional.
-- Neither is treated as proof — admin confirms against GCash/bank.

CREATE TABLE payments (
  id             BIGSERIAL PRIMARY KEY,
  order_id       BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type           payment_type NOT NULL,
  status         payment_status NOT NULL DEFAULT 'awaiting',
  amount_due     NUMERIC(10,2) NOT NULL CHECK (amount_due >= 0),
  reference_no   TEXT,
  receipt_path   TEXT,                    -- optional Supabase Storage path
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at   TIMESTAMPTZ,
  confirmed_at   TIMESTAMPTZ,
  confirmed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  admin_note     TEXT,
  UNIQUE (order_id, type)                 -- one down payment, one balance
);

CREATE INDEX idx_payments_order ON payments (order_id);


-- ============================================================
-- STOCK LOG
-- ============================================================
-- Every quantity change is recorded with a reason. If inventory ever
-- looks wrong, admin can trace exactly what happened instead of guessing.

CREATE TABLE stock_log (
  id           BIGSERIAL PRIMARY KEY,
  product_id   BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id     BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  change       INTEGER NOT NULL,          -- negative = sold, positive = returned
  reason       stock_reason NOT NULL,
  note         TEXT,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_log_product ON stock_log (product_id, created_at DESC);


-- ============================================================
-- ORDER STATUS HISTORY
-- ============================================================
-- Gives the customer a status timeline and gives admin an audit trail
-- of who changed what and when.

CREATE TABLE order_status_history (
  id           BIGSERIAL PRIMARY KEY,
  order_id     BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status  order_status,
  to_status    order_status NOT NULL,
  changed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL = system
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_status_history_order ON order_status_history (order_id, created_at);


-- ============================================================
-- SETTINGS
-- ============================================================
-- Single-row table for shop configuration. Lets admin change the GCash
-- QR code and account details without a developer.

CREATE TABLE settings (
  id                    BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),  -- forces one row
  gcash_qr_path         TEXT,
  gcash_account_name    TEXT,
  gcash_account_number  TEXT,
  bank_details          TEXT,
  instagram_url         TEXT,
  facebook_url          TEXT,
  down_payment_percent  NUMERIC(5,2) NOT NULL DEFAULT 60.00
                          CHECK (down_payment_percent > 0 AND down_payment_percent <= 100),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO settings (id) VALUES (TRUE);


-- ============================================================
-- ORDER CODE GENERATOR
-- ============================================================
-- Produces KV-001, KV-002, ... Sequence-based so two simultaneous
-- checkouts can never collide on the same code.

CREATE SEQUENCE order_code_seq START 1;

CREATE OR REPLACE FUNCTION set_order_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'KV-' || LPAD(nextval('order_code_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_order_code
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION set_order_code();


-- Same idea for product codes: PRD-001, PRD-002, ...
CREATE SEQUENCE product_code_seq START 1;

CREATE OR REPLACE FUNCTION set_product_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'PRD-' || LPAD(nextval('product_code_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_product_code
  BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION set_product_code();


-- ============================================================
-- updated_at MAINTENANCE
-- ============================================================

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_products_touch BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_orders_touch   BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_carts_touch    BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_settings_touch BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Defence in depth. Even if a route forgets an auth check, the database
-- will not hand a customer someone else's order.

ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images       ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings             ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Profiles: you see and edit your own; admin sees all.
CREATE POLICY profiles_self_read ON profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY profiles_self_update ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Catalog: anyone may browse active products; only admin may change them.
CREATE POLICY products_public_read ON products
  FOR SELECT USING (is_archived = FALSE OR is_admin());
CREATE POLICY products_admin_write ON products
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY product_images_public_read ON product_images
  FOR SELECT USING (TRUE);
CREATE POLICY product_images_admin_write ON product_images
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY categories_public_read ON categories
  FOR SELECT USING (TRUE);
CREATE POLICY categories_admin_write ON categories
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Carts belong to their owner only.
CREATE POLICY carts_own ON carts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY cart_items_own ON cart_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_id AND c.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_id AND c.user_id = auth.uid())
  );

-- Orders: a customer sees only their own; admin sees and manages all.
CREATE POLICY orders_own_read ON orders
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY orders_own_insert ON orders
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY orders_admin_update ON orders
  FOR UPDATE USING (is_admin() OR user_id = auth.uid());

CREATE POLICY order_items_read ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o
            WHERE o.id = order_id AND (o.user_id = auth.uid() OR is_admin()))
  );
CREATE POLICY order_items_insert ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );

-- Payments: customer may read their own and submit a reference number.
-- Only admin may confirm.
CREATE POLICY payments_read ON payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o
            WHERE o.id = order_id AND (o.user_id = auth.uid() OR is_admin()))
  );
CREATE POLICY payments_customer_update ON payments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );
CREATE POLICY payments_admin_all ON payments
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Audit tables: readable by the order owner and admin; written by the server.
CREATE POLICY status_history_read ON order_status_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o
            WHERE o.id = order_id AND (o.user_id = auth.uid() OR is_admin()))
  );
CREATE POLICY stock_log_admin ON stock_log
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Settings: publicly readable (the storefront needs the QR code and
-- social links); only admin may change them.
CREATE POLICY settings_public_read ON settings
  FOR SELECT USING (TRUE);
CREATE POLICY settings_admin_write ON settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ============================================================
-- SEED DATA (optional, for development)
-- ============================================================

INSERT INTO categories (name) VALUES
  ('Keychains'), ('Trinket Dishes'), ('Magnets'), ('Charms')
ON CONFLICT (name) DO NOTHING;