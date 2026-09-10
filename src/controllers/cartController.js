
const cartService = require("../services/cartService");
const productService = require("../services/productService");

async function loadCart(req) {
  if (req.user) {
    return cartService.getCartItems(req.db, req.user.id);
  }

  const guestRows = cartService.readGuestCart(req);
  if (guestRows.length === 0) return { items: [], subtotal: 0 };

  const products = await productService.getManyPublic(
    guestRows.map((row) => row.productId)
  );

  const items = guestRows
    .map((row) => {
      const product = products.find((p) => String(p.id) === String(row.productId));
      if (!product) return null;

      return {
        id: row.productId,
        quantity: row.quantity,
        product,
        lineTotal: product.price * row.quantity,
      };
    })
    .filter(Boolean);

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return { items, subtotal };
}

async function showCart(req, res, next) {
  try {
    const { items, subtotal } = await loadCart(req);

    res.render("customer/cart", {
      title: "Your Cart",
      pageCss: "cart",
      items,
      subtotal,
    });
  } catch (err) {
    next(err);
  }
}

async function addToCart(req, res, next) {
  try {
    const productId = req.body.product_id;
    const quantity = req.body.quantity || 1;

    if (req.user) {
      await cartService.addItem(req.db, req.user.id, productId, quantity);
    } else {
      const rows = cartService.readGuestCart(req);
      const existing = rows.find((row) => String(row.productId) === String(productId));

      const qty = Math.max(1, Math.floor(Number(quantity) || 1));

      if (existing) {
        existing.quantity += qty;
      } else {
        rows.push({ productId, quantity: qty });
      }

      cartService.writeGuestCart(res, rows);
    }

    res.redirect("/cart");
  } catch (err) {
    next(err);
  }
}

async function updateCartItem(req, res, next) {
  try {
    const itemId = req.params.id;
    const quantity = Math.floor(Number(req.body.quantity) || 0);

    if (req.user) {
      await cartService.updateItem(req.db, req.user.id, itemId, quantity);
    } else {
      let rows = cartService.readGuestCart(req);

      if (quantity <= 0) {
        rows = rows.filter((row) => String(row.productId) !== String(itemId));
      } else {
        const existing = rows.find((row) => String(row.productId) === String(itemId));
        if (existing) existing.quantity = quantity;
      }

      cartService.writeGuestCart(res, rows);
    }

    res.redirect("/cart");
  } catch (err) {
    next(err);
  }
}

async function removeCartItem(req, res, next) {
  try {
    const itemId = req.params.id;

    if (req.user) {
      await cartService.removeItem(req.db, req.user.id, itemId);
    } else {
      const rows = cartService
        .readGuestCart(req)
        .filter((row) => String(row.productId) !== String(itemId));

      cartService.writeGuestCart(res, rows);
    }

    res.redirect("/cart");
  } catch (err) {
    next(err);
  }
}

module.exports = { showCart, addToCart, updateCartItem, removeCartItem };