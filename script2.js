// ===================================================
// FortuneHub Frontend Script - FIXED + GitHub Pages Image Path Fix
// (Updated for Render backend + Postgres JSON products)
// ===================================================

// ------------------------------
// 1) STATE
// ------------------------------
let products = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];

const PAYSTACK_PUBLIC_KEY = "pk_test_9f6a5cb45aeab4bd8bccd72129beda47f2609921";
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

const footerOpenCart = document.getElementById("footerOpenCart");

const customerNameInput = document.getElementById("customerName");
const customerEmailInput = document.getElementById("customerEmail");
const customerPhoneInput = document.getElementById("customerPhone");
const shippingStateSelect = document.getElementById("shippingState");

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

// Always fetch products.json from the repo root on GitHub Pages
function getProductsJsonUrl() {
  return new URL("products.json", window.location.href).toString();
}

/**
 * Repo base URL for GitHub Pages project sites.
 * Example:
 * origin: https://kolapodev-a11y.github.io
 * pathname: /Fortunehub-frontend/...
 * base => https://kolapodev-a11y.github.io/Fortunehub-frontend/
 */
function getRepoBaseUrl() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const repoName = parts.length ? parts[0] : "";
  return ${window.location.origin}/${repoName}/;
}

function resolveAssetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const base = getRepoBaseUrl();

  if (path.startsWith("/")) return ${window.location.origin}${path};
  return new URL(path, base).toString();
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
      'Your cart is empty.';
    if (checkoutButton) checkoutButton.disabled = true;

    if (cartSubTotalElement) cartSubTotalElement.textContent = formatCurrency(0);
    if (shippingFeeAmountElement) shippingFeeAmountElement.textContent = formatCurrency(0);
    if (cartTotalElement) cartTotalElement.textContent = formatCurrency(0);

    return;
  }

  cart.forEach((item) => {
    const itemHTML = `
      
        
          
          
            ${item.name}
            ${formatCurrency(item.price)}
          
        
        
          -
          ${item.quantity}
          +
          
        
      
    `;
    cartItemsContainer.insertAdjacentHTML("beforeend", itemHTML);
  });

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
  if (shippingFeeAmountElement) shippingFeeAmountElement.textContent = formatCurrency(shippingFee);
  if (cartTotalElement) cartTotalElement.textContent = formatCurrency(grandTotal);

  if (checkoutButton) {
    const isValid = validateCustomerInfo({ silent: true });
    const name = customerNameInput?.value?.trim() || "";
    const email = customerEmailInput?.value?.trim() || "";
    const phone = customerPhoneInput?.value?.trim() || "";

    if (!isValid || !name || !email || !phone) {
      checkoutButton.disabled = true;
      checkoutButton.innerHTML = ' Complete Info to Continue';
    } else {
      checkoutButton.disabled = false;
      checkoutButton.innerHTML = ' Proceed to Checkout';
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
  alert(${product.name} added to cart!);
}

function updateQuantity(productId, change) {
  const cartItem = cart.find((item) => item.id === productId);
  if (cartItem) {
    cartItem.quantity += change;
    if (cartItem.quantity  item.id !== productId);
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
// 5) VALIDATION
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

  if (!name || name.length 
        
        No products found
      
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

    const imgs =
      Array.isArray(product.images) && product.images.length
        ? product.images.slice(0, 3)
        : [product.image, product.image, product.image];

    const images = [
      resolveAssetUrl(imgs[0] || product.image),
      resolveAssetUrl(imgs[1] || product.image),
      resolveAssetUrl(imgs[2] || product.image),
    ];

    const productHTML = `
      
        
          

          
            
            
            
          

          ${badgeText ? ${badgeText} : ""}
        

        
          ${product.category}
          ${product.name}
          ${formatCurrency(product.price)}
          ${product.description}

          
            
              ${buttonText}
            
            
              ${buyNowText}
            
          
        
      
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
// 7) EVENTS
// ------------------------------
function setActiveFilterButton(category) {
  filterButtons.forEach((btn) => {
    const isActive = btn.dataset.category === category;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function setupEventListeners() {
  if (searchIconBtn) {
    searchIconBtn.addEventListener("click", () => {
      document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => searchInput?.focus(), 400);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => searchProducts(e.target.value));
  }

  filterButtons.forEach((button) => {
    button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
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

  productsGrid?.addEventListener("click", (e) => {
    const target = e.target;

    if (target?.classList?.contains("add-to-cart")) {
      addToCart(parseInt(target.dataset.id, 10));
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
// 8) MODAL
// ------------------------------
function openCartModal() {
  if (!cartModal) return;
  cartModal.style.display = "block";
  updateCartUI();
}

function closeCartModal() {
  if (!cartModal) return;
  cartModal.style.display = "none";
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

  if (!validateCustomerInfo()) {
    alert("Please complete all required information correctly.");
    return;
  }

  const shippingFeeNaira = parseInt(shippingStateSelect.value, 10) || 0;

  const subtotalKobo = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingKobo = shippingFeeNaira * 100;
  const totalKobo = subtotalKobo + shippingKobo;

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount: totalKobo,

    // ✅ UPDATED METADATA (JSON products + shipping info)
    metadata: {
      customer_name: name,
      customer_email: email,
      customer_phone: phone,

      shipping_state:
        shippingStateSelect.options[shippingStateSelect.selectedIndex]?.text || "",
      shipping_fee: shippingFeeNaira, // NAIRA

      // Improved schema: JSON products
      products: cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price, // KOBO
        quantity: item.quantity,
        image: item.image,
      })),

      // Keep cart_items too
      cart_items: cart,
    },

    callback: function (response) {
      fetch(${API_BASE_URL}/api/verify-payment, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ reference: response.reference }),
      })
        .then((r) => r.json())
        .then((data) => {
          // ✅ FIXED SUCCESS CHECK
          if (data && (data.reference || data.orderId)) {
            alert("✅ Order placed! We'll contact you shortly.");

            cart = [];
            localStorage.setItem("cart", JSON.stringify(cart));

            if (customerNameInput) customerNameInput.value = "";
            if (customerEmailInput) customerEmailInput.value = "";
            if (customerPhoneInput) customerPhoneInput.value = "";
            if (shippingStateSelect) shippingStateSelect.value = "";

            updateCartUI();
            closeCartModal();
          } else {
            console.log("verify-payment response:", data);
            alert(
              "⚠️ Payment verification response received. Please confirm with support if needed."
            );
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
// 10) INIT
// ------------------------------
async function initializeApp() {
  try {
    const response = await fetch(getProductsJsonUrl(), { cache: "no-store" });
    if (!response.ok) throw new Error(HTTP ${response.status});
    products = await response.json();
  } catch (e) {
    console.error("❌ Failed to load products.json:", e);
    products = [];
  }

  displayProducts(products);
  setupEventListeners();
  updateCartUI();

  // Ensure default "All Products" active matches UI
  setActiveFilterButton("all");
}

document.addEventListener("DOMContentLoaded", initializeApp);
