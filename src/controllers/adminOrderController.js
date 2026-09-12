
const adminOrderService = require("../services/adminOrderService");

const TABS = {
  all: null,
  pending: ["pending"],
  awaiting_payment: ["awaiting_down_payment", "awaiting_balance"],
  in_progress: ["confirmed", "in_production", "ready_to_ship"],
  shipped: ["shipped"],
  completed: ["completed"],
  closed: ["cancelled", "declined", "expired"],
};

async function list(req, res, next) {
  try {
    const tab = req.query.tab || "all";
    const page = Math.max(1, Number(req.query.page) || 1);
    const search = (req.query.q || "").trim();

    const result = await adminOrderService.listOrders({
      status: TABS[tab] ?? null,
      search,
      page,
    });

    res.render("admin/orders/list", {
      title: "Orders",
      layout: "layouts/admin",
      ...result,
      tab,
      search,
      flash: req.query.msg || null,
    });
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    const order = await adminOrderService.getOrder(req.params.id);

    if (!order) {
      return res.status(404).render("customer/error", {
        title: "Not found",
        status: 404,
        message: "That order does not exist.",
      });
    }

    const receipts = {
      downPayment: order.downPayment?.receipt_path
        ? await adminOrderService.receiptUrl(order.downPayment.receipt_path)
        : null,
      balance: order.balance?.receipt_path
        ? await adminOrderService.receiptUrl(order.balance.receipt_path)
        : null,
    };

    res.render("admin/orders/detail", {
      title: `Order ${order.code}`,
      layout: "layouts/admin",
      order,
      receipts,
      flash: req.query.msg || null,
      error: req.query.err || null,
    });
  } catch (err) {
    next(err);
  }
}

function action(fn) {
  return async function (req, res) {
    const id = req.params.id;

    try {
      const msg = await fn(req, id);
      res.redirect(`/admin/orders/${id}?msg=${encodeURIComponent(msg)}`);
    } catch (err) {
      res.redirect(`/admin/orders/${id}?err=${encodeURIComponent(err.message)}`);
    }
  };
}

const confirmOrder = action(async (req, id) => {
  await adminOrderService.confirmOrder(id, req.user.id);
  return "Order confirmed";
});

const declineOrder = action(async (req, id) => {
  await adminOrderService.declineOrder(id, req.user.id, req.body.reason);
  return "Order declined and stock returned";
});

const requestDownPayment = action(async (req, id) => {
  await adminOrderService.requestDownPayment(id, req.user.id);
  return "Down payment requested";
});

const confirmDownPayment = action(async (req, id) => {
  await adminOrderService.confirmDownPayment(id, req.user.id, req.body.admin_note);
  return "Down payment confirmed, order moved to production";
});

const requestBalance = action(async (req, id) => {
  await adminOrderService.requestBalance(id, req.user.id, req.body.shipping_fee);
  return "Balance requested";
});

const confirmBalance = action(async (req, id) => {
  await adminOrderService.confirmBalance(id, req.user.id, req.body.admin_note);
  return "Balance confirmed, order ready to ship";
});

const markShipped = action(async (req, id) => {
  await adminOrderService.markShipped(id, req.user.id, req.body.tracking_no);
  return "Marked as shipped";
});

const markCompleted = action(async (req, id) => {
  await adminOrderService.markCompleted(id, req.user.id);
  return "Order completed";
});

const cancelOrder = action(async (req, id) => {
  await adminOrderService.cancelOrder(id, req.user.id, req.body.reason);
  return "Order cancelled and stock returned";
});

module.exports = {
  list,
  detail,
  confirmOrder,
  declineOrder,
  requestDownPayment,
  confirmDownPayment,
  requestBalance,
  confirmBalance,
  markShipped,
  markCompleted,
  cancelOrder,
};