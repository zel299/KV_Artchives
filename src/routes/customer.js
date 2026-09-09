
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/customerController");

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
router.get("/cart", ctrl.cart);
router.get("/account", ctrl.accountsettings);
router.get("/account/orders", ctrl.myorders);

module.exports = router;