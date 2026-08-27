
const { supabaseAdmin, supabaseAnon } = require('../config/supabase');

/**
 * Product service
 * ---------------
 * Every query that touches the products table lives here. Routes and
 * controllers call these functions instead of writing their own queries,
 * so a rule like "hide archived products" is defined once rather than
 * repeated (and eventually forgotten) in several places.
 *
 * Two Supabase clients are used deliberately:
 *
 *   supabaseAnon  — for customer-facing reads. Row Level Security applies,
 *                   so the database itself refuses to return archived
 *                   products even if this code asked for them.
 *
 *   supabaseAdmin — for admin work. Bypasses RLS, because admin genuinely
 *                   needs to see archived rows and change stock.
 */

// Columns pulled for list views. Images come from a joined table.
const LIST_COLUMNS = `
  id, code, name, price, quantity, is_one_of_a_kind, is_archived, created_at,
  category:categories ( id, name ),
  images:product_images ( id, storage_path, sort_order )
`;

/**
 * Shape a raw database row into something the views can use directly.
 *
 * The important part is stock: customers must never see the raw number.
 * We expose a boolean instead, so a template cannot accidentally print
 * "2 left" even if someone writes the wrong variable.
 */
function toPublicProduct(row) {
  if (!row) return null;

  const images = (row.images || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    inStock: row.quantity > 0,
    isOneOfAKind: row.is_one_of_a_kind,
    category: row.category || null,
    images,
    primaryImage: images[0] || null,
  };
}

/** Admin view of a row: same shape, plus the fields only admin should see. */
function toAdminProduct(row) {
  if (!row) return null;
  return {
    ...toPublicProduct(row),
    quantity: row.quantity,
    isArchived: row.is_archived,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------
// Customer-facing reads
// ---------------------------------------------------------------

/**
 * Products for the public catalog.
 *
 * Archived products are excluded. Sold-out products are still returned —
 * they show a "Sold out" badge rather than disappearing, which reads as
 * a busy shop rather than an empty one.
 */
async function listAvailable({ search, categoryId, page = 1, perPage = 12 } = {}) {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabaseAnon
    .from('products')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('is_archived', false);

  if (search) query = query.ilike('name', `%${search}%`);
  if (categoryId) query = query.eq('category_id', categoryId);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(`listAvailable failed: ${error.message}`);

  return {
    products: (data || []).map(toPublicProduct),
    total: count || 0,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil((count || 0) / perPage)),
  };
}

/** One product for the detail page. Returns null if missing or archived. */
async function getPublicById(id) {
  const { data, error } = await supabaseAnon
    .from('products')
    .select(`${LIST_COLUMNS}, description`)
    .eq('id', id)
    .eq('is_archived', false)
    .maybeSingle();

  if (error) throw new Error(`getPublicById failed: ${error.message}`);
  return toPublicProduct(data);
}

// ---------------------------------------------------------------
// Admin reads
// ---------------------------------------------------------------

/**
 * Products for the admin table.
 *
 * `archived` selects which set to show: false for the main list, true for
 * the archived view, or 'all' for both.
 */
async function listAll({
  search,
  categoryId,
  archived = false,
  page = 1,
  perPage = 10,
} = {}) {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabaseAdmin
    .from('products')
    .select(`${LIST_COLUMNS}, description`, { count: 'exact' });

  if (archived !== 'all') query = query.eq('is_archived', archived);
  if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  if (categoryId) query = query.eq('category_id', categoryId);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(`listAll failed: ${error.message}`);

  return {
    products: (data || []).map(toAdminProduct),
    total: count || 0,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil((count || 0) / perPage)),
  };
}

/** One product for the admin detail or edit screen, archived included. */
async function getById(id) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select(`${LIST_COLUMNS}, description`)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`getById failed: ${error.message}`);
  return toAdminProduct(data);
}

// ---------------------------------------------------------------
// Admin writes
// ---------------------------------------------------------------

/**
 * Create a product.
 *
 * The product code (PRD-001, PRD-002, …) is generated by a database
 * trigger, not here, so two simultaneous inserts cannot collide.
 *
 * The opening stock is written through adjustStock so it lands in the
 * stock log like every other change, rather than appearing from nowhere.
 */
async function create({ name, description, price, quantity, categoryId, isOneOfAKind }, adminId) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .insert({
      name,
      description: description || null,
      price,
      quantity: 0,
      category_id: categoryId || null,
      is_one_of_a_kind: !!isOneOfAKind,
    })
    .select('id')
    .single();

  if (error) throw new Error(`create failed: ${error.message}`);

  const openingStock = Number(quantity) || 0;
  if (openingStock > 0) {
    await adjustStock(data.id, openingStock, 'manual_adjustment', {
      note: 'Opening stock',
      adminId,
    });
  }

  return data.id;
}

