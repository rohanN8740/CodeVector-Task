const API_BASE = "https://codevector-backend-5mrs.onrender.com";

// State Management
let limit = 12; // Grid-friendly size (3x4 or 4x3)
let cursorStack = [null]; // Stack to track cursors for back navigation. Page 1 is null.
let currentPage = 1;
let currentCategory = "";
let currentNextCursor = null;

// UI Elements (Core Feed)
const productGrid = document.getElementById("product-grid");
const categorySelect = document.getElementById("category-select");
const queryTimeDisplay = document.getElementById("query-time");
const pageIndicator = document.getElementById("page-indicator");
const cursorIndicator = document.getElementById("cursor-indicator");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const btnAdd = document.getElementById("btn-add");
const btnUpdate = document.getElementById("btn-update");
const consoleLogs = document.getElementById("console-logs");
const btnClearConsole = document.getElementById("btn-clear-console");

// UI Elements (Dashboard Header KPIs)
const activePageLabel = document.getElementById("active-page-label");
const activeCursorLabel = document.getElementById("active-cursor-label");
const tabTitle = document.getElementById("tab-title");

// UI Elements (Tab Switches)
const menuItems = document.querySelectorAll(".menu-item");
const tabContents = document.querySelectorAll(".tab-content");

// UI Elements (Query Analyzer Tabs)
const planTabButtons = document.querySelectorAll(".plan-tab-btn");
const planTabContents = document.querySelectorAll(".plan-tab-content");

// Helper to log to the simulator console
function logToConsole(message, type = "info") {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = `log-entry log-${type}`;
  entry.innerHTML = `[${time}] ${message}`;
  consoleLogs.appendChild(entry);

  // Defer scrolling until after the browser has completed layout reflow
  setTimeout(() => {
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }, 0);
}

