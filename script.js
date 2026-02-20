// ===================================================
// FortuneHub Frontend Script - WITH PRODUCT DETAIL MODAL & IMAGE ZOOM
// ===================================================

// ------------------------------
// 1) STATE
// ------------------------------
let products = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentProduct = null;
let zoomEnabled = false;

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

// Product Detail Modal Elements
const productDetailModal = document.getElementById("productDetailModal");
const closeProductModal = document.getElementById("closeProductModal");
const detailMainImage = document.getElementById("detailMainImage");
const detailThumbnails = document.getElementById("detailThumbnails");
const detailCategory = document.getElementById("detailCategory");
const detailTitle = document.getElementById("detailTitle");
const detailPrice = document.getElementById("detailPrice");
const detailBadge = document.getElementById("detailBadge");
const detailDescription = document.getElementById("detailDescription");
const detailSpecsList = document.getElementById("detailSpecsList");
const detailAddCart = document.getElementById("detailAddCart");
const detailBuyNow = document.getElementById("detailBuyNow");
const zoomToggle = document.getElementById("zoomToggle");
const zoomLens = document.getElementById("zoomLens");
const zoomResult = document.getElementById("zoomResult");

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
  return `${window.location.origin}/${repoName}/`;
}

function resolveAssetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const base = getRepoBaseUrl();

  if (path.startsWith("/")) return `${window.location.origin}${path}`;
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

  if (!name || name.length < 3 || name.includes("@") || name.includes(".")) {
    if (!silent && nameError) {
      nameError.textContent = "Please enter your full name (not email).";
      nameError.style.display = "block";
    }
    isValid = false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    if (!silent && emailError) {
      emailError.textContent = "Enter a valid email (e.g., name@example.com).";
      emailError.style.display = "block";
    }
    isValid = false;
  }

  const phoneRegex = /^(0[789][01])\d{8}$/;
  if (!phone || !phoneRegex.test(phone)) {
    if (!silent && phoneError) {
      phoneError.textContent = "Enter a valid Nigerian phone number (e.g., 08031234567).";
      phoneError.style.display = "block";
    }
    isValid = false;
  }

  if (!stateValue) isValid = false;
  return isValid;
}

// ------------------------------
// 6) PRODUCT DETAIL MODAL (NEW)
// ------------------------------
function openProductDetail(productId) {
  const product = getProductById(productId);
  if (!product) return;

  currentProduct = product;
  
  // Disable zoom when opening modal
  zoomEnabled = false;
  const mainContainer = document.querySelector('.main-image-container');
  if (mainContainer) mainContainer.classList.remove('zoom-active');

  // Set category
  if (detailCategory) {
    detailCategory.textContent = product.category || "Product";
  }

  // Set title
  if (detailTitle) {
    detailTitle.textContent = product.name;
  }

  // Set price
  if (detailPrice) {
    detailPrice.textContent = formatCurrency(product.price);
  }

  // Set badge
  if (detailBadge) {
    detailBadge.textContent = "";
    detailBadge.className = "detail-badge";
    
    if (product.sold) {
      detailBadge.textContent = "SOLD";
      detailBadge.classList.add("badge-sold");
      detailBadge.style.display = "inline-block";
    } else if (product.tag === "new") {
      detailBadge.textContent = "NEW";
      detailBadge.classList.add("badge-new");
      detailBadge.style.display = "inline-block";
    } else if (product.tag === "sale") {
      detailBadge.textContent = "SALE";
      detailBadge.classList.add("badge-sale");
      detailBadge.style.display = "inline-block";
    } else {
      detailBadge.style.display = "none";
    }
  }

  // Set description
  if (detailDescription) {
    detailDescription.textContent = product.description || "No description available.";
  }

  // Set specifications
  if (detailSpecsList) {
    detailSpecsList.innerHTML = "";
    
    const specs = product.specifications || {
      "Category": product.category,
      "Availability": product.outOfStock ? "Out of Stock" : "In Stock",
      "Price": formatCurrency(product.price)
    };

    Object.entries(specs).forEach(([key, value]) => {
      const li = document.createElement("li");
      li.innerHTML = `<i class="fas fa-check-circle"></i> <strong>${key}:</strong> ${value}`;
      detailSpecsList.appendChild(li);
    });
  }

  // Set images
  const imgs = Array.isArray(product.images) && product.images.length
    ? product.images.slice(0, 4)
    : [product.image, product.image, product.image];

  const images = imgs.map(img => resolveAssetUrl(img || product.image));

  if (detailMainImage) {
    detailMainImage.src = images[0];
    detailMainImage.alt = product.name;
  }

  // Set thumbnails
  if (detailThumbnails) {
    detailThumbnails.innerHTML = "";
    images.forEach((imgSrc, index) => {
      const thumb = document.createElement("img");
      thumb.src = imgSrc;
      thumb.alt = `${product.name} ${index + 1}`;
      thumb.classList.add("detail-thumb");
      if (index === 0) thumb.classList.add("active");
      thumb.addEventListener("click", () => {
        detailMainImage.src = imgSrc;
        detailThumbnails.querySelectorAll("img").forEach(t => t.classList.remove("active"));
        thumb.classList.add("active");
      });
      detailThumbnails.appendChild(thumb);
    });
  }

  // Set button states
  const isSoldOrOutOfStock = product.sold || product.outOfStock;
  
  if (detailAddCart) {
    detailAddCart.disabled = isSoldOrOutOfStock;
    detailAddCart.textContent = isSoldOrOutOfStock ? "Out of Stock" : "Add to Cart";
    detailAddCart.innerHTML = isSoldOrOutOfStock 
      ? '<i class="fas fa-ban"></i> Out of Stock'
      : '<i class="fas fa-cart-plus"></i> Add to Cart';
  }

  if (detailBuyNow) {
    detailBuyNow.disabled = isSoldOrOutOfStock;
    detailBuyNow.innerHTML = isSoldOrOutOfStock 
      ? '<i class="fas fa-ban"></i> Out of Stock'
      : '<i class="fas fa-bolt"></i> Buy Now';
  }

  // Show modal
  if (productDetailModal) {
    productDetailModal.style.display = "block";
    document.body.style.overflow = "hidden";
  }

  // Initialize zoom
  initImageZoom();
}

