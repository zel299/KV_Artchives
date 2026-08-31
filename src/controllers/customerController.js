
const productService = require("../services/productService");

async function home(req, res, next) {
  try {
    const { products } = await productService.listAvailable({ perPage: 3 });

    res.render("customer/home", {
      title: "KV Artchives",
      products,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { home };