
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/customerController");
const { requireAuth } = require("../middleware/auth");
const cartCtrl = require("../controllers/cartController");

router.get("/", ctrl.home);
router.get("/shop", ctrl.shop);
router.get("/products/:id", ctrl.productDetail);
router.get("/about", ctrl.about);
router.get("/gallery", ctrl.gallery);
router.get("/commissions", ctrl.commissions);
router.get("/contact", ctrl.contact);
router.get("/faqs", ctrl.faqs);
router.get("/shipping-info", ctrl.shippinginfo);
router.get("/privacy-policy", ctrl.privacypolicy);
router.get("/account", ctrl.accountsettings);
router.get("/account/orders", ctrl.myorders);
router.get("/account", requireAuth, ctrl.accountsettings);
router.get("/account/orders", requireAuth, ctrl.myorders);
router.get("/cart", cartCtrl.showCart);
router.post("/cart/add", cartCtrl.addToCart);
router.post("/cart/:id/update", cartCtrl.updateCartItem);
router.post("/cart/:id/remove", cartCtrl.removeCartItem);

module.exports = router;