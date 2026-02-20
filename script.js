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
// Enhanced script.js with IMPROVED LOADING STATES during payment verification

// Find the Paystack payment handler section and replace with this:

// ========================================
// ENHANCED PAYSTACK PAYMENT WITH LOADING
// ========================================

function initializePayment() {
  // Get form values
  const customerName = customerNameInput.value.trim();
  const customerEmail = customerEmailInput.value.trim();
  const customerPhone = customerPhoneInput.value.trim();
  const shippingState = shippingStateSelect.value;
  
  //  Validation
  if (!validateCheckoutForm()) {
    alert("Please fill in all required fields correctly");
    return;
  }

  const { subtotal, shippingFee, total } = calculateCartTotal();
  
  // Generate unique reference
  const reference = `FH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Show initial loading state
  showPaymentStatus('initializing', 'Initializing payment...');

  // Configure Paystack
  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: customerEmail,
    amount: total, // Already in kobo
    currency: 'NGN',
    ref: reference,
    metadata: {
      custom_fields: [
        {
          display_name: "Customer Name",
          variable_name: "customer_name",
          value: customerName
        },
        {
          display_name: "Customer Phone",
          variable_name: "customer_phone",
          value: customerPhone
        },
        {
          display_name: "Shipping State",
          variable_name: "shipping_state",
          value: shippingState
        },
        {
          display_name: "Cart Items",
          variable_name: "cart_items",
          value: JSON.stringify(cart)
        }
      ]
    },
    callback: function(response) {
      console.log('✅ Paystack payment successful:', response);
      // START VERIFICATION PROCESS WITH LOADING STATE
      verifyPaymentWithLoading(response.reference, customerEmail);
    },
    onClose: function() {
      console.log('❌ Payment window closed');
      hidePaymentStatus();
      alert('Payment cancelled. Please try again if you wish to complete your order.');
    }
  });

  // Open Paystack popup
  handler.openIframe();
}

// ========================================
// VERIFY PAYMENT WITH PROGRESS UPDATES
// ========================================
async function verifyPaymentWithLoading(reference, email) {
  try {
    // Show "Verifying..." message
    showPaymentStatus('verifying', 
      'Please wait while we verify your payment...',
      'This usually takes 30-60 seconds. Please do not close this page.'
    );

    // Add timeout with progress updates
    let progressPercent = 0;
    const progressInterval = setInterval(() => {
      progressPercent += 5;
      if (progressPercent >= 95) {
        clearInterval(progressInterval);
      }
      updateProgressBar(progressPercent);
    }, 500);

    // Call backend to verify payment
    const response = await fetch(
      `${API_BASE_URL}/api/payment/verify?reference=${reference}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    clearInterval(progressInterval);

    const data = await response.json();
    console.log('Verification response:', data);

    if (data.success) {
      // Payment verified successfully
      updateProgressBar(100);
      
      setTimeout(() => {
        showPaymentStatus('success', 
          'Payment Successful! 🎉',
          `Thank you for your purchase! A confirmation email has been sent to ${email}.`,
          true // Show success state
        );

        // Clear cart after 3 seconds and close modal
        setTimeout(() => {
          cart = [];
          localStorage.setItem('cart', JSON.stringify(cart));
          updateCartUI();
          hidePaymentStatus();
          closeCartModal();
          
          // Show final success message
          alert(`✅ Payment Successful!\\n\\nAmount: ₦${(data.data.amount).toLocaleString('en-NG')}\\nReference: ${data.data.reference}\\n\\nCheck your email for details.`);
        }, 3000);
      }, 500);

    } else {
      // Verification failed
      clearInterval(progressInterval);
      showPaymentStatus('error', 
        'Payment Verification Failed',
        data.message || 'We could not verify your payment. Please contact support with your reference number.',
        false,
        reference
      );
    }

  } catch (error) {
    console.error('❌ Verification error:', error);
    showPaymentStatus('error', 
      'Connection Error',
      'Unable to verify payment. Please check your internet connection and try again.',
      false,
      reference
    );
  }
}

