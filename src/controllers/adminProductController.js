
const productService = require('../services/productService');
const { uploadProductImage } = require("../utils/imageUpload");

/**
 * Admin product controller
 * ------------------------
 * Reads the request, calls the service, renders a page. Deliberately thin:
 * no database queries here, and no business rules. Those live in the
 * service so other parts of the app can reuse them.
 */

/** GET /admin/products — the main product table. */
async function list(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const search = (req.query.q || '').trim();
    const categoryId = req.query.category || null;

    // ?archived=1 switches the table to the archived view.
    const archived = req.query.archived === '1';

    const [result, categories] = await Promise.all([
      productService.listAll({ search, categoryId, archived, page }),
      productService.listCategories(),
    ]);

    res.render('admin/products/list', {
      title: archived ? 'Archived products' : 'Products',
      layout: 'layouts/admin',
      ...result,
      categories,
      search,
      categoryId,
      archived,
      flash: req.query.msg || null,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /admin/products/new — blank create form. */
async function showCreate(req, res, next) {
  try {
    const categories = await productService.listCategories();
    res.render('admin/products/form', {
      title: 'Add product',
      layout: 'layouts/admin',
      product: null,
      categories,
      error: null,
      values: {},
    });
  } catch (err) {
    next(err);
  }
}

/** POST /admin/products — create a product. */
async function doCreate(req, res, next) {
  const values = req.body;

  try {
    const error = validate(values);
    if (error) {
      const categories = await productService.listCategories();
      return res.status(400).render('admin/products/form', {
        title: 'Add product',
        layout: 'layouts/admin',
        product: null,
        categories,
        error,
        values,
      });
    }

    const id = await productService.create(
      {
        name: values.name.trim(),
        description: values.description,
        price: Number(values.price),
        quantity: Number(values.quantity) || 0,
        categoryId: values.category_id || null,
        isOneOfAKind: values.is_one_of_a_kind === 'on',
      },
      req.user.id
    );

    await handleImages(req.files, id);

    res.redirect(`/admin/products/${id}?msg=Product+created`);
  } catch (err) {
    next(err);
  }
}

/** GET /admin/products/:id — single product view. */
async function detail(req, res, next) {
  try {
    const product = await productService.getById(req.params.id);
    if (!product) return notFound(res);

    res.render('admin/products/detail', {
      title: product.name,
      layout: 'layouts/admin',
      product,
      flash: req.query.msg || null,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /admin/products/:id/edit — edit form, pre-filled. */
async function showEdit(req, res, next) {
  try {
    const [product, categories] = await Promise.all([
      productService.getById(req.params.id),
      productService.listCategories(),
    ]);

    if (!product) return notFound(res);

    res.render('admin/products/form', {
      title: `Edit ${product.name}`,
      layout: 'layouts/admin',
      product,
      categories,
      error: null,
      values: {
        name: product.name,
        description: product.description,
        price: product.price,
        quantity: product.quantity,
        category_id: product.category?.id || '',
        is_one_of_a_kind: product.isOneOfAKind ? 'on' : '',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /admin/products/:id — save edits.
 *
 * Details and stock are saved separately: details through update(), stock
 * through setStock() so the change is written to the stock log with a
 * reason rather than silently overwritten.
 */
async function doEdit(req, res, next) {
  const values = req.body;
  const id = req.params.id;

  try {
    const error = validate(values);
    if (error) {
      const [product, categories] = await Promise.all([
        productService.getById(id),
        productService.listCategories(),
      ]);
      return res.status(400).render('admin/products/form', {
        title: 'Edit product',
        layout: 'layouts/admin',
        product,
        categories,
        error,
        values,
      });
    }

    await productService.update(id, {
      name: values.name.trim(),
      description: values.description,
      price: Number(values.price),
      categoryId: values.category_id || null,
      isOneOfAKind: values.is_one_of_a_kind === 'on',
    });

    if (values.quantity !== undefined) {
      await productService.setStock(id, Number(values.quantity) || 0, {
        note: 'Edited from the product form',
        adminId: req.user.id,
      });
    }

    await handleImages(req.files, id);

    res.redirect(`/admin/products/${id}?msg=Changes+saved`);
  } catch (err) {
    next(err);
  }
}

/** POST /admin/products/:id/archive — hide from the catalog. */
async function doArchive(req, res, next) {
  try {
    await productService.archive(req.params.id);
    res.redirect('/admin/products?msg=Product+archived');
  } catch (err) {
    next(err);
  }
}

/** POST /admin/products/:id/restore — put it back in the catalog. */
async function doRestore(req, res, next) {
  try {
    await productService.restore(req.params.id);
    res.redirect('/admin/products?archived=1&msg=Product+restored');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /admin/products/:id/delete — permanent delete.
 *
 * The service refuses if the product appears in any order, so a delete
 * cannot break the history of a past order.
 */
async function doDelete(req, res, next) {
  try {
    await productService.hardDelete(req.params.id);
    res.redirect('/admin/products?msg=Product+deleted');
  } catch (err) {
    res.redirect(
      `/admin/products/${req.params.id}?msg=${encodeURIComponent(err.message)}`
    );
  }
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/** Server-side validation. Browser validation is a convenience, not a guard. */
function validate(v) {
  if (!v.name || !v.name.trim()) return 'Enter a product name.';
  if (v.name.trim().length > 120) return 'That name is too long.';

  const price = Number(v.price);
  if (!Number.isFinite(price) || price < 0) return 'Enter a valid price.';

  if (v.quantity !== undefined && v.quantity !== '') {
    const qty = Number(v.quantity);
    if (!Number.isInteger(qty) || qty < 0) {
      return 'Stock quantity must be a whole number, zero or more.';
    }
  }

  return null;
}

function notFound(res) {
  return res.status(404).render('customer/error', {
    title: 'Not found',
    status: 404,
    message: 'That product does not exist.',
  });
}

async function handleImages(files, productId) {
  if (!files || files.length === 0) return;

  const paths = [];
  for (const file of files) {
    const path = await uploadProductImage(file.buffer);
    paths.push(path);
  }

  await productService.addImages(productId, paths);
}

module.exports = {
  list,
  showCreate,
  doCreate,
  detail,
  showEdit,
  doEdit,
  doArchive,
  doRestore,
  doDelete,
};
