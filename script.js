// ===================================================
// FortuneHub Frontend Script - FIXED VERSION
// ===================================================

// ------------------------------
// 1) STATE
// ------------------------------
let products = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// ✅ Paystack (test public key in frontend)
const PAYSTACK_PUBLIC_KEY = "pk_test_9f6a5cb45aeab4bd8bccd72129beda47f2609921";

// Backend (Render)
const API_BASE_URL = "https://fortunehub-backend.onrender.com";

// ------------------------------
// 2) DOM ELEMENTS
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

// Customer info fields
const customerNameInput = document.getElementById("customerName");
const customerEmailInput = document.getElementById("customerEmail");
const customerPhoneInput = document.getElementById("customerPhone");
const shippingStateSelect = document.getElementById("shippingState");

// Error elements
const nameError = document.getElementById("nameError");
const emailError = document.getElementById("emailError");
const phoneError = document.getElementById("phoneError");

// ------------------------------
// 3) HELPERS
// ------------------------------
function formatCurrency(amountInKobo) {
  return `₦${(amountInKobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
  })}`;
}

function getProductById(id) {
  return products.find((p) => p.id === id);
}

/**
 * ✅ GitHub Pages-safe URL to products.json
 */
function getProductsJsonUrl() {
  return new URL("products.json", window.location.href).toString();
}

/**
 * Resolve asset URLs for images
 */
function resolveAssetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return path;
  return new URL(path, window.location.href).toString();
}

// ------------------------------
// 4) CART UI + LOGIC
// ------------------------------
function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (cartCount) cartCount.textContent = totalItems;

  if (!cartItemsContainer) return;

  cartItemsContainer.innerHTML = "";
  if (cart.length === 0) {
    cartItemsContainer.innerHTML =
      '<p style="text-align:center;color:#555;">Your cart is empty.</p>';
    if (checkoutButton) checkoutButton.disabled = true;
    return;
  }

  cart.forEach((item) => {
    const itemHTML = `
      <div class="cart-item">
        <div class="item-details">
          <img src="${resolveAssetUrl(item.image)}" alt="${item.name}">
          <div class="item-info">
            <h4>${item.name}</h4>
            <span class="item-price">${formatCurrency(item.price)}</span>
          </div>
        </div>
        <div class="item-quantity">
          <button class="btn-quantity minus" data-id="${item.id}" data-change="-1">-</button>
          <span>${item.quantity}</span>
          <button class="btn-quantity plus" data-id="${item.id}" data-change="1">+</button>
          <i class="fas fa-trash-alt remove-item" data-id="${item.id}"></i>
        </div>
      </div>
    `;
    cartItemsContainer.insertAdjacentHTML("beforeend", itemHTML);
  });

  // Quantity + Remove events
  document.querySelectorAll(".btn-quantity").forEach((button) => {
    button.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.dataset.id, 10);
      const change = parseInt(e.currentTarget.dataset.change, 10);
      updateQuantity(id, change);
    });
  });

  document.querySelectorAll(".remove-item").forEach((button) => {
    button.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.dataset.id, 10);
      removeItem(id);
    });
  });

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedShippingFeeNaira = parseInt(shippingStateSelect?.value || "0", 10);
  const shippingFee = cart.length > 0 ? selectedShippingFeeNaira * 100 : 0;
  const grandTotal = subtotal + shippingFee;

  if (cartSubTotalElement) cartSubTotalElement.textContent = formatCurrency(subtotal);
  if (shippingFeeAmountElement)
    shippingFeeAmountElement.textContent = formatCurrency(shippingFee);

  if (cartTotalElement) {
    cartTotalElement.textContent = formatCurrency(grandTotal);
  }

  // Checkout button state
  if (checkoutButton) {
    const isValid = validateCustomerInfo({ silent: true });
    const name = customerNameInput?.value?.trim() || "";
    const email = customerEmailInput?.value?.trim() || "";
    const phone = customerPhoneInput?.value?.trim() || "";

    if (!isValid || !name || !email || !phone) {
      checkoutButton.disabled = true;
      checkoutButton.innerHTML = '<i class="fas fa-info-circle"></i> Complete Info to Continue';
    } else {
      checkoutButton.disabled = false;
      checkoutButton.innerHTML = '<i class="fas fa-credit-card"></i> Proceed to Checkout';
    }
  }
}

