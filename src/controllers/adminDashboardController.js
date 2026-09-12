
const dashboardService = require("../services/dashboardService");

async function show(req, res, next) {
  try {
    const [stats, statuses, units, recent] = await Promise.all([
      dashboardService.getStats(),
      dashboardService.statusOverview(),
      dashboardService.unitsSold(30),
      dashboardService.recentOrders(5),
    ]);

    res.render("admin/dashboard", {
      title: "Dashboard",
      layout: "layouts/admin",
      stats,
      statuses,
      units,
      recent,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { show };