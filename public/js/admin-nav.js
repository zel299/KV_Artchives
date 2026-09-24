
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.querySelector(".sidebar");
const backdrop = document.getElementById("sidebarBackdrop");

function openSidebar() {
  sidebar.classList.add("open");
  backdrop.classList.add("open");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  backdrop.classList.remove("open");
}

menuToggle.addEventListener("click", function () {
  if (sidebar.classList.contains("open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
});

backdrop.addEventListener("click", closeSidebar);

sidebar.querySelectorAll(".sidebar-nav a").forEach(function (link) {
  link.addEventListener("click", closeSidebar);
});