// ========================================
// PAYMENT STATUS OVERLAY UI
// ========================================
function showPaymentStatus(type, title, message = '', isSuccess = false, reference = '') {
  // Remove existing overlay if any
  hidePaymentStatus();

  const overlay = document.createElement('div');
  overlay.id = 'paymentStatusOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    animation: fadeIn 0.3s ease;
  `;

  let iconHTML = '';
  let progressHTML = '';
  let actionsHTML = '';

  if (type === 'initializing') {
    iconHTML = `
      <div class="payment-spinner"></div>
    `;
  } else if (type === 'verifying') {
    iconHTML = `
      <div class="payment-spinner"></div>
    `;
    progressHTML = `
      <div class="progress-container">
        <div class="progress-bar" id="verificationProgressBar">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
        <div class="progress-text" id="progressText">0%</div>
      </div>
    `;
  } else if (type === 'success') {
    iconHTML = `
      <div class="success-checkmark">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#10b981" stroke-width="2" fill="none"/>
          <path d="M7 12l3 3 7-7" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `;
  } else if (type === 'error') {
    iconHTML = `
      <div class="error-icon">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#ef4444" stroke-width="2" fill="none"/>
          <path d="M15 9l-6 6m0-6l6 6" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    `;
    actionsHTML = `
      <div class="payment-actions">
        ${reference ? `<p style="font-size: 12px; color: #999; margin-bottom: 15px;">Reference: ${reference}</p>` : ''}
        <button onclick="hidePaymentStatus()" class="payment-btn">Close</button>
      </div>
    `;
  }

  overlay.innerHTML = `
    <div class="payment-status-card">
      ${iconHTML}
      <h2 class="payment-status-title">${title}</h2>
      ${message ? `<p class="payment-status-message">${message}</p>` : ''}
      ${progressHTML}
      ${actionsHTML}
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes scaleIn {
      from { transform: scale(0.5); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .payment-status-card {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 90%;
      text-align: center;
      animation: scaleIn 0.3s ease;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }

    .payment-spinner {
      width: 80px;
      height: 80px;
      border: 6px solid #f3f3f3;
      border-top: 6px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 30px;
    }

    .success-checkmark svg,
    .error-icon svg {
      margin: 0 auto 20px;
      animation: scaleIn 0.5s ease;
    }

    .payment-status-title {
      font-size: 24px;
      color: #333;
      margin-bottom: 15px;
      font-weight: 700;
    }

    .payment-status-message {
      font-size: 16px;
      color: #666;
      line-height: 1.6;
      margin-bottom: 20px;
    }

    .progress-container {
      margin: 30px 0;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e0e0e0;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 10px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      transition: width 0.5s ease;
      border-radius: 10px;
    }

    .progress-text {
      font-size: 14px;
      color: #667eea;
      font-weight: 600;
    }

    .payment-actions {
      margin-top: 30px;
    }

    .payment-btn {
      padding: 12px 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }

    .payment-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }

    @media (max-width: 600px) {
      .payment-status-card {
        padding: 30px 20px;
      }

      .payment-status-title {
        font-size: 20px;
      }

      .payment-status-message {
        font-size: 14px;
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);
}

function hidePaymentStatus() {
  const overlay = document.getElementById('paymentStatusOverlay');
  if (overlay) {
    overlay.remove();
  }
}

function updateProgressBar(percent) {
  const progressFill = document.querySelector('.progress-fill');
  const progressText = document.getElementById('progressText');
  
  if (progressFill) {
    progressFill.style.width = `${percent}%`;
  }
  
  if (progressText) {
    progressText.textContent = `${Math.round(percent)}%`;
  }
}

// ========================================
// VALIDATION HELPER
// ========================================
function validateCheckoutForm() {
  let isValid = true;

  // Name validation
  if (!customerNameInput.value.trim()) {
    nameError.textContent = "Name is required";
    nameError.style.display = "block";
    isValid = false;
  } else {
    nameError.style.display = "none";
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customerEmailInput.value.trim())) {
    emailError.textContent = "Valid email is required";
    emailError.style.display = "block";
    isValid = false;
  } else {
    emailError.style.display = "none";
  }

  // Phone validation
  if (!customerPhoneInput.value.trim()) {
    phoneError.textContent = "Phone number is required";
    phoneError.style.display = "block";
    isValid = false;
  } else {
    phoneError.style.display = "none";
  }

  return isValid;
}

// ========================================
// EXPORT FUNCTION TO CALL
// ========================================
// Add this at the end of your existing script.js
// Replace your existing checkout button handler with:

if (checkoutButton) {
  checkoutButton.addEventListener('click', initializePayment);
}

console.log('✅ Enhanced payment verification loaded');

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
