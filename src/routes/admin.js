const express = require('express');
const router = express.Router();
const csrf = require("csurf");

const { requireAdmin } = require('../middleware/auth');
const products = require('../controllers/adminProductController');
const { productImages, settingsImage } = require("../middleware/upload");
const orderCtrl = require("../controllers/adminOrderController");
const settingsCtrl = require("../controllers/adminSettingsController");
const dashboardCtrl = require("../controllers/adminDashboardController");

// Applied after multer on multipart routes, because csurf reads the token
// from the parsed body and multipart bodies are not parsed until multer runs.
const csrfProtection = csrf({ cookie: true });

// Every route below this line requires an admin account.
// Applied once here rather than repeated on each route, so a new route
// cannot accidentally be left unprotected.
router.use(requireAdmin);

// --- Dashboard ---
router.get("/", dashboardCtrl.show);

// --- Products ---
router.get("/products", products.list);
router.get("/products/new", products.showCreate);
router.post("/products", productImages, csrfProtection, products.doCreate);
router.get("/products/:id", products.detail);
router.get("/products/:id/edit", products.showEdit);
router.post("/products/:id", productImages, csrfProtection, products.doEdit);
router.post("/products/:id/archive", products.doArchive);
router.post("/products/:id/restore", products.doRestore);
router.post("/products/:id/delete", products.doDelete);

// --- Orders ---
router.get("/orders", orderCtrl.list);
router.get("/orders/:id", orderCtrl.detail);

router.post("/orders/:id/confirm", orderCtrl.confirmOrder);
router.post("/orders/:id/decline", orderCtrl.declineOrder);
router.post("/orders/:id/request-down-payment", orderCtrl.requestDownPayment);
router.post("/orders/:id/confirm-down-payment", orderCtrl.confirmDownPayment);
router.post("/orders/:id/request-balance", orderCtrl.requestBalance);
router.post("/orders/:id/confirm-balance", orderCtrl.confirmBalance);
router.post("/orders/:id/ship", orderCtrl.markShipped);
router.post("/orders/:id/complete", orderCtrl.markCompleted);
router.post("/orders/:id/cancel", orderCtrl.cancelOrder);

// --- Settings ---
router.get("/settings", settingsCtrl.show);
router.post("/settings", settingsImage, csrfProtection, settingsCtrl.save);

module.exports = router;