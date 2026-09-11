
const orderService = require("../services/orderService");

async function showOrder(req, res, next) {
  try {
    const order = await orderService.getOrderForCustomer(
      req.db,
      req.params.id,
      req.user.id
    );

    if (!order) {
      return res.status(404).render("customer/error", {
        title: "Not found",
        status: 404,
        message: "That order does not exist.",
      });
    }

    res.render("customer/order-detail", {
      title: `Order ${order.code}`,
      pageCss: "order-detail",
      order,
      flash: req.query.msg || null,
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

module.exports = { showOrder, listOrders };