
const { supabaseAdmin } = require("../config/supabase");
const money = require("../utils/money");

const LIST_COLUMNS = `
  id, code, status, subtotal, shipping_fee, down_payment_amount,
  ship_full_name, ship_contact_no, placed_at, down_payment_due_at,
  customer:profiles ( id, full_name, email ),
  items:order_items ( id, product_name, quantity, line_total )
`;

async function listOrders({ status = null, search = "", page = 1, perPage = 15 } = {}) {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabaseAdmin
    .from("orders")
    .select(LIST_COLUMNS, { count: "exact" });

  if (status) {
    query = Array.isArray(status)
      ? query.in("status", status)
      : query.eq("status", status);
  }

  if (search) {
    query = query.or(`code.ilike.%${search}%,ship_full_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query
    .order("placed_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`listOrders failed: ${error.message}`);

  return {
    orders: (data || []).map(toAdminOrder),
    total: count || 0,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil((count || 0) / perPage)),
  };
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

function toAdminOrder(row) {
  if (!row) return null;

  const payments = row.payments || [];
  const downPayment = payments.find((p) => p.type === "down_payment") || null;
  const balance = payments.find((p) => p.type === "balance") || null;

  const subtotal = Number(row.subtotal);
  const downPaymentAmount = Number(row.down_payment_amount);
  const shippingFee = row.shipping_fee === null ? null : Number(row.shipping_fee);

  return {
    id: row.id,
    code: row.code,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,

    customer: row.customer || null,

    subtotal,
    shippingFee,
    downPaymentAmount,
    balanceAmount:
      shippingFee === null
        ? null
        : money.calcBalance(subtotal, downPaymentAmount, shippingFee),

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
      unitPrice: item.unit_price === undefined ? null : Number(item.unit_price),
      quantity: item.quantity,
      lineTotal: Number(item.line_total),
    })),

    downPayment,
    balance,
    history: (row.history || [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
  };
}

async function getOrder(orderId) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(`
      id, code, status, subtotal, shipping_fee, down_payment_amount,
      ship_full_name, ship_contact_no, ship_address, ship_barangay,
      ship_city, ship_province, ship_zip, customer_note,
      tracking_no, down_payment_due_at, placed_at, shipped_at,
      completed_at, cancelled_at, cancel_reason,
      customer:profiles ( id, full_name, email, contact_no ),
      items:order_items ( id, product_id, product_name, unit_price, quantity, line_total ),
      payments ( id, type, status, amount_due, reference_no, receipt_path, requested_at, submitted_at, confirmed_at, admin_note ),
      history:order_status_history ( id, from_status, to_status, note, created_at, changed_by )
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(`getOrder failed: ${error.message}`);
  return toAdminOrder(data);
}

async function receiptUrl(path) {
  if (!path) return null;

  const { data, error } = await supabaseAdmin.storage
    .from("receipts")
    .createSignedUrl(path, 60);

  if (error) {
    console.error("[receipt] signed url failed:", error.message);
    return null;
  }

  return data.signedUrl;
}

async function changeStatus(orderId, fromStatus, toStatus, adminId, note = null, extra = {}) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({ status: toStatus, ...extra })
    .eq("id", orderId)
    .eq("status", fromStatus)
    .select("id, code, status")
    .maybeSingle();

  if (error) throw new Error(`changeStatus failed: ${error.message}`);

  if (!data) {
    throw new Error(
      "That order has already moved on. Refresh the page and try again."
    );
  }

  await supabaseAdmin.from("order_status_history").insert({
    order_id: orderId,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: adminId,
    note,
  });

  return data;
}

async function confirmOrder(orderId, adminId, note = null) {
  return changeStatus(orderId, "pending", "confirmed", adminId, note);
}

async function declineOrder(orderId, adminId, reason) {
  if (!reason || !reason.trim()) {
    throw new Error("Give a reason so the customer knows why.");
  }

  const order = await getOrder(orderId);
  if (!order) throw new Error("That order does not exist.");

  const result = await changeStatus(
    orderId,
    "pending",
    "declined",
    adminId,
    reason.trim(),
    { cancelled_at: new Date().toISOString(), cancel_reason: reason.trim() }
  );

  await returnStock(order, adminId, "order_declined");

  return result;
}

async function returnStock(order, adminId, reason) {
  for (const item of order.items) {
    const { error } = await supabaseAdmin.rpc("decrement_stock", {
      p_product_id: item.productId,
      p_quantity: -item.quantity,
    });

    if (error) {
      console.error("[stock] return failed:", error.message);
      continue;
    }

    await supabaseAdmin.from("stock_log").insert({
      product_id: item.productId,
      order_id: order.id,
      change: item.quantity,
      reason,
      created_by: adminId,
    });
  }
}

const DOWN_PAYMENT_DAYS = 3;

async function requestDownPayment(orderId, adminId) {
  const order = await getOrder(orderId);
  if (!order) throw new Error("That order does not exist.");

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + DOWN_PAYMENT_DAYS);

  const result = await changeStatus(
    orderId,
    "confirmed",
    "awaiting_down_payment",
    adminId,
    `Down payment of ${money.formatPeso(order.downPaymentAmount)} requested`,
    { down_payment_due_at: dueAt.toISOString() }
  );

  const { error } = await supabaseAdmin.from("payments").upsert(
    {
      order_id: orderId,
      type: "down_payment",
      status: "awaiting",
      amount_due: order.downPaymentAmount,
      requested_at: new Date().toISOString(),
    },
    { onConflict: "order_id,type" }
  );

  if (error) throw new Error(`requestDownPayment payment row failed: ${error.message}`);

  return result;
}

