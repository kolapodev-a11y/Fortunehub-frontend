// ===================================================
// FortuneHub Frontend Script (GitHub Pages + Render backend)
// - Fixes broken script.js syntax
// - Sends ABSOLUTE product image URLs to backend (for email images)
// ===================================================

// ------------------------------
// 1) CONFIG
// ------------------------------
const PAYSTACK_PUBLIC_KEY = "pk_test_9f6a5cb45aeab4bd8bccd72129beda47f2609921";
const API_BASE_URL = "https://fortunehub-backend.onrender.com"; // <-- replace with your Render backend URL

// ------------------------------
// 2) STATE
// ------------------------------
let products = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// ------------------------------
// 3) DOM
// ------------------------------
const productsGrid = document.getElementById("productsGrid");
const cartCount = document.getElementById("cartCount");
const cartModal = document.getElementById("cartModal");
const closeModal = document.getElementById("closeCartModal");
const cartItemsContainer = document.getElementById("cartItems");
const cartTotalElement = document.getElementById("cartTotal");
const cartSubTotalElement = document.getElementById("cartSubTotal");
const shippingFeeAmountElement = document.getElementById("shippingFeeAmount");
const checkoutButton = document.getElementById("checkoutButton");
const continueShoppingButton = document.getElementById("continueShoppingButton");
const filterButtons = document.querySelectorAll(".filter-btn");
const searchInput = document.getElementById("searchInput");
const categoryCards = document.querySelectorAll(".category-card");
const cartIcon = document.getElementById("cartIcon");
const searchIconBtn = document.getElementById("searchIcon");
const footerOpenCart = document.getElementById("footerOpenCart");

const customerNameInput = document.getElementById("customerName");
const customerEmailInput = document.getElementById("customerEmail");
const customerPhoneInput = document.getElementById("customerPhone");
const shippingStateSelect = document.getElementById("shippingState");

const nameError = document.getElementById("nameError");
const emailError = document.getElementById("emailError");
const phoneError = document.getElementById("phoneError");

// ------------------------------
// 4) URL HELPERS (GitHub Pages)
// ------------------------------
function getRepoBaseUrl() {
  // GitHub Pages project site: https://username.github.io/repo-name/
  const parts = window.location.pathname.split("/").filter(Boolean);
  const repoName = parts[0] || "";
  return `${window.location.origin}/${repoName}/`;
}

function resolveAssetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const base = getRepoBaseUrl();
  if (path.startsWith("/")) return `${window.location.origin}${path}`;
  return new URL(path, base).toString();
}

function getProductsJsonUrl() {
  // Always load from repo base, not from hash routes
  const base = getRepoBaseUrl();
  return new URL("products.json", base).toString();
}

// ------------------------------
// 5) GENERAL HELPERS
// ------------------------------
function formatCurrency(amountInKobo) {
  return `₦${(Number(amountInKobo) / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
  })}`;
}

function getProductById(id) {
  return products.find((p) => p.id === id);
}

// ------------------------------
// 6) CART
// ------------------------------
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function openCartModal() {
  if (!cartModal) return;
  cartModal.style.display = "block";
  cartModal.setAttribute("aria-hidden", "false");
  updateCartUI();
}

function closeCartModal() {
  if (!cartModal) return;
  cartModal.style.display = "none";
  cartModal.setAttribute("aria-hidden", "true");
}

function addToCart(productId, quantity = 1) {
  const product = getProductById(productId);
  if (!product || product.outOfStock || product.sold) {
    alert("This product is not available.");
    return;
  }

  const existing = cart.find((i) => i.id === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price, // KOBO
      quantity,
      // IMPORTANT: store ABSOLUTE url so email images work
      image: resolveAssetUrl(product.image),
    });
  }

  saveCart();
  updateCartUI();
  alert(`${product.name} added to cart!`);
}

function updateQuantity(productId, change) {
  const item = cart.find((i) => i.id === productId);
  if (!item) return;

  item.quantity += change;
  if (item.quantity <= 0) {
    cart = cart.filter((i) => i.id !== productId);
  }

  saveCart();
  updateCartUI();
}

function removeItem(productId) {
  cart = cart.filter((i) => i.id !== productId);
  saveCart();
  updateCartUI();
}

