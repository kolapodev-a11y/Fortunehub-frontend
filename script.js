/**
 * FortuneHub — script.js  (FIXED VERSION)
 * ─────────────────────────────────────────────────────────
 * Fixes applied:
 *  1. Zoom / magnification re-initialises every time a product
 *     modal opens (works for BOTH json products & DB products).
 *  2. Products are fetched from the backend API FIRST; the local
 *     products.json acts as a fallback / seed so the page always
 *     renders something.
 *  3. All cart / checkout / Paystack logic preserved intact.
 * ─────────────────────────────────────────────────────────
 */

'use strict';

// ═══════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════
const BACKEND_URL = 'https://fortunehub-backend.onrender.com';

// Paystack public key  (keep in env ideally, but safe on front-end)
const PAYSTACK_PUBLIC_KEY = 'pk_live_1f7e9c5f59dc9d1d5e6a6d7d45e58a9f19c4b3e2'; // ← your key

// Shipping fees keyed by state value (must match the <select> option values in index.html)
const SHIPPING_FEES = {
  '1500': 1500,
  '2000': 2000,
  '3000': 3000,
};

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
let allProducts    = [];   // merged list (JSON + DB)
let cart           = JSON.parse(localStorage.getItem('fortunehub_cart') || '[]');
let currentProduct = null; // product open in detail modal
let zoomActive     = false;

// ═══════════════════════════════════════════════════════════
// DOM HELPERS
// ═══════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);

