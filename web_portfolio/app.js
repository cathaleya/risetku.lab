// app.js - Logic for RisetinAja 3-Page Professional Portal

// Default Target URLs for the 5 Apps
const DEFAULT_URLS = {
  madel5c: "https://madel5c.com",
  chekin: "http://127.0.0.1:3001",
  slr: "http://127.0.0.1:3002",
  terjemahin: "http://127.0.0.1:3003",
  analisis: "http://127.0.0.1:3004"
};

const STORAGE_KEY = "risetinaja_app_urls";

// Load Saved URLs
function getAppUrls() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_URLS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error("Failed to load URLs from localStorage", e);
  }
  return DEFAULT_URLS;
}

// Save URLs to localStorage
function saveAppUrls(urls) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
  } catch (e) {
    console.error("Failed to save URLs to localStorage", e);
  }
}

// Update DOM URLs
function updateDomUrls() {
  const urls = getAppUrls();

  document.querySelectorAll(".app-launch-btn").forEach(btn => {
    const appId = btn.getAttribute("data-id");
    if (appId && urls[appId]) {
      btn.setAttribute("href", urls[appId]);
    }
  });

  Object.keys(urls).forEach(key => {
    const input = document.getElementById(`url_${key}`);
    if (input) {
      input.value = urls[key];
    }
  });
}

// ==========================================================================
// 3-PAGE SWITCHER LOGIC
// ==========================================================================
function switchPage(pageNumber) {
  // Hide all pages
  document.querySelectorAll(".page-container").forEach(page => {
    page.classList.add("hidden");
  });

  // Show target page
  const targetPage = document.getElementById(`page-${pageNumber}`);
  if (targetPage) {
    targetPage.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Update Desktop Tab Buttons
  document.querySelectorAll(".page-tab").forEach((tab, index) => {
    if (index + 1 === pageNumber) {
      tab.classList.add("active", "bg-amber-500", "text-slate-950", "shadow-md");
      tab.classList.remove("text-slate-400");
    } else {
      tab.classList.remove("active", "bg-amber-500", "text-slate-950", "shadow-md");
      tab.classList.add("text-slate-400");
    }
  });

  // Update Mobile Tabs
  for (let i = 1; i <= 3; i++) {
    const mobTab = document.getElementById(`mobile-tab-${i}`);
    if (mobTab) {
      if (i === pageNumber) {
        mobTab.classList.add("text-amber-400");
        mobTab.classList.remove("text-slate-400");
      } else {
        mobTab.classList.remove("text-amber-400");
        mobTab.classList.add("text-slate-400");
      }
    }
  }
}

// Global initialization
document.addEventListener("DOMContentLoaded", () => {
  updateDomUrls();

  // Modal setup
  const modal = document.getElementById("modalDomainConfig");
  const modalBox = document.getElementById("modalBox");
  const btnOpenModal = document.getElementById("btnOpenDomainConfig");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const domainForm = document.getElementById("domainForm");
  const btnReset = document.getElementById("btnResetUrls");

  function openModal() {
    modal.classList.remove("opacity-0", "pointer-events-none");
    modalBox.classList.remove("scale-95");
    modalBox.classList.add("scale-100");
  }

  function closeModal() {
    modal.classList.add("opacity-0", "pointer-events-none");
    modalBox.classList.add("scale-95");
    modalBox.classList.remove("scale-100");
  }

  if (btnOpenModal) btnOpenModal.addEventListener("click", openModal);
  if (btnCloseModal) btnCloseModal.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Form submit handler
  if (domainForm) {
    domainForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const updatedUrls = {
        madel5c: document.getElementById("url_madel5c").value.trim(),
        chekin: document.getElementById("url_chekin").value.trim(),
        slr: document.getElementById("url_slr").value.trim(),
        terjemahin: document.getElementById("url_terjemahin").value.trim(),
        analisis: document.getElementById("url_analisis").value.trim(),
      };

      saveAppUrls(updatedUrls);
      updateDomUrls();
      closeModal();
      alert("Tautan aplikasi berhasil diperbarui!");
    });
  }

  // Reset to default
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      if (confirm("Reset seluruh tautan aplikasi ke pengaturan awal?")) {
        saveAppUrls(DEFAULT_URLS);
        updateDomUrls();
      }
    });
  }
});