function closeProductDetail() {
  if (productDetailModal) {
    productDetailModal.style.display = "none";
    document.body.style.overflow = "auto";
  }
  currentProduct = null;
  zoomEnabled = false;
  const mainContainer = document.querySelector('.main-image-container');
  if (mainContainer) mainContainer.classList.remove('zoom-active');
}

// ------------------------------
// 7) IMAGE ZOOM FUNCTIONALITY (NEW)
// ------------------------------
function initImageZoom() {
  const mainImage = detailMainImage;
  const lens = zoomLens;
  const result = zoomResult;
  const container = document.querySelector('.main-image-container');

  if (!mainImage || !lens || !result || !container) return;

  let cx, cy;

  // Calculate zoom ratio
  function updateZoomRatio() {
    cx = result.offsetWidth / lens.offsetWidth;
    cy = result.offsetHeight / lens.offsetHeight;
    result.style.backgroundImage = `url('${mainImage.src}')`;
    result.style.backgroundSize = `${mainImage.width * cx}px ${mainImage.height * cy}px`;
  }

  function moveLens(e) {
    if (!zoomEnabled) return;

    e.preventDefault();
    
    const pos = getCursorPos(e);
    let x = pos.x - lens.offsetWidth / 2;
    let y = pos.y - lens.offsetHeight / 2;

    // Prevent lens from going outside image
    if (x > mainImage.width - lens.offsetWidth) x = mainImage.width - lens.offsetWidth;
    if (x < 0) x = 0;
    if (y > mainImage.height - lens.offsetHeight) y = mainImage.height - lens.offsetHeight;
    if (y < 0) y = 0;

    lens.style.left = x + 'px';
    lens.style.top = y + 'px';
    result.style.backgroundPosition = `-${x * cx}px -${y * cy}px`;
  }

  function getCursorPos(e) {
    const rect = mainImage.getBoundingClientRect();
    const x = (e.pageX || e.touches[0].pageX) - rect.left - window.pageXOffset;
    const y = (e.pageY || e.touches[0].pageY) - rect.top - window.pageYOffset;
    return { x, y };
  }

  // Toggle zoom on button click
  if (zoomToggle) {
    zoomToggle.onclick = function() {
      zoomEnabled = !zoomEnabled;
      
      if (zoomEnabled) {
        container.classList.add('zoom-active');
        updateZoomRatio();
        this.querySelector('i').classList.remove('fa-search-plus');
        this.querySelector('i').classList.add('fa-search-minus');
      } else {
        container.classList.remove('zoom-active');
        this.querySelector('i').classList.remove('fa-search-minus');
        this.querySelector('i').classList.add('fa-search-plus');
      }
    };
  }

  // Mouse/Touch events
  container.addEventListener('mousemove', moveLens);
  container.addEventListener('touchmove', moveLens);
  
  mainImage.addEventListener('load', updateZoomRatio);
  window.addEventListener('resize', updateZoomRatio);
}

