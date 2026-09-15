const modal = document.getElementById("productModal");

const openCreateButtons =
  document.querySelectorAll("#openCreateProduct");

const editButtons =
  document.querySelectorAll(".edit-product");

const viewButtons =
  document.querySelectorAll(".view-product");


const closeButton =
  document.getElementById("closeProductModal");

const cancelButton =
  document.getElementById("cancelProductModal");

const overlay =
  document.getElementById("closeProductOverlay");

const form =
  document.getElementById("productForm");

const formContainer =
  document.getElementById("productFormContainer");

const modalTitle =
  document.getElementById("productModalTitle");

const modalSubtitle =
  document.getElementById("productModalSubtitle");

const submitButton =
  document.getElementById("productSubmitButton");


const productName =
  document.getElementById("productName");

const productDescription =
  document.getElementById("productDescription");

const productPrice =
  document.getElementById("productPrice");

const productQuantity =
  document.getElementById("productQuantity");

const productCategory =
  document.getElementById("productCategory");

const productOneOfAKind =
  document.getElementById("productOneOfAKind");

const viewContainer =
  document.getElementById("productViewContainer");

const viewProductName =
  document.getElementById("viewProductName");

const viewProductCode =
  document.getElementById("viewProductCode");

const viewProductPrice =
  document.getElementById("viewProductPrice");

const viewProductStock =
  document.getElementById("viewProductStock");

const viewProductCategory =
  document.getElementById("viewProductCategory");

const viewProductOneOfAKind =
  document.getElementById("viewProductOneOfAKind");

const viewProductStatus =
  document.getElementById("viewProductStatus");

const viewProductDescription =
  document.getElementById("viewProductDescription");

const viewDescriptionSection =
  document.getElementById("viewDescriptionSection");

const viewProductImages =
  document.getElementById("viewProductImages");

const viewNoPhotos =
  document.getElementById("viewNoPhotos");

const viewEditProduct =
  document.getElementById("viewEditProduct");

const viewRestoreForm =
  document.getElementById("viewRestoreForm");

const viewArchiveForm =
  document.getElementById("viewArchiveForm");

const viewArchiveText =
  document.getElementById("viewArchiveText");

const viewDeleteForm =
  document.getElementById("viewDeleteForm");


/* Current product used by View → Edit */

let currentViewProduct = null;

function openModal() {

  modal.classList.add("show");

  modal.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add(
    "modal-open"
  );
}

function openCreateModal() {

  form.reset();

  modalTitle.textContent =
    "Add product";

  modalSubtitle.textContent =
    "Add a new product to your shop.";

  submitButton.textContent =
    "Create product";

  form.action =
    "/admin/products";


  formContainer.style.display =
    "block";

  viewContainer.style.display =
    "none";


  openModal();
}

function openEditModal(button) {

  const id =
    button.dataset.id;

  const name =
    button.dataset.name;

  const description =
    button.dataset.description;

  const price =
    button.dataset.price;

  const quantity =
    button.dataset.quantity;

  const category =
    button.dataset.category;

  const oneOfAKind =
    button.dataset.oneOfAKind;


  productName.value =
    name || "";

  productDescription.value =
    description || "";

  productPrice.value =
    price || "";

  productQuantity.value =
    quantity || 0;

  productCategory.value =
    category || "";

  productOneOfAKind.checked =
    oneOfAKind === "true";


  modalTitle.textContent =
    "Edit product";

  modalSubtitle.textContent =
    "Update this product's information.";

  submitButton.textContent =
    "Save changes";


  form.action =
    "/admin/products/" + id;


  formContainer.style.display =
    "block";

  viewContainer.style.display =
    "none";


  openModal();
}

function openViewModal(button) {

  const product = {

    id: button.dataset.id,

    name: button.dataset.name,

    code: button.dataset.code,

    description:
      button.dataset.description,

    price:
      button.dataset.price,

    quantity:
      button.dataset.quantity,

    category:
      button.dataset.categoryName,

    oneOfAKind:
      button.dataset.oneOfAKind,

    status:
      button.dataset.status

  };


  currentViewProduct =
    product;


  /* HEADER */

  modalTitle.textContent =
    product.name;

  modalSubtitle.textContent =
    product.code;


  /* BASIC INFORMATION */

  viewProductName.textContent =
    product.name;

  viewProductCode.textContent =
    product.code;


  /* PRICE */

  const priceNumber =
    Number(product.price);

  if (!Number.isNaN(priceNumber)) {

    viewProductPrice.textContent =
      "₱" +
      priceNumber.toLocaleString(
        "en-PH",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      );

  } else {

    viewProductPrice.textContent =
      "—";

  }


  /* STOCK */

  viewProductStock.textContent =
    product.quantity || "0";


  /* CATEGORY */

  viewProductCategory.textContent =
    product.category || "—";


  /* ONE OF A KIND */

  viewProductOneOfAKind.textContent =
    product.oneOfAKind;


  /* STATUS */

  viewProductStatus.textContent =
    product.status;


  /* DESCRIPTION */

  if (product.description) {

    viewProductDescription.textContent =
      product.description;

    viewDescriptionSection.style.display =
      "block";

  } else {

    viewDescriptionSection.style.display =
      "none";

  }

  viewArchiveForm.style.display =
    "none";

  viewRestoreForm.style.display =
    "none";


  if (product.status === "Archived") {

    viewRestoreForm.style.display =
      "inline";

    viewRestoreForm.action =
      "/admin/products/" +
      product.id +
      "/restore";


    viewArchiveText.style.display =
      "none";

  } else {

    viewArchiveForm.style.display =
      "inline";

    viewArchiveForm.action =
      "/admin/products/" +
      product.id +
      "/archive";


    viewArchiveText.style.display =
      "block";

  }


  /* DELETE */

  viewDeleteForm.action =
    "/admin/products/" +
    product.id +
    "/delete";

  viewProductImages.innerHTML = "";

  viewNoPhotos.style.display =
    "block";


  /*
   * NOTE:
   * The product list currently doesn't provide
   * product.images.
   *
   * Photos will be displayed once images are
   * included in the product data.
   */



  formContainer.style.display =
    "none";

  viewContainer.style.display =
    "block";


  openModal();
}


function editCurrentProduct() {

  if (!currentViewProduct) {
    return;
  }


  /*
   * Find the Edit button belonging
   * to the current product.
   */

  const editButton =
    document.querySelector(
      '.edit-product[data-id="' +
      currentViewProduct.id +
      '"]'
    );


  if (editButton) {

    openEditModal(
      editButton
    );

  }

}

function closeProductModal() {

  modal.classList.remove("show");

  modal.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.classList.remove(
    "modal-open"
  );

}

openCreateButtons.forEach(
  function(button) {

    button.addEventListener(
      "click",
      openCreateModal
    );

  }
);

editButtons.forEach(
  function(button) {

    button.addEventListener(
      "click",
      function() {

        openEditModal(button);

      }
    );

  }
);

viewButtons.forEach(
  function(button) {

    button.addEventListener(
      "click",
      function() {

        openViewModal(button);

      }
    );

  }
);

viewEditProduct.addEventListener(
  "click",
  editCurrentProduct
);

closeButton.addEventListener(
  "click",
  closeProductModal
);


cancelButton.addEventListener(
  "click",
  closeProductModal
);

overlay.addEventListener(
  "click",
  closeProductModal
);

document.addEventListener(
  "keydown",
  function(event) {

    if (
      event.key === "Escape" &&
      modal.classList.contains("show")
    ) {

      closeProductModal();

    }

  }
);