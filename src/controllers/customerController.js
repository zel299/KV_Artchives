const productService = require("../services/productService");

async function home(req, res, next) {
  try {
    const { products } = await productService.listAvailable({ perPage: 3 });

    res.render("customer/home", {
      title: "Home",
      products,
    });
  } catch (err) {
    next(err);
  }
}

function about(req, res) {
  res.render("customer/about", {
    title: "About",
    pageCss: "about",
  });
}

function gallery(req, res) {
  res.render("customer/gallery", {
    title: "Gallery",
    pageCss: "gallery",
  });
}

function commissions(req, res) {
  res.render("customer/commissions", {
    title: "Commissions",
    pageCss: "commissions",
  });
}

async function shop(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const search = (req.query.q || "").trim();
    const categoryId = req.query.category || null;

    const [result, categories] = await Promise.all([
      productService.listAvailable({ search, categoryId, page }),
      productService.listCategories(),
    ]);

    res.render("customer/shop", {
      title: "Shop",
      pageCss: "shop",
      ...result,
      categories,
      search,
      categoryId,
    });

  } catch (err) {
    next(err);
  }
}

function contact(req, res) {
  res.render("customer/contact", {
    title: "Contact",
    pageCss: "info-pages",
  });
}

function faqs(req, res) {
  res.render("customer/faqs", {
    title: "FAQs",
    pageCss: "info-pages",
  });
}

function shippinginfo(req, res) {
  res.render("customer/shipping-info", {
    title: "Shipping Information",
    pageCss: "info-pages",
  });
}

function privacypolicy(req, res) {
  res.render("customer/privacy-policy", {
    title: "Privacy Policy",
    pageCss: "info-pages",
  });
}

function cart(req, res) {
    res.render("customer/cart", {
        title: "Your Cart",
        pageCss: "cart",
    });
}

function accountsettings(req, res) {
    res.render("customer/account-settings", {
        title: "Account Settings",
        pageCss: "account-setting",
    });
}

function myorders(req, res) {
    res.render("customer/my-orders", {
        title: "My Orders",
        pageCss: "my-orders",
    });
}

module.exports = { home, about, gallery, commissions, shop, contact, faqs, shippinginfo, privacypolicy, cart, accountsettings, myorders };