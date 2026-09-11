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

module.exports = { placeOrder, insertOrder, createOrder };