// ------------------------------
// 8) PRODUCTS UI
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
      <div class="product-card" data-category="${product.category}" data-product-id="${product.id}">
        <div class="product-image-slider" data-images='${JSON.stringify(images)}'>
          <img src="${images[0]}" alt="${product.name}" class="product-main-img" loading="lazy">

          <div class="product-thumbnails">
            <img src="${images[0]}" alt="1" class="thumb active" data-index="0" loading="lazy">
            <img src="${images[1]}" alt="2" class="thumb" data-index="1" loading="lazy">
            <img src="${images[2]}" alt="3" class="thumb" data-index="2" loading="lazy">
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
// 9) EVENTS
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

  // Product Detail Modal Events
  closeProductModal?.addEventListener("click", closeProductDetail);

  if (detailAddCart) {
    detailAddCart.addEventListener("click", () => {
      if (currentProduct && !currentProduct.sold && !currentProduct.outOfStock) {
        addToCart(currentProduct.id);
      }
    });
  }

  if (detailBuyNow) {
    detailBuyNow.addEventListener("click", () => {
      if (currentProduct && !currentProduct.sold && !currentProduct.outOfStock) {
        addToCart(currentProduct.id, 1);
        closeProductDetail();
        openCartModal();
      }
    });
  }

  window.addEventListener("click", (e) => {
    if (cartModal && e.target === cartModal) closeCartModal();
    if (productDetailModal && e.target === productDetailModal) closeProductDetail();
  });

  shippingStateSelect?.addEventListener("change", updateCartUI);

  customerNameInput?.addEventListener("input", updateCartUI);
  customerEmailInput?.addEventListener("input", updateCartUI);
  customerPhoneInput?.addEventListener("input", updateCartUI);

  checkoutButton?.addEventListener("click", initiatePaystackPayment);

  productsGrid?.addEventListener("click", (e) => {
    const target = e.target;

    // Click on product card to view details (but not on buttons)
    const card = target.closest(".product-card");
    if (card && !target.closest("button") && !target.closest(".thumb")) {
      const productId = parseInt(card.dataset.productId, 10);
      openProductDetail(productId);
      return;
    }

    if (target?.classList?.contains("add-to-cart")) {
      e.stopPropagation();
      addToCart(parseInt(target.dataset.id, 10));
      return;
    }

    if (target?.classList?.contains("buy-now")) {
      e.stopPropagation();
      addToCart(parseInt(target.dataset.id, 10), 1);
      openCartModal();
      return;
    }

    if (target?.classList?.contains("thumb")) {
      e.stopPropagation();
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
// 10) MODAL
// ------------------------------
function openCartModal() {
  if (!cartModal) return;
  cartModal.style.display = "block";
  document.body.style.overflow = "hidden";
  updateCartUI();
}

function closeCartModal() {
  if (!cartModal) return;
  cartModal.style.display = "none";
  document.body.style.overflow = "auto";
}

// ------------------------------
// 11) PAYSTACK - FIXED ENDPOINT
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
    metadata: {
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      cart_items: cart,
    },
    callback: function (response) {
      // ========================================
      // FIXED: Use correct verification endpoint
      // ========================================
      fetch(`${API_BASE_URL}/api/payment/verify`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Accept": "application/json" 
        },
        body: JSON.stringify({ reference: response.reference }),
      })
        .then((r) => {
          if (!r.ok) {
            throw new Error(`HTTP error! status: ${r.status}`);
          }
          return r.json();
        })
        .then((data) => {
          console.log("✅ Verification response:", data);
          
          if (data.success) {
            alert("✅ Payment successful! Order confirmed. Check your email for details.");
            
            // Clear cart
            cart = [];
            localStorage.setItem("cart", JSON.stringify(cart));

            // Clear form
            if (customerNameInput) customerNameInput.value = "";
            if (customerEmailInput) customerEmailInput.value = "";
            if (customerPhoneInput) customerPhoneInput.value = "";
            if (shippingStateSelect) shippingStateSelect.value = "";

            updateCartUI();
            closeCartModal();
            
            // Optional: Redirect to success page
            // window.location.href = "success.html?reference=" + response.reference;
          } else {
            alert("⚠️ Payment verification failed: " + (data.message || "Unknown error"));
          }
        })
        .catch((err) => {
          console.error("❌ Verification error:", err);
          alert("❌ Failed to verify payment. Please contact support with reference: " + response.reference);
        });
    },
    onClose: function () {
      console.log("Payment window closed");
    },
  });

  handler.openIframe();
}

// ------------------------------
// 12) INIT
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

  // Ensure default "All Products" active matches UI
  setActiveFilterButton("all");
}

document.addEventListener("DOMContentLoaded", initializeApp);
