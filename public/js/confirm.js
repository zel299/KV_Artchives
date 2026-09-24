function buildModal() {
  const overlay = document.createElement("div");
  overlay.className = "confirm-overlay";

  overlay.innerHTML = `
    <div class="confirm-modal">
      <p></p>
      <div class="confirm-actions">
        <button type="button" class="confirm-btn confirm-btn-cancel">Cancel</button>
        <button type="button" class="confirm-btn confirm-btn-ok">Confirm</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

function showConfirm(message) {
  const overlay = document.querySelector(".confirm-overlay") || buildModal();
  const text = overlay.querySelector("p");
  const okBtn = overlay.querySelector(".confirm-btn-ok");
  const cancelBtn = overlay.querySelector(".confirm-btn-cancel");

  text.textContent = message;

  return new Promise((resolve) => {
    function cleanup(result) {
      overlay.classList.remove("active");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlay);
      resolve(result);
    }

    function onOk() {
      cleanup(true);
    }

    function onCancel() {
      cleanup(false);
    }

    function onOverlay(e) {
      if (e.target === overlay) cleanup(false);
    }

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlay);

    overlay.classList.add("active");
  });
}

document.addEventListener("submit", async function (e) {
  const form = e.target;
  const message = form.getAttribute("data-confirm");

  if (!message) return;
  if (form.dataset.confirmed === "true") return;

  e.preventDefault();

  const ok = await showConfirm(message);

  if (ok) {
    form.dataset.confirmed = "true";
    form.requestSubmit();
  }
});