/**
 * Update a product's details.
 *
 * Stock is not editable here on purpose. Quantity changes go through
 * adjustStock so every movement is recorded with a reason.
 */
async function update(id, { name, description, price, categoryId, isOneOfAKind }) {
  const { error } = await supabaseAdmin
    .from('products')
    .update({
      name,
      description: description || null,
      price,
      category_id: categoryId || null,
      is_one_of_a_kind: !!isOneOfAKind,
    })
    .eq('id', id);

  if (error) throw new Error(`update failed: ${error.message}`);
}

/**
 * Archive a product (soft delete).
 *
 * Products are never hard-deleted once they appear in an order, or that
 * order's history would point at a row that no longer exists.
 */
async function archive(id) {
  const { error } = await supabaseAdmin
    .from('products')
    .update({ is_archived: true })
    .eq('id', id);

  if (error) throw new Error(`archive failed: ${error.message}`);
}

async function restore(id) {
  const { error } = await supabaseAdmin
    .from('products')
    .update({ is_archived: false })
    .eq('id', id);

  if (error) throw new Error(`restore failed: ${error.message}`);
}

/**
 * True only when a product has never been ordered, which is the only case
 * where a permanent delete is safe.
 */
async function canHardDelete(id) {
  const { count, error } = await supabaseAdmin
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', id);

  if (error) throw new Error(`canHardDelete failed: ${error.message}`);
  return (count || 0) === 0;
}

/** Permanently remove a product. Refuses if it has order history. */
async function hardDelete(id) {
  const safe = await canHardDelete(id);
  if (!safe) {
    throw new Error(
      'This product appears in past orders and cannot be deleted. Archive it instead.'
    );
  }

  const { error } = await supabaseAdmin.from('products').delete().eq('id', id);
  if (error) throw new Error(`hardDelete failed: ${error.message}`);
}

// ---------------------------------------------------------------
// Stock
// ---------------------------------------------------------------

/**
 * Change a product's stock and record why, in one operation.
 *
 * Keeping the update and the log entry together means the audit trail
 * cannot be skipped by forgetting a second call. Every movement — a sale,
 * an expired order returning stock, an admin correction — is traceable.
 *
 * `change` is signed: -2 sold two, +2 returned two.
 */
async function adjustStock(productId, change, reason, { orderId, note, adminId } = {}) {
  const { data: product, error: readErr } = await supabaseAdmin
    .from('products')
    .select('quantity')
    .eq('id', productId)
    .single();

  if (readErr) throw new Error(`adjustStock read failed: ${readErr.message}`);

  const next = product.quantity + change;
  if (next < 0) {
    throw new Error(
      `Not enough stock: have ${product.quantity}, tried to change by ${change}.`
    );
  }

  const { error: writeErr } = await supabaseAdmin
    .from('products')
    .update({ quantity: next })
    .eq('id', productId);

  if (writeErr) throw new Error(`adjustStock write failed: ${writeErr.message}`);

  const { error: logErr } = await supabaseAdmin.from('stock_log').insert({
    product_id: productId,
    order_id: orderId || null,
    change,
    reason,
    note: note || null,
    created_by: adminId || null,
  });

  if (logErr) console.error('[stock] log entry failed:', logErr.message);

  return next;
}

/** Set stock to an exact figure. Converts it to a signed change internally. */
async function setStock(productId, newQuantity, { note, adminId } = {}) {
  const { data: product, error } = await supabaseAdmin
    .from('products')
    .select('quantity')
    .eq('id', productId)
    .single();

  if (error) throw new Error(`setStock read failed: ${error.message}`);

  const change = Number(newQuantity) - product.quantity;
  if (change === 0) return product.quantity;

  return adjustStock(productId, change, 'manual_adjustment', {
    note: note || `Set to ${newQuantity}`,
    adminId,
  });
}

// ---------------------------------------------------------------
// Categories
// ---------------------------------------------------------------

async function listCategories() {
  const { data, error } = await supabaseAnon
    .from('categories')
    .select('id, name')
    .order('name');

  if (error) throw new Error(`listCategories failed: ${error.message}`);
  return data || [];
}

async function addImages(productId, paths) {
  if (!paths || paths.length === 0) return;

  const { data: existing } = await supabaseAdmin
    .from("product_images")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
    .limit(1);
  
    let next = existing && existing.length ? existing[0].sort_order + 1 : 0;

    const rows = paths.maps((path) => ({
      product_id: productId,
      storage_path: path,
      sort_order: next++,
    }));

    const { error } = await supabaseAdmin.from("product_images").insert(rows);

    if (error) throw new Error(`addImages failed: ${error.message}`);
}

module.exports = {
  listAvailable,
  getPublicById,
  listAll,
  getById,
  create,
  update,
  archive,
  restore,
  canHardDelete,
  hardDelete,
  adjustStock,
  setStock,
  listCategories,
  addImages
};