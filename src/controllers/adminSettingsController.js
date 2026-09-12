
const settingsService = require("../services/settingsService");

async function show(req, res, next) {
  try {
    const settings = await settingsService.get();

    res.render("admin/settings", {
      title: "Settings",
      layout: "layouts/admin",
      settings,
      flash: req.query.msg || null,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function save(req, res, next) {
  try {
    const qrBuffer = req.file ? req.file.buffer : null;

    await settingsService.update(req.body, qrBuffer);

    res.redirect("/admin/settings?msg=Settings+saved");
  } catch (err) {
    const settings = await settingsService.get();

    res.status(400).render("admin/settings", {
      title: "Settings",
      layout: "layouts/admin",
      settings,
      flash: null,
      error: err.message,
    });
  }
}

module.exports = { show, save };