async function confirmDownPayment(orderId, adminId, adminNote = null) {
  const { data: payment, error: readErr } = await supabaseAdmin
    .from("payments")
    .select("id, status")
    .eq("order_id", orderId)
    .eq("type", "down_payment")
    .maybeSingle();

  if (readErr) throw new Error(`confirmDownPayment read failed: ${readErr.message}`);
  if (!payment) throw new Error("No down payment has been requested for this order.");
  if (payment.status === "confirmed") throw new Error("That payment is already confirmed.");

  const { error: payErr } = await supabaseAdmin
    .from("payments")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirmed_by: adminId,
      admin_note: adminNote,
    })
    .eq("id", payment.id);

  if (payErr) throw new Error(`confirmDownPayment update failed: ${payErr.message}`);

  return changeStatus(
    orderId,
    "awaiting_down_payment",
    "in_production",
    adminId,
    "Down payment confirmed"
  );
}

async function requestBalance(orderId, adminId, shippingFee) {
  const fee = money.toAmount(shippingFee);

  if (!Number.isFinite(fee) || fee < 0) {
    throw new Error("Enter a valid shipping fee.");
  }

  const order = await getOrder(orderId);
  if (!order) throw new Error("That order does not exist.");

  const balanceDue = money.calcBalance(
    order.subtotal,
    order.downPaymentAmount,
    fee
  );

  const result = await changeStatus(
    orderId,
    "in_production",
    "awaiting_balance",
    adminId,
    `Balance of ${money.formatPeso(balanceDue)} requested (shipping ${money.formatPeso(fee)})`,
    { shipping_fee: fee }
  );

  const { error } = await supabaseAdmin.from("payments").upsert(
    {
      order_id: orderId,
      type: "balance",
      status: "awaiting",
      amount_due: balanceDue,
      requested_at: new Date().toISOString(),
    },
    { onConflict: "order_id,type" }
  );

  if (error) throw new Error(`requestBalance payment row failed: ${error.message}`);

  return result;
}

async function confirmBalance(orderId, adminId, adminNote = null) {
  const { data: payment, error: readErr } = await supabaseAdmin
    .from("payments")
    .select("id, status")
    .eq("order_id", orderId)
    .eq("type", "balance")
    .maybeSingle();

  if (readErr) throw new Error(`confirmBalance read failed: ${readErr.message}`);
  if (!payment) throw new Error("No balance has been requested for this order.");
  if (payment.status === "confirmed") throw new Error("That payment is already confirmed.");

  const { error: payErr } = await supabaseAdmin
    .from("payments")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirmed_by: adminId,
      admin_note: adminNote,
    })
    .eq("id", payment.id);

  if (payErr) throw new Error(`confirmBalance update failed: ${payErr.message}`);

  return changeStatus(
    orderId,
    "awaiting_balance",
    "ready_to_ship",
    adminId,
    "Balance confirmed"
  );
}

async function markShipped(orderId, adminId, trackingNo) {
  const tracking = (trackingNo || "").trim();

  if (!tracking) {
    throw new Error("Enter a tracking number.");
  }

  return changeStatus(
    orderId,
    "ready_to_ship",
    "shipped",
    adminId,
    `Shipped with tracking ${tracking}`,
    { tracking_no: tracking, shipped_at: new Date().toISOString() }
  );
}

async function markCompleted(orderId, adminId) {
  return changeStatus(
    orderId,
    "shipped",
    "completed",
    adminId,
    "Order completed",
    { completed_at: new Date().toISOString() }
  );
}

async function cancelOrder(orderId, adminId, reason) {
  if (!reason || !reason.trim()) {
    throw new Error("Give a reason for the cancellation.");
  }

  const order = await getOrder(orderId);
  if (!order) throw new Error("That order does not exist.");

  const TERMINAL = ["completed", "cancelled", "declined", "expired"];
  if (TERMINAL.includes(order.status)) {
    throw new Error("That order is already closed.");
  }

  const result = await changeStatus(
    orderId,
    order.status,
    "cancelled",
    adminId,
    reason.trim(),
    { cancelled_at: new Date().toISOString(), cancel_reason: reason.trim() }
  );

  await returnStock(order, adminId, "order_cancelled");

  return result;
}

module.exports = {
  listOrders,
  getOrder,
  receiptUrl,
  confirmOrder,
  declineOrder,
  returnStock,
  requestDownPayment,
  confirmDownPayment,
  requestBalance,
  confirmBalance,
  markShipped,
  markCompleted,
  cancelOrder,
  STATUS_LABELS,
};