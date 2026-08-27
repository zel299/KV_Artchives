const express = require('express');
const router = express.Router();

const { requireAdmin } = require('../middleware/auth');
const products = require('../controllers/adminProductController');
const { productImages } = require("../middleware/upload");

// Every route below this line requires an admin account.
// Applied once here rather than repeated on each route, so a new route
// cannot accidentally be left unprotected.
router.use(requireAdmin);

// --- Dashboard ---
router.get('/', (req, res) => {
  res.render('admin/dashboard', {
    title: 'Dashboard',
    layout: 'layouts/admin',
  });
});

// --- Products ---
router.get("/products", products.list);
router.get("/products/new", products.showCreate);
router.post("/products", productImages, products.doCreate);
router.get("/products/:id", products.detail);
router.get("/products/:id/edit", products.showEdit);
router.post("/products/:id", productImages, products.doEdit);
router.post("/products/:id/archive", products.doArchive);
router.post("/products/:id/restore", products.doRestore);
router.post("/products/:id/delete", products.doDelete);

module.exports = router;