function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  if (cartCount) cartCount.textContent = totalItems;

  if (!cartItemsContainer) return;

  cartItemsContainer.innerHTML = "";

  if (!cart.length) {
    cartItemsContainer.innerHTML = `<p style="color:#555;">Your cart is empty.</p>`;

    if (checkoutButton) {
      checkoutButton.disabled = true;
      checkoutButton.innerHTML = `<i class="fas fa-credit-card" aria-hidden="true"></i> Proceed to Checkout`;
    }

    if (cartSubTotalElement) cartSubTotalElement.textContent = formatCurrency(0);
    if (shippingFeeAmountElement) shippingFeeAmountElement.textContent = formatCurrency(0);
    if (cartTotalElement) cartTotalElement.textContent = formatCurrency(0);
    return;
  }

  cart.forEach((item) => {
    const itemHTML = `
      <div class="cart-item">
        <div class="item-details">
          <img src="${item.image}" alt="${item.name}" />
          <div class="item-info">
            <h4>${item.name}</h4>
            <p class="item-price">${formatCurrency(item.price)}</p>
          </div>
        </div>

        <div class="item-quantity">
          <button class="btn-quantity" type="button" data-id="${item.id}" data-change="-1" aria-label="Decrease quantity">-</button>
          <span aria-label="Quantity">${item.quantity}</span>
          <button class="btn-quantity" type="button" data-id="${item.id}" data-change="1" aria-label="Increase quantity">+</button>
          <button class="remove-item" type="button" data-id="${item.id}" aria-label="Remove item">
            <i class="fas fa-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    `;

    cartItemsContainer.insertAdjacentHTML("beforeend", itemHTML);
  });

  // Quantity events
  cartItemsContainer.querySelectorAll(".btn-quantity").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.dataset.id, 10);
      const change = parseInt(e.currentTarget.dataset.change, 10);
      updateQuantity(id, change);
    });
  });

  // Remove events
  cartItemsContainer.querySelectorAll(".remove-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.dataset.id, 10);
      removeItem(id);
    });
  });

  // Totals
  const subtotalKobo = cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );

  const shippingFeeNaira = parseInt(shippingStateSelect?.value || "0", 10) || 0;
  const shippingKobo = cart.length ? shippingFeeNaira * 100 : 0;
  const grandTotalKobo = subtotalKobo + shippingKobo;

  if (cartSubTotalElement) cartSubTotalElement.textContent = formatCurrency(subtotalKobo);
  if (shippingFeeAmountElement) shippingFeeAmountElement.textContent = formatCurrency(shippingKobo);
  if (cartTotalElement) cartTotalElement.textContent = formatCurrency(grandTotalKobo);

  // Checkout button enable/disable
  if (checkoutButton) {
    const isValid = validateCustomerInfo({ silent: true });
    checkoutButton.disabled = !isValid;

    if (!isValid) {
      checkoutButton.innerHTML = `<i class="fas fa-exclamation-circle" aria-hidden="true"></i> Complete Info to Continue`;
    } else {
      checkoutButton.innerHTML = `<i class="fas fa-credit-card" aria-hidden="true"></i> Proceed to Checkout`;
    }
  }
}

// ------------------------------
// 7) VALIDATION
// ------------------------------
function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? "block" : "none";
}

function validateCustomerInfo({ silent = false } = {}) {
  let ok = true;

  const name = (customerNameInput?.value || "").trim();
  const email = (customerEmailInput?.value || "").trim();
  const phone = (customerPhoneInput?.value || "").trim();
  const stateValue = shippingStateSelect?.value || "";

  if (!silent) {
    showError(nameError, "");
    showError(emailError, "");
    showError(phoneError, "");
  }

  if (name.length < 2) {
    ok = false;
    if (!silent) showError(nameError, "Please enter your full name.");
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValid) {
    ok = false;
    if (!silent) showError(emailError, "Enter a valid email address.");
  }

  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    ok = false;
    if (!silent) showError(phoneError, "Enter a valid phone number.");
  }

  if (!stateValue) {
    ok = false;
  }

  if (!cart.length) ok = false;

  return ok;
}