// ═══════════════════════════════════════════════════════════
// FORMAT PRICE  (kobo → ₦)
// ═══════════════════════════════════════════════════════════
function formatPrice(kobo) {
  const naira = kobo / 100;
  return '₦' + naira.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ═══════════════════════════════════════════════════════════
// FETCH PRODUCTS  (API first, JSON fallback)
// ═══════════════════════════════════════════════════════════
async function fetchProducts() {
  let dbProducts  = [];
  let jsonProducts = [];

  // 1) Try backend API
  try {
    const res  = await fetch(`${BACKEND_URL}/api/products`);
    const data = await res.json();
    if (data.success && Array.isArray(data.data)) {
      dbProducts = data.data;
    }
  } catch (e) {
    console.warn('Backend API unavailable; using JSON only.', e.message);
  }

  // 2) Try local JSON (fallback / static seed)
  try {
    const res  = await fetch('products.json');
    const data = await res.json();
    if (Array.isArray(data)) jsonProducts = data;
  } catch (e) {
    console.warn('products.json not found or invalid.', e.message);
  }

  // 3) Merge: DB products first, then JSON products that don't conflict
  //    DB products take precedence (they may override JSON ones).
  const dbNames = new Set(dbProducts.map(p => p.name.toLowerCase()));
  const uniqueJson = jsonProducts.filter(p => !dbNames.has(p.name.toLowerCase()));

  allProducts = [...dbProducts, ...uniqueJson];
  return allProducts;
}

// ═══════════════════════════════════════════════════════════
// RENDER PRODUCT CARD
// ═══════════════════════════════════════════════════════════
function getImageSrc(product) {
  // DB products store base64 directly; JSON products use a file path
  if (!product.image) return 'images/placeholder.jpg';
  if (product.image.startsWith('data:') || product.image.startsWith('http')) {
    return product.image;
  }
  return product.image; // relative path like images/product1.jpg
}

function renderProductCard(product) {
  const imgSrc   = getImageSrc(product);
  const price    = formatPrice(product.price);
  const badgeMap = { new: 'NEW', sale: 'SALE', featured: 'HOT' };
  const badge    = badgeMap[product.tag] || '';
  const soldBadge    = product.sold      ? '<span class="badge badge-sold">SOLD</span>'      : '';
  const stockBadge   = product.outOfStock ? '<span class="badge badge-stock">OUT OF STOCK</span>' : '';
  const tagBadgeHtml = badge && !product.sold && !product.outOfStock
    ? `<span class="badge badge-${product.tag}">${badge}</span>` : '';

  const addCartBtn = product.outOfStock || product.sold
    ? `<button class="btn btn-add-to-cart" disabled style="opacity:.5;cursor:not-allowed;">
         <i class="fas fa-cart-plus"></i> ${product.sold ? 'Sold' : 'Out of Stock'}
       </button>`
    : `<button class="btn btn-add-to-cart" onclick="addToCart('${product.id || product._id}')">
         <i class="fas fa-cart-plus"></i> Add to Cart
       </button>`;

  const buyNowBtn = product.outOfStock || product.sold
    ? `<button class="btn btn-buy-now" disabled style="opacity:.5;cursor:not-allowed;">
         <i class="fas fa-bolt"></i> Buy Now
       </button>`
    : `<button class="btn btn-buy-now" onclick="buyNow('${product.id || product._id}')">
         <i class="fas fa-bolt"></i> Buy Now
       </button>`;

  return `
    <div class="product-card" data-category="${product.category}" data-id="${product.id || product._id}">
      <div class="product-img-wrapper" onclick="openProductDetail('${product.id || product._id}')">
        <img src="${imgSrc}" alt="${product.name}" class="product-img" loading="lazy"
             onerror="this.src='images/placeholder.jpg'">
        ${tagBadgeHtml}${soldBadge}${stockBadge}
      </div>
      <div class="product-info">
        <span class="product-category">${product.category}</span>
        <h3 class="product-name">${product.name}</h3>
        <p class="product-desc">${(product.description || '').substring(0, 80)}${product.description && product.description.length > 80 ? '…' : ''}</p>
        <div class="product-price">${price}</div>
        <div class="product-actions">
          ${addCartBtn}
          ${buyNowBtn}
        </div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// RENDER ALL PRODUCTS  (with optional category filter)
// ═══════════════════════════════════════════════════════════
function renderProducts(filterCategory = 'all', searchTerm = '') {
  const grid = $('productsGrid');
  if (!grid) return;

  let list = [...allProducts];

  if (filterCategory !== 'all') {
    list = list.filter(p => p.category === filterCategory);
  }

  if (searchTerm.trim()) {
    const q = searchTerm.trim().toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  if (!list.length) {
    grid.innerHTML = '<p class="no-products">No products found.</p>';
    return;
  }

  grid.innerHTML = list.map(renderProductCard).join('');
}

// ═══════════════════════════════════════════════════════════
// CATEGORY FILTER BUTTONS
// ═══════════════════════════════════════════════════════════
function initFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      renderProducts(btn.dataset.category, ($('searchInput') || {}).value || '');
    });
  });

  // Category cards
  document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.dataset.category;
      document.querySelectorAll('.filter-btn').forEach(b => {
        const active = b.dataset.category === cat;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      renderProducts(cat);
      document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// ═══════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════
function initSearch() {
  const input = $('searchInput');
  const icon  = $('searchIcon');
  const container = $('search-container');

  if (icon && container) {
    icon.addEventListener('click', () => {
      container.classList.toggle('active');
      if (container.classList.contains('active')) input?.focus();
    });
  }

  if (input) {
    input.addEventListener('input', () => {
      const activeBtn = document.querySelector('.filter-btn.active');
      renderProducts(activeBtn ? activeBtn.dataset.category : 'all', input.value);
    });
  }
}

// ═══════════════════════════════════════════════════════════
// PRODUCT DETAIL MODAL
// ═══════════════════════════════════════════════════════════
function openProductDetail(productId) {
  const product = allProducts.find(
    p => String(p.id) === String(productId) || String(p._id) === String(productId)
  );
  if (!product) return;

  currentProduct = product;

  // Populate fields
  const imgSrc = getImageSrc(product);
  $('detailMainImage').src = imgSrc;
  $('detailMainImage').alt = product.name;
  $('detailTitle').textContent = product.name;
  $('detailCategory').textContent = product.category.toUpperCase();
  $('detailPrice').textContent = formatPrice(product.price);
  $('detailDescription').textContent = product.description || '';

  // Badge
  const badge = $('detailBadge');
  badge.textContent = '';
  badge.className = 'detail-badge';
  if (product.tag && product.tag !== 'none') {
    badge.textContent = product.tag.toUpperCase();
    badge.classList.add(`badge-${product.tag}`);
  }

  // Specifications
  const specsList = $('detailSpecsList');
  specsList.innerHTML = `
    <li><strong>Category:</strong> ${product.category}</li>
    <li><strong>Availability:</strong> ${product.outOfStock ? 'Out of Stock' : product.sold ? 'Sold' : 'In Stock'}</li>
    <li><strong>Price:</strong> ${formatPrice(product.price)}</li>
  `;

  // Thumbnails
  const thumbsContainer = $('detailThumbnails');
  const images = Array.isArray(product.images) && product.images.length
    ? product.images
    : [imgSrc];

  thumbsContainer.innerHTML = images.map((img, i) => {
    const src = (img && (img.startsWith('data:') || img.startsWith('http') || img.startsWith('images/')))
      ? img : imgSrc;
    return `<img src="${src}" alt="Thumbnail ${i+1}" class="thumb-img ${i === 0 ? 'active' : ''}"
              onclick="switchMainImage(this, '${src}')"
              onerror="this.src='images/placeholder.jpg'">`;
  }).join('');

  // Buttons
  const addCartBtn = $('detailAddCart');
  const buyNowBtn  = $('detailBuyNow');
  const disabled   = product.outOfStock || product.sold;

  addCartBtn.disabled = disabled;
  buyNowBtn.disabled  = disabled;
  addCartBtn.onclick  = disabled ? null : () => { addToCart(productId); closeDetailModal(); };
  buyNowBtn.onclick   = disabled ? null : () => { buyNow(productId); };

  // Show modal
  const modal = $('productDetailModal');
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // ── FIX 1: Re-initialise zoom every time the modal opens ──
  initZoom();
}

function switchMainImage(thumbEl, src) {
  document.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
  thumbEl.classList.add('active');
  const mainImg = $('detailMainImage');
  mainImg.src = src;

  // Re-attach zoom to new image source
  initZoom();
}

function closeDetailModal() {
  const modal = $('productDetailModal');
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  disableZoom();
}

// ═══════════════════════════════════════════════════════════
// ZOOM / MAGNIFICATION  ── FIX: Fully re-initialised on open
// ═══════════════════════════════════════════════════════════
function initZoom() {
  const img    = $('detailMainImage');
  const lens   = $('zoomLens');
  const result = $('zoomResult');
  const toggle = $('zoomToggle');

  if (!img || !lens || !result) return;

  // Remove old listeners by replacing elements
  const newLens = lens.cloneNode(true);
  lens.parentNode.replaceChild(newLens, lens);

  // Wait for image to fully load
  function setupZoomHandlers() {
    const cx = result.offsetWidth  / newLens.offsetWidth;
    const cy = result.offsetHeight / newLens.offsetHeight;

    result.style.backgroundImage  = `url('${img.src}')`;
    result.style.backgroundSize   = `${img.width * cx}px ${img.height * cy}px`;
    result.style.backgroundRepeat = 'no-repeat';

    function moveLens(e) {
      if (!zoomActive) return;
      e.preventDefault();
      const pos = getCursorPos(e, img);
      let lx = pos.x - newLens.offsetWidth  / 2;
      let ly = pos.y - newLens.offsetHeight / 2;

      lx = Math.max(0, Math.min(lx, img.width  - newLens.offsetWidth));
      ly = Math.max(0, Math.min(ly, img.height - newLens.offsetHeight));

      newLens.style.left = lx + 'px';
      newLens.style.top  = ly + 'px';
      result.style.backgroundPosition = `-${lx * cx}px -${ly * cy}px`;
    }

    newLens.addEventListener('mousemove',  moveLens);
    newLens.addEventListener('touchmove',  moveLens, { passive: false });
    img.addEventListener('mousemove',      moveLens);
    img.addEventListener('touchmove',      moveLens, { passive: false });
  }

  if (img.complete && img.naturalWidth) {
    setupZoomHandlers();
  } else {
    img.onload = setupZoomHandlers;
  }

  // Toggle button
  if (toggle) {
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);
    newToggle.addEventListener('click', () => {
      zoomActive = !zoomActive;
      newLens.style.display   = zoomActive ? 'block' : 'none';
      result.style.display    = zoomActive ? 'block' : 'none';
      newToggle.innerHTML = zoomActive
        ? '<i class="fas fa-search-minus"></i>'
        : '<i class="fas fa-search-plus"></i>';
      newToggle.title = zoomActive ? 'Disable Zoom' : 'Enable Zoom';
    });
  }

  // Reset zoom state on new image
  zoomActive = false;
  newLens.style.display  = 'none';
  result.style.display   = 'none';
}

function disableZoom() {
  zoomActive = false;
  const lens   = $('zoomLens');
  const result = $('zoomResult');
  const toggle = $('zoomToggle');
  if (lens)   lens.style.display   = 'none';
  if (result) result.style.display = 'none';
  if (toggle) toggle.innerHTML = '<i class="fas fa-search-plus"></i>';
}

function getCursorPos(e, img) {
  const rect = img.getBoundingClientRect();
  let clientX, clientY;
  if (e.touches && e.touches[0]) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

// ═══════════════════════════════════════════════════════════
// CART
// ═══════════════════════════════════════════════════════════
function saveCart() {
  localStorage.setItem('fortunehub_cart', JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const total = cart.reduce((sum, item) => sum + item.qty, 0);
  const el = $('cartCount');
  if (el) el.textContent = total;
}

function addToCart(productId) {
  const product = allProducts.find(
    p => String(p.id) === String(productId) || String(p._id) === String(productId)
  );
  if (!product) return;

  const existing = cart.find(item => item.id === String(productId));
  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      id:    String(productId),
      name:  product.name,
      price: product.price,
      image: getImageSrc(product),
      qty:   1
    });
  }
  saveCart();
  showToast(`${product.name} added to cart!`);
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== String(productId));
  saveCart();
  renderCart();
}

function updateQty(productId, delta) {
  const item = cart.find(i => i.id === String(productId));
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
  renderCart();
}

function renderCart() {
  const container = $('cartItems');
  if (!container) return;

  if (!cart.length) {
    container.innerHTML = '<p class="empty-cart">Your cart is empty.</p>';
    updateTotals();
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <img src="${item.image}" alt="${item.name}" class="cart-img"
           onerror="this.src='images/placeholder.jpg'">
      <div class="cart-item-info">
        <p class="cart-item-name">${item.name}</p>
        <p class="cart-item-price">${formatPrice(item.price)}</p>
        <div class="cart-qty-controls">
          <button onclick="updateQty('${item.id}', -1)">−</button>
          <span>${item.qty}</span>
          <button onclick="updateQty('${item.id}', +1)">+</button>
        </div>
      </div>
      <button class="cart-remove" onclick="removeFromCart('${item.id}')" title="Remove">
        <i class="fas fa-trash"></i>
      </button>
    </div>`).join('');

  updateTotals();
}

function updateTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const state    = $('shippingState')?.value || '';
  const shipping = SHIPPING_FEES[state] ? SHIPPING_FEES[state] * 100 : 0;
  const total    = subtotal + shipping;

  const fmt = v => '₦' + (v / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  const sub = $('cartSubTotal');
  const shi = $('shippingFeeAmount');
  const tot = $('cartTotal');
  if (sub) sub.textContent = fmt(subtotal);
  if (shi) shi.textContent = fmt(shipping);
  if (tot) tot.textContent = fmt(total);
}

function buyNow(productId) {
  addToCart(productId);
  openCartModal();
}

// ═══════════════════════════════════════════════════════════
// CART MODAL
// ═══════════════════════════════════════════════════════════
function openCartModal() {
  renderCart();
  const modal = $('cartModal');
  if (modal) {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
}

function closeCartModal() {
  const modal = $('cartModal');
  if (modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}

// ═══════════════════════════════════════════════════════════
// CHECKOUT / PAYSTACK
// ═══════════════════════════════════════════════════════════
function validateForm() {
  let valid = true;

  const name  = $('customerName')?.value.trim()  || '';
  const email = $('customerEmail')?.value.trim() || '';
  const phone = $('customerPhone')?.value.trim() || '';
  const state = $('shippingState')?.value         || '';

  const setErr = (id, msg) => {
    const el = $(id);
    if (el) el.textContent = msg;
  };

  setErr('nameError',  '');
  setErr('emailError', '');
  setErr('phoneError', '');

  if (!name)  { setErr('nameError',  'Full name is required.');  valid = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setErr('emailError', 'Valid email is required.');
    valid = false;
  }
  if (!phone || phone.length < 10) {
    setErr('phoneError', 'Valid phone number is required.');
    valid = false;
  }
  if (!state) { showToast('Please select your shipping state.'); valid = false; }
  if (!cart.length) { showToast('Your cart is empty.'); valid = false; }

  return { valid, name, email, phone, state };
}

async function handleCheckout() {
  const { valid, name, email, phone, state } = validateForm();
  if (!valid) return;

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shipping = (SHIPPING_FEES[state] || 0) * 100;
  const total    = subtotal + shipping;

  const reference = 'FH_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9).toUpperCase();

  const metadata = {
    custom_fields: [
      { display_name: 'Customer Name',  variable_name: 'customer_name',  value: name  },
      { display_name: 'Phone Number',   variable_name: 'phone_number',   value: phone },
      { display_name: 'Shipping State', variable_name: 'shipping_state', value: state },
      {
        display_name: 'Order Items',
        variable_name: 'order_items',
        value: cart.map(i => `${i.name} x${i.qty}`).join(', ')
      }
    ],
    cart:           cart,
    shippingState:  state,
    shippingFee:    shipping / 100,
    customerName:   name,
    customerPhone:  phone
  };

  const handler = PaystackPop.setup({
    key:       PAYSTACK_PUBLIC_KEY,
    email,
    amount:    total,
    currency:  'NGN',
    ref:       reference,
    metadata,
    callback:  async result => {
      showToast('Payment successful! Verifying…');
      await verifyPayment(result.reference);
    },
    onClose: () => showToast('Payment window closed.')
  });

  handler.openIframe();
}

async function verifyPayment(reference) {
  try {
    const res  = await fetch(`${BACKEND_URL}/api/payment/verify?reference=${reference}`);
    const data = await res.json();

    if (data.success) {
      showToast('✅ Payment verified! Confirmation email sent.');
      cart = [];
      saveCart();
      closeCartModal();
    } else {
      showToast('Payment verification failed. Contact support.');
    }
  } catch (err) {
    console.error('Verify error:', err);
    showToast('Could not verify payment. Please contact support.');
  }
}

// ═══════════════════════════════════════════════════════════
// TOAST NOTIFICATION
// ═══════════════════════════════════════════════════════════
function showToast(message, duration = 3500) {
  let toast = document.querySelector('.toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast-notification';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), duration);
}

// ═══════════════════════════════════════════════════════════
// MODAL CLOSE ON BACKDROP CLICK / ESC KEY
// ═══════════════════════════════════════════════════════════
function initModalClosers() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeDetailModal();
      closeCartModal();
    }
  });

  $('productDetailModal')?.addEventListener('click', e => {
    if (e.target === $('productDetailModal')) closeDetailModal();
  });

  $('cartModal')?.addEventListener('click', e => {
    if (e.target === $('cartModal')) closeCartModal();
  });

  $('closeProductModal')?.addEventListener('click', closeDetailModal);
  $('closeCartModal')?.addEventListener('click',   closeCartModal);

  $('cartIcon')?.addEventListener('click', openCartModal);

  $('continueShoppingButton')?.addEventListener('click', closeCartModal);

  $('checkoutButton')?.addEventListener('click', handleCheckout);

  $('shippingState')?.addEventListener('change', updateTotals);

  $('footerOpenCart')?.addEventListener('click', e => {
    e.preventDefault();
    openCartModal();
  });
}

// ═══════════════════════════════════════════════════════════
// INITIALISE
// ═══════════════════════════════════════════════════════════
async function init() {
  updateCartCount();
  initModalClosers();
  initFilters();
  initSearch();

  // Show skeleton / loading state
  const grid = $('productsGrid');
  if (grid) grid.innerHTML = '<p class="loading-products">Loading products…</p>';

  await fetchProducts();
  renderProducts();
}

document.addEventListener('DOMContentLoaded', init);
