
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/customerController");

router.get("/", ctrl.home);

router.get("/about", ctrl.about);

router.get("/gallery", ctrl.gallery);

router.get("/commissions", ctrl.commissions);

module.exports = router;