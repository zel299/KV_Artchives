const cartService = require("../services/cartService");
const orderService = require("../services/orderService");
const money = require("../utils/money");

const FIELDS = [
  "full_name",
  "contact_no",
  "address",
  "barangay",
  "city",
  "province",
  "zip",
  "customer_note",
];


function readValues(body) {
  const values = {};
  for (const field of FIELDS) {
    values[field] = (body[field] || "").trim();
  }
  return values;
}

async function showDetails(req, res, next) {
  try {
    const { items } = await cartService.getCartItems(req.db, req.user.id);
    if (items.length === 0) return res.redirect("/cart");

    const last = await orderService.getLastShippingDetails(req.db, req.user.id);

    res.render("customer/customer-details", {
      title: "Checkout",
      pageCss: "customer-details",
      values: last || {
        full_name: req.user.full_name || "",
        contact_no: req.user.contact_no || "",
        address: "",
        barangay: "",
        city: "",
        province: "",
        zip: "",
        customer_note: "",
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function showReview(req, res, next) {
  const values = readValues(req.body);

  try {
    const { items, subtotal } = await cartService.getCartItems(req.db, req.user.id);
    if (items.length === 0) return res.redirect("/cart");

    const missing = FIELDS.filter(
      (field) => field !== "customer_note" && !values[field]
    );

    if (missing.length > 0) {
      return res.status(400).render("customer/customer-details", {
        title: "Checkout",
        pageCss: "customer-details",
        values,
        error: "Please fill in every delivery field.",
      });
    }

    res.render("customer/order-summary", {
      title: "Review your order",
      pageCss: "order-summary",
      items,
      subtotal,
      downPayment: money.calcDownPayment(subtotal),
      values,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function doCheckout(req, res, next) {
  const values = readValues(req.body);

  try {
    const { items, subtotal } = await cartService.getCartItems(req.db, req.user.id);
    if (items.length === 0) return res.redirect("/cart");

    const missing = FIELDS.filter(
      (field) => field !== "customer_note" && !values[field]
    );

    if (missing.length > 0) {
      return res.status(400).render("customer/customer-details", {
        title: "Checkout",
        pageCss: "customer-details",
        values,
        error: "Please fill in every delivery field.",
      });
    }

    const { lines, subtotal: finalSubtotal, downPayment } =
      await orderService.placeOrder(req.user.id, items, values);

    const order = await orderService.insertOrder(
      req.user.id,
      lines,
      finalSubtotal,
      downPayment,
      values
    );

    await cartService.clearCart(req.db, req.user.id);

    res.redirect(`/orders/${order.id}/submitted`);
  } catch (err) {
    if (err.message && !err.message.includes("failed:")) {
      const { items, subtotal } = await cartService.getCartItems(req.db, req.user.id);

      return res.status(400).render("customer/order-summary", {
        title: "Review your order",
        pageCss: "order-summary",
        items,
        subtotal,
        downPayment: money.calcDownPayment(subtotal),
        values,
        error: err.message,
      });
    }

    next(err);
  }
}

module.exports = { showDetails, showReview, doCheckout };