// Show a floating toast notification
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>✅</span> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px) scale(0.95)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Format relative date time
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;

  if (diffMs < 0) return "Just now";

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${diffDays} days ago`;
}

// 1. Fetch distinct categories on load
async function fetchCategories() {
  try {
    const res = await fetch(`${API_BASE}/api/categories`);
    const data = await res.json();

    if (data.success && data.categories) {
      data.categories.forEach((cat) => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
      });
      categorySelect.removeAttribute("disabled");
      logToConsole(
        `Loaded ${data.categories.length} categories from DB in ${data.executionTimeMs}ms`,
        "success",
      );
    }
  } catch (err) {
    logToConsole(`Error loading categories: ${err.message}`, "warn");
  }
}

// 2. Fetch and render products
async function fetchProducts(cursor = null) {
  // Show loader
  productGrid.innerHTML = `
    <div class="spinner-container" id="feed-spinner">
      <div class="spinner"></div>
      <p>Fetching products...</p>
    </div>
  `;

  btnPrev.disabled = true;
  btnNext.disabled = true;

  try {
    let url = `${API_BASE}/api/products?limit=${limit}`;
    if (currentCategory) {
      url += `&category=${encodeURIComponent(currentCategory)}`;
    }
    if (cursor) {
      url += `&cursor=${encodeURIComponent(cursor)}`;
    }

    logToConsole(
      `Querying API: GET /products${cursor ? `?cursor=${cursor.slice(0, 15)}...` : ""}${currentCategory ? `&cat=${currentCategory}` : ""}`,
      "query",
    );

    const res = await fetch(url);
    const data = await res.json();

    if (data.success) {
      productGrid.innerHTML = "";
      currentNextCursor = data.nextCursor;

      // Update statistics in KPI widgets
      queryTimeDisplay.textContent = `${data.executionTimeMs} ms`;
      activePageLabel.textContent = `Page ${currentPage}`;

      if (cursor) {
        const shortCursor = cursor.slice(0, 12);
        activeCursorLabel.textContent = `Cursor: ${shortCursor}...`;
        cursorIndicator.textContent = `Cursor: ${cursor.slice(0, 20)}...`;
      } else {
        activeCursorLabel.textContent = "Keyset Pagination";
        cursorIndicator.textContent = `Cursor: None (First Page)`;
      }

      pageIndicator.textContent = `Page ${currentPage}`;

      logToConsole(
        `Returned ${data.products.length} products. Execution Time: ${data.executionTimeMs}ms`,
        "success",
      );

      if (data.products.length === 0) {
        productGrid.innerHTML = `<div class="spinner-container"><p>No products found in this category.</p></div>`;
        return;
      }

      // Render cards
      data.products.forEach((product, idx) => {
        const card = document.createElement("div");
        card.className = "product-card animate-fade-in";
        card.style.animationDelay = `${idx * 40}ms`;

        // Check for simulated additions or updates in names to display glowing badges
        let badgesHtml = "";
        const nameLower = product.name.toLowerCase();

        if (nameLower.includes("simulated new")) {
          badgesHtml =
            '<span class="sim-badge badge-simulated-new">New Simulated</span>';
        } else if (nameLower.startsWith("updated")) {
          badgesHtml =
            '<span class="sim-badge badge-simulated-updated">Updated</span>';
        }

        card.innerHTML = `
          <div class="card-top">
            <span class="category-tag">${product.category}</span>
            <span class="product-price">$${product.price.toFixed(2)}</span>
          </div>
          <h3 class="product-name">${product.name}</h3>
          ${badgesHtml ? `<div class="card-badges-row">${badgesHtml}</div>` : ""}
          <div class="card-bottom">
            <span class="prod-id">ID: ${product.id}</span>
            <span class="prod-time">${formatRelativeTime(product.created_at)}</span>
          </div>
        `;

        productGrid.appendChild(card);
      });

      // Manage pagination button states
      btnPrev.disabled = cursorStack.length <= 1;
      btnNext.disabled = !currentNextCursor;
    } else {
      logToConsole(`API Error: ${data.error}`, "warn");
      productGrid.innerHTML = `<div class="spinner-container"><p>Error fetching products: ${data.error}</p></div>`;
    }
  } catch (err) {
    logToConsole(`Network Error: ${err.message}`, "warn");
    productGrid.innerHTML = `<div class="spinner-container"><p>Network error: Check if backend is running.</p></div>`;
  }
}

// ================= Tab Switching Logic =================

menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    // Remove active class from all menu buttons & tab content blocks
    menuItems.forEach((i) => i.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));

    // Add active class to clicked button and target tab
    item.classList.add("active");
    const tabId = item.getAttribute("data-tab");
    document.getElementById(tabId).classList.add("active");

    // Update Header Tab Title
    const label = item.querySelector(".menu-text").textContent;
    tabTitle.textContent =
      label === "Catalog Feed" ? "Product Catalog Feed" : label;

    logToConsole(`Switched dashboard workspace to: "${label}"`, "info");
  });
});

// ================= Query Analyzer Plan Selector Tabs =================

planTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    // Remove active classes
    planTabButtons.forEach((b) => b.classList.remove("active"));
    planTabContents.forEach((c) => c.classList.remove("active"));

    // Add active class
    btn.classList.add("active");
    const planId = btn.getAttribute("data-plan");
    document.getElementById(planId).classList.add("active");
  });
});

// ================= Pagination Control Buttons =================

// Next Page
btnNext.addEventListener("click", () => {
  if (currentNextCursor) {
    cursorStack.push(currentNextCursor);
    currentPage++;
    fetchProducts(currentNextCursor);
    logToConsole(
      `Navigating to Page ${currentPage}. Appended cursor to history stack.`,
      "info",
    );
  }
});

// Previous Page
btnPrev.addEventListener("click", () => {
  if (cursorStack.length > 1) {
    cursorStack.pop(); // Remove current page's cursor
    currentPage--;
    const prevCursor = cursorStack[cursorStack.length - 1]; // Get previous page's cursor
    fetchProducts(prevCursor);
    logToConsole(
      `Navigating back to Page ${currentPage}. Popped cursor from history stack.`,
      "info",
    );
  }
});

// Category Filter change
categorySelect.addEventListener("change", (e) => {
  currentCategory = e.target.value;
  // Reset pagination state
  cursorStack = [null];
  currentPage = 1;
  logToConsole(
    `Category filter changed to: "${currentCategory || "ALL"}". Reset pagination to Page 1.`,
    "info",
  );
  fetchProducts(null);
});

// ================= Simulation API Triggers =================

// Simulate Add (50 products)
btnAdd.addEventListener("click", async () => {
  btnAdd.disabled = true;
  logToConsole(
    "Sending simulation request: Inject 50 new products at the top...",
    "query",
  );

  try {
    const res = await fetch(`${API_BASE}/api/products/simulate-add`, {
      method: "POST",
    });
    const data = await res.json();

    if (data.success) {
      showToast("Added 50 new products!");
      logToConsole(
        `Simulated Event: Successfully added 50 mock products with created_at = NOW()`,
        "success",
      );
      logToConsole(
        `[Pagination Safety check] Keyset pagination filters items using 'WHERE created_at < cursor'. Since these 50 new products have timestamps newer than your cursor, they are positioned above your current viewing cursor. Your feed is 100% stable; you will not experience shifting rows or duplicate items when clicking "Next Page".`,
        "info",
      );

      // If we are on page 1, refresh the catalog to show the new items immediately
      if (currentPage === 1) {
        logToConsole(
          `You are currently on Page 1. Refreshing feed to display new additions at the top.`,
          "info",
        );
        fetchProducts(null);
      }
    } else {
      logToConsole(`Simulation failed: ${data.error}`, "warn");
    }
  } catch (err) {
    logToConsole(`Simulation network error: ${err.message}`, "warn");
  } finally {
    btnAdd.disabled = false;
  }
});

// Simulate Update (50 products)
btnUpdate.addEventListener("click", async () => {
  btnUpdate.disabled = true;
  logToConsole(
    "Sending simulation request: Update 50 random products...",
    "query",
  );

  try {
    const res = await fetch(`${API_BASE}/api/products/simulate-update`, {
      method: "POST",
    });
    const data = await res.json();

    if (data.success) {
      showToast("Updated 50 random products!");
      logToConsole(
        `Simulated Event: Modified fields for 50 random products in the database.`,
        "success",
      );
      logToConsole(
        `[Pagination Safety check] Since we sort by created_at (which is immutable), their indexes and positions in the feed remain stable. When you navigate to them, you will see their updated properties without skipping or double-counting products.`,
        "info",
      );

      // Refresh current page to display any updates if they occurred on the current page
      const currentCursor = cursorStack[cursorStack.length - 1];
      fetchProducts(currentCursor);
    } else {
      logToConsole(`Simulation failed: ${data.error}`, "warn");
    }
  } catch (err) {
    logToConsole(`Simulation network error: ${err.message}`, "warn");
  } finally {
    btnUpdate.disabled = false;
  }
});

// Clear console
btnClearConsole.addEventListener("click", () => {
  consoleLogs.innerHTML = `<div class="log-entry log-info">[System] Console cleared.</div>`;
});

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  fetchCategories();
  fetchProducts();
});
