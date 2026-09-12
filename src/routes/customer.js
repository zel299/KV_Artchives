const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/customerController");
const { requireAuth } = require("../middleware/auth");
const cartCtrl = require("../controllers/cartController");
const checkoutCtrl = require("../controllers/checkoutController");
const orderCtrl = require("../controllers/orderController");
const { receiptImage } = require("../middleware/upload");

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
router.post("/checkout", requireAuth, checkoutCtrl.doCheckout);

// --- Account and orders ---
router.get("/account", requireAuth, ctrl.accountsettings);
router.get("/account/orders", requireAuth, orderCtrl.listOrders);
router.get("/orders/:id/submitted", requireAuth, orderCtrl.showSubmitted);
router.get("/orders/:id", requireAuth, orderCtrl.showOrder);
router.post("/orders/:id/pay", requireAuth, receiptImage, orderCtrl.submitPayment);

module.exports = router;