// ------------------------------
// 8) PRODUCTS RENDER
// ------------------------------
function setActiveFilterButton(category) {
  filterButtons.forEach((btn) => {
    const active = btn.dataset.category === category;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function displayProducts(productsToShow) {
  if (!productsGrid) return;
  productsGrid.innerHTML = "";

  if (!productsToShow || !productsToShow.length) {
    productsGrid.innerHTML = `<div style="padding:20px; text-align:center; color:#666;">No products found</div>`;
    return;
  }

  productsToShow.forEach((product) => {
    const isSold = !!product.sold;
    const isOutOfStock = !!product.outOfStock;

    let badgeText = "";
    let badgeClass = "";

    if (isSold) {
      badgeText = "SOLD";
      badgeClass = "badge-sold";
    } else if (isOutOfStock) {
      badgeText = "OUT OF STOCK";
      badgeClass = "badge-out-of-stock";
    } else if (product.tag === "new") {
      badgeText = "NEW";
      badgeClass = "badge-new";
    } else if (product.tag === "sale") {
      badgeText = "SALE";
      badgeClass = "badge-sale";
    }

    // slider images (safe)
    const imgsRaw = Array.isArray(product.images) && product.images.length ? product.images : [product.image];
    const imgs = imgsRaw.filter(Boolean).slice(0, 3);
    while (imgs.length < 3) imgs.push(product.image);

    const sliderImages = imgs.map((p) => resolveAssetUrl(p));

    const disabled = isSold || isOutOfStock ? "disabled" : "";
    const addText = isSold ? "SOLD" : isOutOfStock ? "Out of Stock" : "Add to Cart";
    const buyText = isSold ? "SOLD" : isOutOfStock ? "Out of Stock" : "Buy Now";

    const productHTML = `
      <div class="product-card ${isOutOfStock || isSold ? "out-of-stock" : ""}">
        <div class="product-image-slider" data-images='${JSON.stringify(sliderImages)}'>
          <img class="product-main-img" src="${sliderImages[0]}" alt="${product.name}" loading="lazy" />

          <div class="product-thumbnails" aria-label="Product images">
            ${sliderImages
              .map(
                (src, index) =>
                  `<img class="thumb ${index === 0 ? "active" : ""}" src="${src}" alt="${product.name} thumbnail ${index + 1}" data-index="${index}" loading="lazy" />`
              )
              .join("")}
          </div>

          ${badgeText ? `<span class="product-badge ${badgeClass}">${badgeText}</span>` : ""}
        </div>

        <div class="product-info">
          <p class="product-category">${product.category}</p>
          <h3 class="product-title">${product.name}</h3>
          <p class="product-price">${formatCurrency(product.price)}</p>
          <p class="product-description">${product.description || ""}</p>

          <div class="product-actions">
            <button class="${isSold || isOutOfStock ? "btn-secondary" : "btn-add-to-cart add-to-cart"}" data-id="${product.id}" ${disabled} type="button">${addText}</button>
            <button class="${isSold || isOutOfStock ? "btn-secondary" : "btn-buy-now buy-now"}" data-id="${product.id}" ${disabled} type="button">${buyText}</button>
          </div>
        </div>
      </div>
    `;

    productsGrid.insertAdjacentHTML("beforeend", productHTML);
  });
}

function filterProducts(category) {
  const filtered =
    category === "all"
      ? products
      : products.filter((p) => (p.category || "").toLowerCase() === category.toLowerCase());

  displayProducts(filtered);
}

function searchProducts(query) {
  const text = (query || "").toLowerCase();
  const filtered = products.filter((p) => {
    const name = (p.name || "").toLowerCase();
    const category = (p.category || "").toLowerCase();
    const desc = (p.description || "").toLowerCase();
    return name.includes(text) || category.includes(text) || desc.includes(text);
  });

  displayProducts(filtered);
}

// ------------------------------
// 9) PAYSTACK
// ------------------------------
function initiatePaystackPayment() {
  if (!validateCustomerInfo()) {
    alert("Please complete all required information correctly.");
    return;
  }

  const name = (customerNameInput?.value || "").trim();
  const email = (customerEmailInput?.value || "").trim();
  const phone = (customerPhoneInput?.value || "").trim();

  const shippingFeeNaira = parseInt(shippingStateSelect.value, 10) || 0;

  const subtotalKobo = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingKobo = shippingFeeNaira * 100;
  const totalKobo = subtotalKobo + shippingKobo;

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount: totalKobo,

    metadata: {
      customer_name: name,
      customer_email: email,
      customer_phone: phone,

      shipping_state: shippingStateSelect.options[shippingStateSelect.selectedIndex]?.text || "",
      shipping_fee: shippingFeeNaira, // NAIRA

      // IMPORTANT: these images are ABSOLUTE urls (so backend email shows images)
      products: cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      })),

      cart_items: cart,
    },

    callback: function (response) {
      fetch(`${API_BASE_URL}/api/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ reference: response.reference }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data && data.success) {
            alert("✅ Order placed! We'll contact you shortly.");

            cart = [];
            saveCart();

            if (customerNameInput) customerNameInput.value = "";
            if (customerEmailInput) customerEmailInput.value = "";
            if (customerPhoneInput) customerPhoneInput.value = "";
            if (shippingStateSelect) shippingStateSelect.value = "";

            updateCartUI();
            closeCartModal();
          } else {
            console.log("verify-payment response:", data);
            alert("⚠️ Payment verified but order response not confirmed. Check admin logs.");
          }
        })
        .catch((err) => {
          console.error(err);
          alert("❌ Failed to verify payment. Please try again.");
        });
    },

    onClose: function () {},
  });

  handler.openIframe();
}

// ------------------------------
// 10) EVENTS
// ------------------------------
function setupEventListeners() {
  // Search icon scroll
  searchIconBtn?.addEventListener("click", () => {
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => searchInput?.focus(), 350);
  });

  searchInput?.addEventListener("input", (e) => searchProducts(e.target.value));

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.category;
      setActiveFilterButton(category);
      filterProducts(category);
    });
  });

  categoryCards.forEach((card) => {
    card.addEventListener("click", () => {
      const category = card.dataset.category;
      setActiveFilterButton(category);
      filterProducts(category);
      document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
    });
  });

  cartIcon?.addEventListener("click", openCartModal);

  footerOpenCart?.addEventListener("click", (e) => {
    e.preventDefault();
    openCartModal();
  });

  closeModal?.addEventListener("click", closeCartModal);
  continueShoppingButton?.addEventListener("click", closeCartModal);

  window.addEventListener("click", (e) => {
    if (cartModal && e.target === cartModal) closeCartModal();
  });

  shippingStateSelect?.addEventListener("change", updateCartUI);
  customerNameInput?.addEventListener("input", updateCartUI);
  customerEmailInput?.addEventListener("input", updateCartUI);
  customerPhoneInput?.addEventListener("input", updateCartUI);

  checkoutButton?.addEventListener("click", initiatePaystackPayment);

  // Product grid click delegation
  productsGrid?.addEventListener("click", (e) => {
    const target = e.target;

    if (target?.classList?.contains("add-to-cart")) {
      addToCart(parseInt(target.dataset.id, 10), 1);
      return;
    }

    if (target?.classList?.contains("buy-now")) {
      addToCart(parseInt(target.dataset.id, 10), 1);
      openCartModal();
      return;
    }

    if (target?.classList?.contains("thumb")) {
      const slider = target.closest(".product-image-slider");
      const mainImg = slider?.querySelector(".product-main-img");
      if (!slider || !mainImg) return;

      const images = JSON.parse(slider.dataset.images || "[]");
      const index = parseInt(target.dataset.index, 10);

      if (images[index]) mainImg.src = images[index];

      slider.querySelectorAll(".thumb").forEach((t) => t.classList.remove("active"));
      target.classList.add("active");
    }
  });
}

// ------------------------------
// 11) INIT
// ------------------------------
async function initializeApp() {
  try {
    const response = await fetch(getProductsJsonUrl(), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    products = await response.json();
  } catch (e) {
    console.error("❌ Failed to load products.json:", e);
    products = [];
  }

  displayProducts(products);
  setupEventListeners();
  updateCartUI();
  setActiveFilterButton("all");
}

document.addEventListener("DOMContentLoaded", initializeApp);
