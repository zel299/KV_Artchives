
const cartService = require("../services/cartService");
const orderService = require("../services/orderService");
const money = require("../utils/money");

async function showCheckout(req, res, next) {
  try {
    const { items, subtotal } = await cartService.getCartItems(req.db, req.user.id);

    if (items.length === 0) return res.redirect("/cart");

    res.render("customer/checkout", {
      title: "Checkout",
      pageCss: "checkout",
      items,
      subtotal,
      downPayment: money.calcDownPayment(subtotal),
      values: {
        full_name: req.user.full_name || "",
        contact_no: req.user.contact_no || "",
        address: "",
        city: "",
        province: "",
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function doCheckout(req, res, next) {
  const values = {
    full_name: (req.body.full_name || "").trim(),
    contact_no: (req.body.contact_no || "").trim(),
    address: (req.body.address || "").trim(),
    city: (req.body.city || "").trim(),
    province: (req.body.province || "").trim(),
  };

  try {
    const { items, subtotal } = await cartService.getCartItems(req.db, req.user.id);

    const fail = (msg) =>
      res.status(400).render("customer/checkout", {
        title: "Checkout",
        pageCss: "checkout",
        items,
        subtotal,
        downPayment: money.calcDownPayment(subtotal),
        values,
        error: msg,
      });

    if (items.length === 0) return res.redirect("/cart");

    for (const [key, value] of Object.entries(values)) {
      if (!value) return fail("Please fill in every delivery field.");
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

    res.redirect(`/orders/${order.id}?msg=Order+placed`);
  } catch (err) {
    if (err.message && !err.message.includes("failed:")) {
      const { items, subtotal } = await cartService.getCartItems(req.db, req.user.id);

      return res.status(400).render("customer/checkout", {
        title: "Checkout",
        pageCss: "checkout",
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

module.exports = { showCheckout, doCheckout };