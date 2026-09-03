
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

function about(req, res) {

  res.render("customer/about", {

    title: "About | KV Artchives"

  });

}

function gallery(req, res) {

  res.render("customer/gallery", {

    title: "Gallery | KV Artchives"

  });

}


module.exports = { home, about, gallery };