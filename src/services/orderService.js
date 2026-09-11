const { supabaseAdmin } = require("../config/supabase");
const productService = require("./productService");
const money = require("../utils/money");

async function createOrder(db, userId, cartItems, shipping) {
  if (!cartItems || cartItems.length === 0) {
    throw new Error("Your cart is empty.");
  }

  const productIds = cartItems.map((item) => item.product.id);
  const products = await productService.getManyPublic(productIds);

  const lines = cartItems.map((item) => {
    const product = products.find((p) => String(p.id) === String(item.product.id));

    if (!product) {
      throw new Error(`${item.product.name} is no longer available.`);
    }

    if (!product.inStock) {
      throw new Error(`${product.name} is sold out.`);
    }

    return {
      product_id: product.id,
      product_name: product.name,
      unit_price: product.price,
      quantity: item.quantity,
      line_total: money.toAmount(product.price * item.quantity),
    };
  });

  const subtotal = money.calcSubtotal(lines);
  const downPayment = money.calcDownPayment(subtotal);

  return { lines, subtotal, downPayment };
}

async function placeOrder(userId, cartItems, shipping) {
  const { lines, subtotal, downPayment } = await createOrder(
    null,
    userId,
    cartItems,
    shipping
  );

  const decremented = [];

  try {
    for (const line of lines) {
      const { error } = await supabaseAdmin.rpc("decrement_stock", {
        p_product_id: line.product_id,
        p_quantity: line.quantity,
      });

      if (error) {
        throw new Error(`${line.product_name} is no longer available in that quantity.`);
      }

      decremented.push(line);
    }
  } catch (err) {
    await restoreStock(decremented);
    throw err;
  }

  return { lines, subtotal, downPayment, decremented };
}

async function restoreStock(lines) {
  for (const line of lines) {
    const { error } = await supabaseAdmin.rpc("decrement_stock", {
      p_product_id: line.product_id,
      p_quantity: -line.quantity,
    });

    if (error) console.error("[stock] restore failed:", error.message);
  }
}

async function insertOrder(userId, lines, subtotal, downPayment, shipping) {
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: userId,
      status: "pending",
      ship_full_name: shipping.full_name,
      ship_contact_no: shipping.contact_no,
      ship_address: shipping.address,
      ship_barangay: shipping.barangay,
      ship_city: shipping.city,
      ship_province: shipping.province,
      ship_zip: shipping.zip,
      customer_note: shipping.customer_note || null,
      subtotal,
      down_payment_amount: downPayment,
    })
    .select("id, code")
    .single();

  if (orderErr) throw new Error(`insertOrder failed: ${orderErr.message}`);

  const itemRows = lines.map((line) => ({
    order_id: order.id,
    product_id: line.product_id,
    product_name: line.product_name,
    unit_price: line.unit_price,
    quantity: line.quantity,
    line_total: line.line_total,
  }));

  const { error: itemsErr } = await supabaseAdmin
    .from("order_items")
    .insert(itemRows);

  if (itemsErr) throw new Error(`insertOrder items failed: ${itemsErr.message}`);

  await supabaseAdmin.from("order_status_history").insert({
    order_id: order.id,
    from_status: null,
    to_status: "pending",
    changed_by: null,
    note: "Order placed by customer",
  });

  for (const line of lines) {
    await supabaseAdmin.from("stock_log").insert({
      product_id: line.product_id,
      order_id: order.id,
      change: -line.quantity,
      reason: "order_placed",
      created_by: userId,
    });
  }

  return order;
}

async function getOrderForCustomer(db, orderId, userId) {
  const { data, error } = await db
    .from("orders")
    .select(`
      id, code, status, subtotal, shipping_fee, down_payment_amount,
      ship_full_name, ship_contact_no, ship_address, ship_barangay,
      ship_city, ship_province, ship_zip, customer_note,
      tracking_no, down_payment_due_at, placed_at, shipped_at,
      completed_at, cancelled_at, cancel_reason,
      items:order_items ( id, product_id, product_name, unit_price, quantity, line_total ),
      payments ( id, type, status, amount_due, reference_no, requested_at, submitted_at, confirmed_at ),
      history:order_status_history ( id, from_status, to_status, note, created_at )
    `)
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`getOrderForCustomer failed: ${error.message}`);
  return toCustomerOrder(data);
}

const STATUS_LABELS = {
  pending: "Pending review",
  confirmed: "Confirmed",
  awaiting_down_payment: "Awaiting down payment",
  in_production: "In production",
  awaiting_balance: "Awaiting balance",
  ready_to_ship: "Ready to ship",
  shipped: "Shipped",
  completed: "Completed",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

const ORDER_TABS = {
  all: null,
  to_pay: ["awaiting_down_payment", "awaiting_balance"],
  to_confirm: ["pending"],
  in_progress: ["confirmed", "in_production"],
  to_ship: ["ready_to_ship", "shipped"],
  completed: ["completed"],
  cancelled: ["cancelled", "declined", "expired"],
};

function toCustomerOrder(row) {
  if (!row) return null;

  const payments = row.payments || [];
  const downPayment = payments.find((p) => p.type === "down_payment") || null;
  const balance = payments.find((p) => p.type === "balance") || null;

  const history = (row.history || [])
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return {
    id: row.id,
    code: row.code,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,

    subtotal: Number(row.subtotal),
    shippingFee: row.shipping_fee === null ? null : Number(row.shipping_fee),
    downPaymentAmount: Number(row.down_payment_amount),

    shipping: {
      fullName: row.ship_full_name,
      contactNo: row.ship_contact_no,
      address: row.ship_address,
      barangay: row.ship_barangay,
      city: row.ship_city,
      province: row.ship_province,
      zip: row.ship_zip,
    },

    customerNote: row.customer_note,
    trackingNo: row.tracking_no,

    downPaymentDueAt: row.down_payment_due_at,
    placedAt: row.placed_at,
    shippedAt: row.shipped_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,

    items: (row.items || []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.product_name,
      unitPrice: Number(item.unit_price),
      quantity: item.quantity,
      lineTotal: Number(item.line_total),
    })),

    downPayment,
    balance,
    history,
  };
}

async function listOrdersForCustomer(db, userId, status = null) {
  let query = db
    .from("orders")
    .select(`
      id, code, status, subtotal, shipping_fee, down_payment_amount,
      placed_at, down_payment_due_at,
      items:order_items ( id, product_id, product_name, quantity, line_total )
    `)
    .eq("user_id", userId);

  if (status) {
    query = Array.isArray(status)
      ? query.in("status", status)
      : query.eq("status", status);
  }

  const { data, error } = await query.order("placed_at", { ascending: false });

  if (error) throw new Error(`listOrdersForCustomer failed: ${error.message}`);

  return (data || []).map((row) => ({
    id: row.id,
    code: row.code,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    subtotal: Number(row.subtotal),
    downPaymentAmount: Number(row.down_payment_amount),
    placedAt: row.placed_at,
    downPaymentDueAt: row.down_payment_due_at,
    itemCount: (row.items || []).reduce((sum, i) => sum + i.quantity, 0),
    items: (row.items || []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.product_name,
      quantity: item.quantity,
      lineTotal: Number(item.line_total),
    })),
  }));
}

module.exports = { placeOrder, insertOrder, createOrder, getOrderForCustomer, toCustomerOrder, listOrdersForCustomer, STATUS_LABELS, ORDER_TABS };