function addToCart(productId, quantity = 1) {
  const product = getProductById(productId);
  if (!product || product.outOfStock) {
    alert("Product is out of stock.");
    return;
  }

  const cartItem = cart.find((item) => item.id === productId);
  if (cartItem) cartItem.quantity += quantity;
  else {
    cart.push({
      id: productId,
      name: product.name,
      price: product.price,
      quantity,
      image: product.image,
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartUI();
  alert(`${product.name} added to cart!`);
}

function updateQuantity(productId, change) {
  const cartItem = cart.find((item) => item.id === productId);
  if (cartItem) {
    cartItem.quantity += change;
    if (cartItem.quantity <= 0) cart = cart.filter((item) => item.id !== productId);
  }
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartUI();
}

function removeItem(productId) {
  cart = cart.filter((item) => item.id !== productId);
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartUI();
}

// ------------------------------
// 5) CUSTOMER VALIDATION
// ------------------------------
function validateCustomerInfo({ silent = false } = {}) {
  let isValid = true;

  if (nameError) nameError.style.display = "none";
  if (emailError) emailError.style.display = "none";
  if (phoneError) phoneError.style.display = "none";

  const name = customerNameInput?.value?.trim() || "";
  const email = customerEmailInput?.value?.trim() || "";
  const phone = customerPhoneInput?.value?.trim() || "";
  const stateValue = shippingStateSelect?.value || "";

  // Name
  if (!name || name.length < 3 || name.includes("@") || name.includes(".")) {
    if (!silent && nameError) {
      nameError.textContent = "Please enter your full name (not email).";
      nameError.style.display = "block";
    }
    isValid = false;
  }

  // Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    if (!silent && emailError) {
      emailError.textContent = "Enter a valid email (e.g., name@example.com).";
      emailError.style.display = "block";
    }
    isValid = false;
  }

  // Phone (NG)
  const phoneRegex = /^(0[789][01])\d{8}$/;
  if (!phone || !phoneRegex.test(phone)) {
    if (!silent && phoneError) {
      phoneError.textContent =
        "Enter a valid Nigerian phone number (e.g., 08031234567).";
      phoneError.style.display = "block";
    }
    isValid = false;
  }

  // Shipping state
  if (!stateValue) isValid = false;

  return isValid;
}

// ------------------------------
// 6) PRODUCTS UI (with 3-image thumbnails)
// ------------------------------
function displayProducts(productsToShow) {
  if (!productsGrid) return;
  productsGrid.innerHTML = "";

  if (!productsToShow || productsToShow.length === 0) {
    productsGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;color:#555;">
        <i class="fas fa-box-open" style="font-size:48px;color:#ccc;margin-bottom:15px;"></i>
        <p style="font-size:18px;margin:0;">No products found</p>
      </div>
    `;
    return;
  }

  productsToShow.forEach((product) => {
    const isSold = !!product.sold;
    const isOutOfStock = !!product.outOfStock;

    let badgeClass = "";
    let badgeText = "";

    if (isSold) {
      badgeClass = "badge-sold";
      badgeText = "SOLD";
    } else if (product.tag === "new") {
      badgeClass = "badge-new";
      badgeText = "NEW";
    } else if (product.tag === "sale") {
      badgeClass = "badge-sale";
      badgeText = "SALE";
    }

    // Buttons
    let buttonText = "Add to Cart";
    let buttonClass = "btn-add-to-cart add-to-cart";
    let buyNowText = "Buy Now";
    let buyNowClass = "btn-buy-now buy-now";
    let isDisabled = "";

    if (isSold) {
      buttonText = "SOLD";
      buttonClass = "btn-secondary";
      buyNowText = "SOLD";
      buyNowClass = "btn-secondary";
      isDisabled = "disabled";
    } else if (isOutOfStock) {
      buttonText = "Out of Stock";
      buttonClass = "btn-secondary";
      buyNowText = "Out of Stock";
      buyNowClass = "btn-secondary";
      isDisabled = "disabled";
    }

    // Images: prefer product.images[0..2]
    const imgs = Array.isArray(product.images) && product.images.length
      ? product.images.slice(0, 3)
      : [product.image, product.image, product.image];

    const images = [
      resolveAssetUrl(imgs[0] || product.image),
      resolveAssetUrl(imgs[1] || product.image),
      resolveAssetUrl(imgs[2] || product.image),
    ];

    const productHTML = `
      <div class="product-card" data-category="${product.category}">
        <div class="product-image-slider" data-images='${JSON.stringify(images)}'>
          <img src="${images[0]}" alt="${product.name}" class="product-main-img">
          
          <div class="product-thumbnails">
            <img src="${images[0]}" alt="1" class="thumb active" data-index="0">
            <img src="${images[1]}" alt="2" class="thumb" data-index="1">
            <img src="${images[2]}" alt="3" class="thumb" data-index="2">
          </div>

          ${badgeText ? `<span class="product-badge ${badgeClass}">${badgeText}</span>` : ""}
        </div>

        <div class="product-info">
          <p class="product-category">${product.category}</p>
          <h3 class="product-title">${product.name}</h3>
          <p class="product-price">${formatCurrency(product.price)}</p>
          <p class="product-description">${product.description}</p>

          <div class="product-actions">
            <button class="btn ${buttonClass}" ${isDisabled} data-id="${product.id}">
              ${buttonText}
            </button>
            <button class="btn ${buyNowClass}" ${isDisabled} data-id="${product.id}">
              ${buyNowText}
            </button>
          </div>
        </div>
      </div>
    `;

    productsGrid.insertAdjacentHTML("beforeend", productHTML);
  });
}

function filterProducts(category) {
  if (!products || products.length === 0) return;

  const filtered =
    category === "all"
      ? products
      : products.filter(
          (p) => (p.category || "").toLowerCase() === category.toLowerCase()
        );

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
// 7) EVENTS (use delegation to avoid duplicates)
// ------------------------------
function setupEventListeners() {
  // ✅ FIXED: Search icon (top right) -> scroll to products section AND focus search input
  if (searchIconBtn) {
    searchIconBtn.addEventListener("click", () => {
      const productsSection = document.getElementById("products");
      const searchContainer = document.getElementById("search-container");
      
      // Scroll to products section
      if (productsSection) {
        productsSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      
      // Wait a bit for scroll, then focus search input
      setTimeout(() => {
        if (searchInput) {
          searchInput.focus();
          searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 500);
    });
  }

  // Search input typing
  if (searchInput) {
    searchInput.addEventListener("input", (e) => searchProducts(e.target.value));
  }

  // Filter buttons
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      filterProducts(button.dataset.category);
    });
  });

  // Category cards -> filter + scroll
  categoryCards.forEach((card) => {
    card.addEventListener("click", () => {
      const category = card.dataset.category;
      filterProducts(category);

      filterButtons.forEach((btn) => {
        btn.classList.remove("active");
        if (btn.dataset.category === category) btn.classList.add("active");
      });

      document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
    });
  });

  // Cart modal open/close
  cartIcon?.addEventListener("click", openCartModal);
  closeModal?.addEventListener("click", closeCartModal);
  continueShoppingButton?.addEventListener("click", closeCartModal);

  window.addEventListener("click", (e) => {
    if (cartModal && e.target === cartModal) closeCartModal();
  });

  // Shipping select affects total
  shippingStateSelect?.addEventListener("change", updateCartUI);

  // Validate typing -> refresh checkout state
  customerNameInput?.addEventListener("input", () => {
    validateCustomerInfo({ silent: true });
    updateCartUI();
  });
  customerEmailInput?.addEventListener("input", () => {
    validateCustomerInfo({ silent: true });
    updateCartUI();
  });
  customerPhoneInput?.addEventListener("input", () => {
    validateCustomerInfo({ silent: true });
    updateCartUI();
  });

  // Checkout
  checkoutButton?.addEventListener("click", initiatePaystackPayment);

  // ✅ Product grid delegation:
  // - add to cart
  // - buy now
  // - thumbnail click swap image
  productsGrid?.addEventListener("click", (e) => {
    const target = e.target;

    // Add to cart button
    if (target?.classList?.contains("add-to-cart")) {
      const id = parseInt(target.dataset.id, 10);
      addToCart(id);
      return;
    }

    // Buy now button
    if (target?.classList?.contains("buy-now")) {
      const id = parseInt(target.dataset.id, 10);
      addToCart(id, 1);
      openCartModal();
      return;
    }

    // Thumbnail click
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
// 8) MODAL CONTROL
// ------------------------------
function openCartModal() {
  if (cartModal) {
    cartModal.style.display = "block";
    updateCartUI();

    // Smart focus
    if (customerNameInput && !customerNameInput.value) customerNameInput.focus();
    else if (customerEmailInput && !customerEmailInput.value) customerEmailInput.focus();
  }
}

function closeCartModal() {
  if (cartModal) cartModal.style.display = "none";
}

// ------------------------------
// 9) PAYSTACK
// ------------------------------
function initiatePaystackPayment() {
  if (cart.length === 0) {
    alert("Your cart is empty.");
    return;
  }

  const name = (customerNameInput?.value || "").trim();
  const email = (customerEmailInput?.value || "").trim();
  const phone = (customerPhoneInput?.value || "").trim();

  // Strong validation
  if (!name || name.length < 3 || name.includes("@") || name.includes(".")) {
    alert("Please enter your real full name (not email).");
    customerNameInput?.focus();
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    alert("Please enter a valid email address.");
    customerEmailInput?.focus();
    return;
  }

  const phoneRegex = /^(0[789][01])\d{8}$/;
  if (!phone || !phoneRegex.test(phone)) {
    alert("Please enter a valid Nigerian WhatsApp number (e.g., 08031234567).");
    customerPhoneInput?.focus();
    return;
  }

  if (!validateCustomerInfo()) {
    alert("Please complete all required shipping information.");
    return;
  }

  const stateOption = shippingStateSelect.options[shippingStateSelect.selectedIndex];
  const shippingState = (stateOption?.textContent?.split("—")[0]?.trim() || "Unknown");
  const shippingFeeNaira = parseInt(shippingStateSelect.value, 10) || 0;

  const productNames = cart.map((item) => item.name).join(", ") || "Products";
  const subtotalKobo = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingKobo = shippingFeeNaira * 100;
  const totalKobo = subtotalKobo + shippingKobo;

  if (!Number.isFinite(totalKobo) || totalKobo <= 0) {
    alert("Invalid payment amount. Please try again.");
    return;
  }

  const safeMeta = {
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    shipping_state: shippingState,
    shipping_fee: shippingFeeNaira,
    products: productNames,
    cart_items: cart.map((item) => ({
      id: item.id || 0,
      name: item.name || "Unknown Item",
      price: item.price || 0,
      quantity: item.quantity || 1,
      image: item.image || "",
    })),
  };

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount: totalKobo,
    metadata: safeMeta,
    callback: function (response) {
      fetch(`${API_BASE_URL}/api/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ reference: response.reference }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("Network response was not ok");
          return r.json();
        })
        .then((data) => {
          if (data.message && data.message.includes("email sent")) {
            alert("✅ Order placed! We'll contact you shortly.");
            cart = [];
            localStorage.setItem("cart", JSON.stringify(cart));

            if (customerNameInput) customerNameInput.value = "";
            if (customerEmailInput) customerEmailInput.value = "";
            if (customerPhoneInput) customerPhoneInput.value = "";
            if (shippingStateSelect) shippingStateSelect.value = "";

            updateCartUI();
            closeCartModal();
          } else if (data.error) {
            alert("⚠️ " + data.error);
          } else {
            alert("⚠️ Payment verification failed. Please contact support.");
          }
        })
        .catch((err) => {
          console.error("Verification failed:", err);
          alert("❌ Failed to verify payment. Please try again.");
        });
    },
    onClose: function () {
      if (nameError) nameError.style.display = "none";
      if (emailError) emailError.style.display = "none";
      if (phoneError) phoneError.style.display = "none";
    },
  });

  handler.openIframe();
}

// ------------------------------
// 10) APP INIT
// ------------------------------
async function initializeApp() {
  console.log("🚀 Initializing FortuneHub...");
  
  try {
    const url = getProductsJsonUrl();
    console.log("📦 Fetching products from:", url);
    
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    products = await response.json();
    console.log("✅ Loaded", products.length, "products");
  } catch (e) {
    console.error("❌ Failed to load products.json:", e);
    products = [];
  }

  displayProducts(products);
  setupEventListeners();
  updateCartUI();
  
  console.log("✅ FortuneHub initialized!");
}

document.addEventListener("DOMContentLoaded", initializeApp);
