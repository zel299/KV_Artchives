
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

      const quantity = Math.min(row.quantity, Math.max(1, product.maxOrderQty));

      return {
        id: row.productId,
        quantity,
        product,
        lineTotal: product.price * quantity,
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
      const product = await productService.getPublicById(productId);
      if (!product) throw new Error("That product is no longer available.");
      if (!product.inStock) throw new Error("That product is sold out.");

      const cap = Math.min(cartService.MAX_QTY, product.maxOrderQty);
      const qty = cartService.clampQty(quantity, cap);

      const rows = cartService.readGuestCart(req);
      const existing = rows.find((row) => String(row.productId) === String(productId));

      if (existing) {
        existing.quantity = Math.min(cap, existing.quantity + qty);
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

        if (existing) {
          const product = await productService.getPublicById(itemId);
          const cap = product ? Math.min(cartService.MAX_QTY, product.maxOrderQty) : 0;

          if (cap < 1) {
            rows = rows.filter((row) => row !== existing);
          } else {
            existing.quantity = Math.min(cap, quantity);
          }
        }
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