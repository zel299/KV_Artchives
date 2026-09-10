
const { supabaseAdmin } = require("../config/supabase");
const productService = require("./productService");

async function getOrCreateCart(db, userId) {
  const { data: existing, error: readErr } = await db
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (readErr) throw new Error(`getOrCreateCart read failed: ${readErr.message}`);
  if (existing) return existing.id;

  const { data: created, error: writeErr } = await db
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (writeErr) throw new Error(`getOrCreateCart insert failed: ${writeErr.message}`);
  return created.id;
}



async function getCartItems(db, userId) {
  const cartId = await getOrCreateCart(db, userId);

  const { data, error } = await db
    .from("cart_items")
    .select("id, product_id, quantity")
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getCartItems failed: ${error.message}`);
  if (!data || data.length === 0) return { cartId, items: [], subtotal: 0 };

  const products = await productService.getManyPublic(
    data.map((row) => row.product_id)
  );

  const items = data
    .map((row) => {
      const product = products.find((p) => String(p.id) === String(row.product_id));
      if (!product) return null;

      return {
        id: row.id,
        quantity: row.quantity,
        product,
        lineTotal: product.price * row.quantity,
      };
    })
    .filter(Boolean);

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return { cartId, items, subtotal };
}

async function addItem(db, userId, productId, quantity = 1) {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));

  const product = await productService.getPublicById(productId);
  if (!product) throw new Error("That product is no longer available.");
  if (!product.inStock) throw new Error("That product is sold out.");

  const cartId = await getOrCreateCart(db, userId);

  const { data: existing, error: readErr } = await db
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cartId)
    .eq("product_id", productId)
    .maybeSingle();

  if (readErr) throw new Error(`addItem read failed: ${readErr.message}`);

  if (existing) {
    const { error } = await db
      .from("cart_items")
      .update({ quantity: existing.quantity + qty })
      .eq("id", existing.id);

    if (error) throw new Error(`addItem update failed: ${error.message}`);
    return;
  }

  const { error } = await db
    .from("cart_items")
    .insert({ cart_id: cartId, product_id: productId, quantity: qty });

  if (error) throw new Error(`addItem insert failed: ${error.message}`);
}

async function updateItem(db, userId, itemId, quantity) {
  const qty = Math.floor(Number(quantity) || 0);

  if (qty <= 0) return removeItem(db, userId, itemId);

  const cartId = await getOrCreateCart(db, userId);

  const { error } = await db
    .from("cart_items")
    .update({ quantity: qty })
    .eq("id", itemId)
    .eq("cart_id", cartId);

  if (error) throw new Error(`updateItem failed: ${error.message}`);
}

async function removeItem(db, userId, itemId) {
  const cartId = await getOrCreateCart(db, userId);

  const { error } = await db
    .from("cart_items")
    .delete()
    .eq("id", itemId)
    .eq("cart_id", cartId);

  if (error) throw new Error(`removeItem failed: ${error.message}`);
}

async function clearCart(db, userId) {
  const cartId = await getOrCreateCart(db, userId);

  const { data, error } = await db
    .from("cart_items")
    .delete()
    .eq("cart_id", cartId)
    .select("id");

  if (error) throw new Error(`clearCart failed: ${error.message}`);

  return (data || []).length;
}

const GUEST_COOKIE = "kv_cart";

const GUEST_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 1000 * 60 * 60 * 24 * 30,
};

function readGuestCart(req) {
  const raw = req.cookies?.[GUEST_COOKIE];
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((row) => row && row.p)
      .map((row) => ({
        productId: row.p,
        quantity: Math.max(1, Math.floor(Number(row.q) || 1)),
      }))
      .slice(0, 50);
  } catch {
    return [];
  }
}

function writeGuestCart(res, items) {
  const compact = items.map((item) => ({ p: item.productId, q: item.quantity }));
  res.cookie(GUEST_COOKIE, JSON.stringify(compact), GUEST_COOKIE_OPTS);
}

function clearGuestCart(res) {
  res.clearCookie(GUEST_COOKIE);
}

async function mergeGuestCart(db, userId, req, res) {
  const guestItems = readGuestCart(req);
  if (guestItems.length === 0) return;

  for (const item of guestItems) {
    try {
      await addItem(db, userId, item.productId, item.quantity);
    } catch (err) {
      console.error("[cart] merge skipped an item:", err.message);
    }
  }

  clearGuestCart(res);
}

module.exports = {
  getOrCreateCart,
  getCartItems,
  addItem,
  updateItem,
  removeItem,
  clearCart, 
  readGuestCart, 
  writeGuestCart, 
  clearGuestCart, 
  mergeGuestCart
};