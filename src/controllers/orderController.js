const orderService = require("../services/orderService");
const settingsService = require("../services/settingsService");

async function loadOrder(req, res) {
  const order = await orderService.getOrderForCustomer(
    req.db,
    req.params.id,
    req.user.id
  );

  if (!order) {
    res.status(404).render("customer/error", {
      title: "Not found",
      status: 404,
      message: "That order does not exist.",
    });
    return null;
  }

  return order;
}

async function showSubmitted(req, res, next) {
  try {
    const order = await loadOrder(req, res);
    if (!order) return;

    res.render("customer/order-submitted", {
      title: `Order ${order.code}`,
      pageCss: "order-submitted",
      order,
    });
  } catch (err) {
    next(err);
  }
}

async function showOrder(req, res, next) {
  try {
    const order = await loadOrder(req, res);
    if (!order) return;

    res.render("customer/order-detail", {
      title: `Order ${order.code}`,
      pageCss: "order-detail",
      order,
      settings: await settingsService.get(),
      flash: req.query.msg || null,
      error: req.query.err || null,
    });
  } catch (err) {
    next(err);
  }
}

async function listOrders(req, res, next) {
  try {
    const tab = req.query.tab || "all";
    const statuses = orderService.ORDER_TABS[tab] ?? null;

    const orders = await orderService.listOrdersForCustomer(
      req.db,
      req.user.id,
      statuses
    );

    res.render("customer/my-orders", {
      title: "My Orders",
      pageCss: "my-orders",
      orders,
      tab,
    });
  } catch (err) {
    next(err);
  }
}

async function submitPayment(req, res, next) {
  const id = req.params.id;

  try {
    await orderService.submitPayment(
      req.db,
      id,
      req.user.id,
      req.body.payment_type,
      req.body.reference_no,
      req.file ? req.file.buffer : null
    );

    res.redirect(`/orders/${id}?msg=Payment+details+submitted`);
  } catch (err) {
    res.redirect(`/orders/${id}?err=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { showSubmitted, showOrder, listOrders, submitPayment };