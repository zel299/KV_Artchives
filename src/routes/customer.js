const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const ctrl = require("../controllers/customerController");
const { requireAuth } = require("../middleware/auth");
const cartCtrl = require("../controllers/cartController");
const checkoutCtrl = require("../controllers/checkoutController");
const orderCtrl = require("../controllers/orderController");
const { receiptImage } = require("../middleware/upload");
const csrf = require("csurf");
const csrfProtection = csrf({ cookie: true });

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.redirect(
      "/cart?err=" +
        encodeURIComponent("Too many orders placed. Please try again later.")
    );
  },
});

// --- Storefront ---
router.get("/", ctrl.home);
router.get("/shop", ctrl.shop);
router.get("/products/:id", ctrl.productDetail);

// --- Information pages ---
router.get("/about", ctrl.about);
router.get("/gallery", ctrl.gallery);
router.get("/commissions", ctrl.commissions);
router.get("/contact", ctrl.contact);
router.get("/faqs", ctrl.faqs);
router.get("/shipping-info", ctrl.shippinginfo);
router.get("/privacy-policy", ctrl.privacypolicy);

// --- Cart ---
router.get("/cart", cartCtrl.showCart);
router.post("/cart/add", cartCtrl.addToCart);
router.post("/cart/:id/update", cartCtrl.updateCartItem);
router.post("/cart/:id/remove", cartCtrl.removeCartItem);

// --- Checkout ---
router.get("/checkout", requireAuth, checkoutCtrl.showDetails);
router.post("/checkout/review", requireAuth, checkoutCtrl.showReview);
router.post("/checkout", requireAuth, orderLimiter, checkoutCtrl.doCheckout);

// --- Account and orders ---
router.get("/account", requireAuth, ctrl.accountsettings);
router.get("/account/orders", requireAuth, orderCtrl.listOrders);
router.get("/orders/:id/submitted", requireAuth, orderCtrl.showSubmitted);
router.get("/orders/:id", requireAuth, orderCtrl.showOrder);
router.post("/orders/:id/pay", requireAuth, orderLimiter, receiptImage, csrfProtection, orderCtrl.submitPayment);

module.exports = router;