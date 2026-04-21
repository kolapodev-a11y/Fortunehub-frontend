// =====================================================================
// FortuneHub Frontend Script  v5 — Google Auth + Email/Password Auth
//
// ✅ NEW in v5:
//    • Google Sign-In via Google Identity Services (GIS)
//    • Email / Password Sign-Up & Sign-In
//    • JWT stored in localStorage — session persists across refreshes
//    • When logged in: Name + Email auto-filled from profile
//    • Cart only asks Phone (WhatsApp) + Shipping State for logged-in users
//    • Transaction History modal (fetched from backend)
//    • Receipt modal with printable HTML
//    • User avatar dropdown in header
//
// ✅ ALL v4 LOGIC PRESERVED:
//    • Cold-start retry logic, warm-up ping
//    • Manual Opay transfer instructions
//    • Image zoom, product detail modal
//    • Search, filter, category cards
//    • Cart localStorage, quantity controls
// =====================================================================

// ─────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────
// ✅ Replace with YOUR Google OAuth Client ID from console.cloud.google.com
// Set this to the same GOOGLE_CLIENT_ID used in the backend .env
const GOOGLE_CLIENT_ID = '694580886466-hu48nsmlesv8qojnpkm218t0i7gpjepl.apps.googleusercontent.com';

const API_BASE_URL = 'https://fortunehub-backend.onrender.com';

let paymentConfig = null;

const PER_ATTEMPT_TIMEOUT_MS = 10000;
const MAX_RETRIES             = 5;
const RETRY_DELAYS            = [5000, 8000, 12000, 18000, 25000];

// ─────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────
let products = [];
let cart = (() => {
  const saved = JSON.parse(localStorage.getItem('cart')) || [];
  return saved.map(item => {
    let mapped = item;
    if (item.price && item.price > 10000) mapped = { ...item, price: Math.round(item.price / 100) };
    return mapped;
  });
})();

let currentProduct = null;
let zoomEnabled    = false;

let currentOrderFlow = null;

// ─────────────────────────────────────────────────────────────────────
// ✅ AUTH STATE
// ─────────────────────────────────────────────────────────────────────
let currentUser = null; // { id, name, email, picture, phone, token, authProvider }

function loadAuthState() {
  try {
    const stored = localStorage.getItem('fh_auth');
    if (stored) currentUser = JSON.parse(stored);
  } catch { currentUser = null; }
}

function saveAuthState(user) {
  currentUser = user;
  if (user) localStorage.setItem('fh_auth', JSON.stringify(user));
  else localStorage.removeItem('fh_auth');
  updateAuthUI();
}

function getAuthToken() {
  return currentUser?.token || null;
}

function authHeaders() {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ─────────────────────────────────────────────────────────────────────
// DOM REFS
// ─────────────────────────────────────────────────────────────────────
const productsGrid             = document.getElementById('productsGrid');
const cartCount                = document.getElementById('cartCount');
const cartModal                = document.getElementById('cartModal');
const closeModal               = document.getElementById('closeCartModal');
const cartItemsContainer       = document.getElementById('cartItems');
const cartTotalElement         = document.getElementById('cartTotal');
const cartSubTotalElement      = document.getElementById('cartSubTotal');
const shippingFeeAmountElement = document.getElementById('shippingFeeAmount');
const checkoutButton           = document.getElementById('checkoutButton');
const continueShoppingButton   = document.getElementById('continueShoppingButton');
const filterButtons            = document.querySelectorAll('.filter-btn');
const searchInput              = document.getElementById('searchInput');
const categoryCards            = document.querySelectorAll('.category-card');
const cartIcon                 = document.getElementById('cartIcon');
const searchIconBtn            = document.getElementById('searchIcon');
const footerOpenCart           = document.getElementById('footerOpenCart');

// Cart form fields
const customerNameInput        = document.getElementById('customerName');
const customerEmailInput       = document.getElementById('customerEmail');
const customerPhoneInput       = document.getElementById('customerPhone');
const shippingStateSelect      = document.getElementById('shippingState');
const nameError                = document.getElementById('nameError');
const emailError               = document.getElementById('emailError');
const phoneError               = document.getElementById('phoneError');

// Auth UI elements
const headerSignInBtn          = document.getElementById('headerSignInBtn');
const userAvatarWrap           = document.getElementById('userAvatarWrap');
const userAvatarBtn            = document.getElementById('userAvatarBtn');
const userAvatarImg            = document.getElementById('userAvatarImg');
const userAvatarInitial        = document.getElementById('userAvatarInitial');
const userDropdown             = document.getElementById('userDropdown');
const dropdownUserName         = document.getElementById('dropdownUserName');
const dropdownUserEmail        = document.getElementById('dropdownUserEmail');
const viewHistoryBtn           = document.getElementById('viewHistoryBtn');
const signOutBtn               = document.getElementById('signOutBtn');

// Auth modal
const authModal                = document.getElementById('authModal');
const closeAuthModal           = document.getElementById('closeAuthModal');
const tabSignIn                = document.getElementById('tabSignIn');
const tabSignUp                = document.getElementById('tabSignUp');
const signInForm               = document.getElementById('signInForm');
const signUpForm               = document.getElementById('signUpForm');

// Cart auth elements
const authUserBanner           = document.getElementById('authUserBanner');
const guestFields              = document.getElementById('guestFields');
const bannerAvatar             = document.getElementById('bannerAvatar');
const bannerName               = document.getElementById('bannerName');
const bannerEmail              = document.getElementById('bannerEmail');
const changeAccountBtn         = document.getElementById('changeAccountBtn');
const cartSignInPromptBtn      = document.getElementById('cartSignInPromptBtn');

// Order history modal
const orderHistoryModal        = document.getElementById('orderHistoryModal');
const closeOrderHistoryModal   = document.getElementById('closeOrderHistoryModal');
const orderHistoryList         = document.getElementById('orderHistoryList');

// Receipt modal
const receiptModal             = document.getElementById('receiptModal');
const closeReceiptModal        = document.getElementById('closeReceiptModal');
const receiptContent           = document.getElementById('receiptContent');

// Payment instructions modal
const paymentInstructionsModal      = document.getElementById('paymentInstructionsModal');
const closePaymentInstructionsModal = document.getElementById('closePaymentInstructionsModal');
const paymentInstructionsContent    = document.getElementById('paymentInstructionsContent');

// Product detail modal
const productDetailModal = document.getElementById('productDetailModal');
const closeProductModal  = document.getElementById('closeProductModal');
const detailMainImage    = document.getElementById('detailMainImage');
const detailThumbnails   = document.getElementById('detailThumbnails');
const detailCategory     = document.getElementById('detailCategory');
const detailTitle        = document.getElementById('detailTitle');
const detailPrice        = document.getElementById('detailPrice');
const detailBadge        = document.getElementById('detailBadge');
const detailDescription  = document.getElementById('detailDescription');
const detailSpecsList    = document.getElementById('detailSpecsList');
const detailAddCart      = document.getElementById('detailAddCart');
const detailBuyNow       = document.getElementById('detailBuyNow');
const zoomToggle         = document.getElementById('zoomToggle');
const zoomLens           = document.getElementById('zoomLens');
const zoomResult         = document.getElementById('zoomResult');

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────
function formatCurrency(n) {
  return `₦${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function getStatusMeta(status) {
  const map = {
    pending_payment: { label: 'Pending Payment', className: 'pending-payment', hint: 'Transfer still needed' },
    awaiting_verification: { label: 'Awaiting Verification', className: 'awaiting-verification', hint: 'Proof uploaded' },
    paid: { label: 'Paid', className: 'paid', hint: 'Verified by admin' },
    failed: { label: 'Failed', className: 'failed', hint: 'Please contact support' },
    cancelled: { label: 'Cancelled', className: 'cancelled', hint: 'Order closed' }
  };
  return map[status] || { label: status || 'Unknown', className: 'pending-payment', hint: '' };
}
function buildWhatsAppLink(orderRef) {
  const raw = String(paymentConfig?.whatsappHelpNumber || paymentConfig?.accountNumber || paymentConfig?.opayAccountPhone || '').replace(/\D/g, '');
  if (!raw) return '';
  const message = encodeURIComponent(`Hello FortuneHub, I need help with order ${orderRef}.`);
  return `https://wa.me/${raw}?text=${message}`;
}
function getPaymentAccountNumber() {
  return paymentConfig?.accountNumber || paymentConfig?.opayAccountPhone || '';
}
function getPaymentAccountName() {
  return paymentConfig?.accountName || paymentConfig?.opayAccountName || 'FortuneHub';
}
function getPaymentBankName() {
  return paymentConfig?.bankName || 'OPay';
}
async function copyText(value, label = 'text') {
  if (!value) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const temp = document.createElement('textarea');
      temp.value = value;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      temp.remove();
    }
    showToast(`${label} copied`, 'success');
  } catch (_) {
    showToast(`Could not copy ${label}`, 'error');
  }
}
function renderTimeline(order) {
  const done = new Set((order.statusTimeline || []).map(step => step.status));
  const steps = [
    { key: 'pending_payment', label: 'Order created' },
    { key: 'awaiting_verification', label: 'Proof uploaded' },
    { key: 'paid', label: 'Payment verified' }
  ];
  return `<div class="timeline-list">${steps.map(step => {
    const active = done.has(step.key) || step.key === 'pending_payment';
    return `<div class="timeline-step ${active ? 'is-complete' : ''}">
      <span class="timeline-dot"></span>
      <div>
        <strong>${step.label}</strong>
        <small>${active ? 'Completed' : 'Waiting'}</small>
      </div>
    </div>`;
  }).join('')}</div>`;
}
function getProductById(id) { return products.find(p => String(p.id) === String(id)); }
function getProductsJsonUrl() { return new URL('products.json', window.location.href).toString(); }
function getRepoBaseUrl() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const repoName = parts.length ? parts[0] : '';
  return `${window.location.origin}/${repoName}/`;
}
function resolveAssetUrl(path) {
  if (!path) return '';
  if (/^(https?:|data:)/i.test(path)) return path;
  if (path.startsWith('/')) return `${window.location.origin}${path}`;
  return new URL(path, getRepoBaseUrl()).toString();
}
function getProductImage(product) {
  if (!product) return '';
  const galleryImage = Array.isArray(product.images) ? product.images.find(Boolean) : '';
  return String(product.image || galleryImage || '').trim();
}
function getOrderItemImage(item) {
  const directImage = String(item?.image || '').trim();
  if (directImage) return resolveAssetUrl(directImage);

  const rawProductId = String(item?.productId || item?.id || '').replace(/^db_/, '');
  const normalizedName = String(item?.name || '').trim().toLowerCase();
  const productMatch = products.find((product) => {
    const productDbId = String(product?._id || product?.id || '').replace(/^db_/, '');
    if (rawProductId && productDbId && productDbId === rawProductId) return true;
    return normalizedName && String(product?.name || '').trim().toLowerCase() === normalizedName;
  });

  const fallbackImage = getProductImage(productMatch);
  return fallbackImage ? resolveAssetUrl(fallbackImage) : '';
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getInitial(name) { return (name || 'U').charAt(0).toUpperCase(); }

// ─────────────────────────────────────────────────────────────────────
// ✅ AUTH UI UPDATE
// ─────────────────────────────────────────────────────────────────────
function updateAuthUI() {
  if (currentUser) {
    // Header — show avatar, hide sign-in button
    if (headerSignInBtn)  headerSignInBtn.style.display  = 'none';
    if (userAvatarWrap)   userAvatarWrap.style.display   = 'flex';

    if (dropdownUserName)  dropdownUserName.textContent  = currentUser.name  || '';
    if (dropdownUserEmail) dropdownUserEmail.textContent = currentUser.email || '';

    // Avatar image or initial
    if (currentUser.picture) {
      if (userAvatarImg)     { userAvatarImg.src = currentUser.picture; userAvatarImg.style.display = 'block'; }
      if (userAvatarInitial)   userAvatarInitial.style.display = 'none';
    } else {
      if (userAvatarImg)       userAvatarImg.style.display = 'none';
      if (userAvatarInitial) { userAvatarInitial.textContent = getInitial(currentUser.name); userAvatarInitial.style.display = 'flex'; }
    }

    // Cart — show banner, hide guest fields
    if (authUserBanner) {
      authUserBanner.style.display = 'flex';
      if (bannerName)  bannerName.textContent  = currentUser.name  || '';
      if (bannerEmail) bannerEmail.textContent = currentUser.email || '';
      if (bannerAvatar) {
        if (currentUser.picture) { bannerAvatar.src = currentUser.picture; bannerAvatar.style.display = 'block'; }
        else bannerAvatar.style.display = 'none';
      }
    }
    if (guestFields) guestFields.style.display = 'none';

    // Pre-fill phone if saved
    if (customerPhoneInput && currentUser.phone && !customerPhoneInput.value)
      customerPhoneInput.value = currentUser.phone;

  } else {
    // Logged out
    if (headerSignInBtn)  headerSignInBtn.style.display  = 'flex';
    if (userAvatarWrap)   userAvatarWrap.style.display   = 'none';
    if (authUserBanner)   authUserBanner.style.display   = 'none';
    if (guestFields)      guestFields.style.display      = 'block';
  }
}

// ─────────────────────────────────────────────────────────────────────
// ✅ GOOGLE IDENTITY SERVICES — initialise
// ─────────────────────────────────────────────────────────────────────
function initGoogleSignIn() {
  if (typeof google === 'undefined' || !google.accounts) return;
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE')) {
    console.warn('⚠️ GOOGLE_CLIENT_ID not configured. Update GOOGLE_CLIENT_ID in script.js and backend .env');
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback:  handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  // Render the sign-in button inside #googleSignInBtn
  const container = document.getElementById('googleSignInBtn');
  if (container) {
    google.accounts.id.renderButton(container, {
      theme: 'outline',
      size:  'large',
      width: '100%',
      text:  'continue_with',
      logo_alignment: 'left',
    });
  }
}

// Called by GIS with a credential (ID token)
async function handleGoogleCredential(response) {
  const credential = response?.credential;
  if (!credential) return;

  closeAuthModal_fn();
  showLoadingOverlay('Signing in with Google…');

  try {
    const res  = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ credential }),
    });
    const data = await res.json();
    hideLoadingOverlay();

    if (data.success) {
      saveAuthState({ ...data.user, token: data.token });
      showToast(`Welcome, ${data.user.name}! 👋`, 'success');
      updateCartUI();
    } else {
      showToast('Google sign-in failed: ' + (data.message || 'Unknown error'), 'error');
    }
  } catch (err) {
    hideLoadingOverlay();
    showToast('Network error during Google sign-in. Please try again.', 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────
// ✅ EMAIL / PASSWORD AUTH
// ─────────────────────────────────────────────────────────────────────
async function handleEmailSignIn(e) {
  e.preventDefault();
  const email    = document.getElementById('siEmail')?.value.trim() || '';
  const password = document.getElementById('siPassword')?.value || '';

  document.getElementById('siEmailError').textContent    = '';
  document.getElementById('siPasswordError').textContent = '';
  document.getElementById('siGeneralError').textContent  = '';

  let valid = true;
  if (!email)    { document.getElementById('siEmailError').textContent    = 'Email is required'; valid = false; }
  if (!password) { document.getElementById('siPasswordError').textContent = 'Password is required'; valid = false; }
  if (!valid) return;

  // Loading state
  document.getElementById('siSubmitText').style.display   = 'none';
  document.getElementById('siSubmitLoader').style.display = 'inline-flex';
  document.getElementById('siSubmitBtn').disabled         = true;

  try {
    const res  = await fetch(`${API_BASE_URL}/api/auth/signin`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (data.success) {
      closeAuthModal_fn();
      saveAuthState({ ...data.user, token: data.token });
      showToast(`Welcome back, ${data.user.name}! 👋`, 'success');
      updateCartUI();
    } else {
      document.getElementById('siGeneralError').textContent = data.message || 'Sign in failed';
    }
  } catch {
    document.getElementById('siGeneralError').textContent = 'Network error. Please try again.';
  } finally {
    document.getElementById('siSubmitText').style.display   = 'inline';
    document.getElementById('siSubmitLoader').style.display = 'none';
    document.getElementById('siSubmitBtn').disabled         = false;
  }
}

async function handleEmailSignUp(e) {
  e.preventDefault();
  const name     = document.getElementById('suName')?.value.trim()  || '';
  const email    = document.getElementById('suEmail')?.value.trim() || '';
  const password = document.getElementById('suPassword')?.value     || '';

  document.getElementById('suNameError').textContent     = '';
  document.getElementById('suEmailError').textContent    = '';
  document.getElementById('suPasswordError').textContent = '';
  document.getElementById('suGeneralError').textContent  = '';

  let valid = true;
  if (!name || name.length < 2)                     { document.getElementById('suNameError').textContent     = 'Enter your full name'; valid = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { document.getElementById('suEmailError').textContent    = 'Enter a valid email'; valid = false; }
  if (!password || password.length < 6)             { document.getElementById('suPasswordError').textContent = 'Password must be at least 6 characters'; valid = false; }
  if (!valid) return;

  document.getElementById('suSubmitText').style.display   = 'none';
  document.getElementById('suSubmitLoader').style.display = 'inline-flex';
  document.getElementById('suSubmitBtn').disabled         = true;

  try {
    const res  = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (data.success) {
      closeAuthModal_fn();
      saveAuthState({ ...data.user, token: data.token });
      showToast(`Account created! Welcome, ${data.user.name}! 🎉`, 'success');
      updateCartUI();
    } else {
      document.getElementById('suGeneralError').textContent = data.message || 'Sign up failed';
    }
  } catch {
    document.getElementById('suGeneralError').textContent = 'Network error. Please try again.';
  } finally {
    document.getElementById('suSubmitText').style.display   = 'inline';
    document.getElementById('suSubmitLoader').style.display = 'none';
    document.getElementById('suSubmitBtn').disabled         = false;
  }
}

function signOut() {
  // Revoke Google session if applicable
  if (typeof google !== 'undefined' && google.accounts?.id) {
    google.accounts.id.disableAutoSelect();
  }
  saveAuthState(null);
  if (customerPhoneInput) customerPhoneInput.value = '';
  closeDropdown();
  showToast('You have been signed out.', 'info');
  updateCartUI();
}

// ─────────────────────────────────────────────────────────────────────
// ✅ AUTH MODAL
// ─────────────────────────────────────────────────────────────────────
function openAuthModal(startTab = 'signin') {
  if (!authModal) return;
  authModal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  switchAuthTab(startTab);
  // Re-init Google button each time (in case it wasn't ready before)
  setTimeout(initGoogleSignIn, 100);
}

function closeAuthModal_fn() {
  if (!authModal) return;
  authModal.style.display = 'none';
  document.body.style.overflow = 'auto';
  // Clear form errors
  ['siEmailError','siPasswordError','siGeneralError','suNameError','suEmailError','suPasswordError','suGeneralError']
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
}

function switchAuthTab(tab) {
  if (tab === 'signin') {
    tabSignIn?.classList.add('active');
    tabSignUp?.classList.remove('active');
    if (signInForm) signInForm.style.display = 'block';
    if (signUpForm) signUpForm.style.display = 'none';
  } else {
    tabSignUp?.classList.add('active');
    tabSignIn?.classList.remove('active');
    if (signUpForm) signUpForm.style.display = 'block';
    if (signInForm) signInForm.style.display = 'none';
  }
}

// ─────────────────────────────────────────────────────────────────────
// ✅ USER DROPDOWN
// ─────────────────────────────────────────────────────────────────────
function toggleDropdown() {
  if (!userDropdown) return;
  const isOpen = userDropdown.classList.contains('open');
  if (isOpen) closeDropdown();
  else        userDropdown.classList.add('open');
}
function closeDropdown() { userDropdown?.classList.remove('open'); }

// ─────────────────────────────────────────────────────────────────────
// ✅ TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const existing = document.querySelector('.fh-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `fh-toast fh-toast-${type}`;
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
  toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 4000);
}

// ─────────────────────────────────────────────────────────────────────
// ✅ ORDER HISTORY + MANUAL PAYMENT FLOW
// ─────────────────────────────────────────────────────────────────────
async function fetchPaymentConfig() {
  if (paymentConfig) return paymentConfig;
  try {
    const res = await fetch(`${API_BASE_URL}/api/config/payment`, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (data.success) paymentConfig = data.data || null;
  } catch (err) {
    console.warn('Could not load payment config:', err.message);
  }
  return paymentConfig;
}

function clearCartAfterOrder() {
  cart = [];
  localStorage.setItem('cart', JSON.stringify(cart));
  if (shippingStateSelect) shippingStateSelect.value = '';
  updateCartUI();
}

function closePaymentInstructions() {
  if (!paymentInstructionsModal) return;
  paymentInstructionsModal.style.display = 'none';
  document.body.style.overflow = 'auto';
}

function renderPaymentInstructions(order) {
  if (!paymentInstructionsContent) return;
  const statusMeta = getStatusMeta(order.status);
  const helpLink = buildWhatsAppLink(order.orderRef);
  const instructions = (paymentConfig?.instructions || [
    'Transfer the exact amount to the bank account shown below.',
    'Use your order reference as payment narration if possible.',
    'Upload your transfer proof after sending payment.'
  ]);
  const accountNumber = getPaymentAccountNumber();
  const accountName = getPaymentAccountName();
  const bankName = getPaymentBankName();
  const orderItems = Array.isArray(order.items) ? order.items : [];

  const productPreview = orderItems.length ? `
    <div class="instruction-card payment-product-card">
      <div class="card-heading">
        <div>
          <span class="payment-eyebrow">Purchased items</span>
          <h3><i class="fas fa-bag-shopping"></i> Order summary</h3>
        </div>
        <span class="account-pill">${orderItems.length} item${orderItems.length === 1 ? '' : 's'}</span>
      </div>
      <div class="payment-product-list">
        ${orderItems.map((item) => {
          const productThumb = getOrderItemImage(item);
          return `
          <div class="payment-product-item">
            ${productThumb
              ? `<img src="${escapeHtml(productThumb)}" alt="${escapeHtml(item.name || 'Product')}" class="payment-product-thumb" />`
              : `<div class="payment-product-thumb payment-product-thumb-fallback"><i class="fas fa-box"></i></div>`}
            <div class="payment-product-meta">
              <strong>${escapeHtml(item.name || 'Product')}</strong>
              <span>Qty ${Number(item.quantity || 1)} • ${formatCurrency(Number(item.price || 0) * Number(item.quantity || 1))}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  ` : '';

  const proofBlock = order.status === 'pending_payment'
    ? `
      <form id="paymentProofForm" class="proof-upload-form">
        <div class="card-heading compact">
          <div>
            <span class="payment-eyebrow">Final step</span>
            <h3><i class="fas fa-cloud-upload-alt"></i> Upload transfer proof</h3>
          </div>
        </div>
        <input type="hidden" id="paymentProofOrderId" value="${escapeHtml(order.id)}" />
        <div class="form-group">
          <label for="paymentTransactionId">Transaction ID or narration</label>
          <input type="text" id="paymentTransactionId" class="form-input" placeholder="Bank transaction ID or narration" value="${escapeHtml(order.transactionId || '')}" />
        </div>
        <div class="form-group">
          <label for="paymentProofFile">Upload transfer proof</label>
          <input type="file" id="paymentProofFile" class="form-input" accept="image/*,.pdf" required />
          <small class="helper-text">Accepted: JPG, PNG, WEBP, or PDF up to 8MB.</small>
        </div>
        <button type="submit" class="btn btn-tertiary" id="submitProofButton">
          <i class="fas fa-cloud-upload-alt"></i> I have sent the payment & upload proof
        </button>
      </form>`
    : order.status === 'awaiting_verification'
      ? `<div class="proof-status-card"><i class="fas fa-hourglass-half"></i><div><strong>Proof received</strong><p>Your proof has been uploaded and is awaiting manual verification.</p></div></div>`
      : `<div class="proof-status-card paid"><i class="fas fa-check-circle"></i><div><strong>Payment verified</strong><p>Your payment has been verified successfully. Open the order details screen to access the official receipt PDF.</p></div></div>`;

  paymentInstructionsContent.innerHTML = `
    <div class="payment-brand-shell">
      <div class="payment-hero-card">
        <div class="payment-brand-row">
          <div class="payment-brand-lockup">
            <div class="payment-brand-logo-wrap">
              <img src="${escapeHtml(resolveAssetUrl('favicon.png'))}" alt="FortuneHub logo" class="payment-brand-logo" />
            </div>
            <div>
              <span class="payment-eyebrow">FortuneHub secure checkout</span>
              <h2>Bank Transfer Payment</h2>
              <p class="receipt-subtitle">Order <code>${escapeHtml(order.orderRef)}</code></p>
            </div>
          </div>
          <div class="payment-status-panel">
            <span class="status-badge status-${statusMeta.className}">${statusMeta.label}</span>
            <small>${escapeHtml(statusMeta.hint || 'Awaiting your next action')}</small>
          </div>
        </div>

        <div class="payment-highlight-grid">
          <div class="highlight-tile">
            <span>Total to transfer</span>
            <strong>${formatCurrency(order.amount)}</strong>
          </div>
          <div class="highlight-tile">
            <span>Bank</span>
            <strong>${escapeHtml(bankName)}</strong>
          </div>
          <div class="highlight-tile">
            <span>Account name</span>
            <strong>${escapeHtml(accountName || 'Set OPAY_ACCOUNT_NAME')}</strong>
          </div>
          <div class="highlight-tile">
            <span>Account number</span>
            <strong>${escapeHtml(accountNumber || 'Set OPAY_ACCOUNT_NUMBER')}</strong>
          </div>
        </div>
      </div>

      <div class="payment-details-grid">
        <div class="instruction-card payment-account-card">
          <div class="card-heading">
            <div>
              <span class="payment-eyebrow">Transfer destination</span>
              <h3><i class="fas fa-building-columns"></i> Account details</h3>
            </div>
            <span class="bank-chip">${escapeHtml(bankName)}</span>
          </div>

          <div class="bank-account-grid">
            <div class="bank-account-block">
              <span class="bank-account-label">Account name</span>
              <div class="bank-account-value">${escapeHtml(accountName || 'Set OPAY_ACCOUNT_NAME')}</div>
            </div>
            <div class="bank-account-block emphasis">
              <span class="bank-account-label">Account number</span>
              <div class="bank-account-value monospace">${escapeHtml(accountNumber || 'Set OPAY_ACCOUNT_NUMBER')}</div>
            </div>
            <div class="bank-account-block compact-block">
              <span class="bank-account-label">Copy account number</span>
              <button type="button" class="copy-chip" data-copy-value="${escapeHtml(accountNumber)}" data-copy-label="account number">
                <i class="fas fa-copy"></i> Copy
              </button>
            </div>
            <div class="bank-account-block compact-block">
              <span class="bank-account-label">Copy order reference</span>
              <button type="button" class="copy-chip" data-copy-value="${escapeHtml(order.orderRef)}" data-copy-label="order reference">
                <i class="fas fa-copy"></i> Copy
              </button>
            </div>
          </div>

          <div class="account-pill-row">
            <span class="account-pill">Order ref: ${escapeHtml(order.orderRef)}</span>
            <span class="account-pill">Shipping: ${escapeHtml(order.shippingState || 'N/A')}</span>
          </div>
          <p class="helper-inline">Use the exact amount above and keep your narration close to the order reference for faster confirmation.</p>
        </div>

        <div class="instruction-card">
          <div class="card-heading compact">
            <div>
              <span class="payment-eyebrow">Verification checklist</span>
              <h3><i class="fas fa-list-check"></i> Transfer instructions</h3>
            </div>
          </div>
          <ol class="instruction-list">
            ${instructions.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ol>
          <div class="instruction-note">
            <i class="fas fa-shield-heart"></i>
            <span>Payments are verified manually by the FortuneHub team before your order is completed.</span>
          </div>
        </div>

        ${productPreview}

        <div class="instruction-card">
          <div class="card-heading compact">
            <div>
              <span class="payment-eyebrow">Order progress</span>
              <h3><i class="fas fa-route"></i> Timeline</h3>
            </div>
          </div>
          ${renderTimeline(order)}
        </div>
      </div>

      ${proofBlock}

      <div class="payment-modal-actions">
        ${helpLink ? `<a class="whatsapp-help-btn" href="${helpLink}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Need help on WhatsApp</a>` : ''}
        <button type="button" class="btn btn-secondary" id="viewOrderHistoryFromPayment">View My Orders</button>
      </div>
    </div>
  `;

  paymentInstructionsContent.querySelectorAll('[data-copy-value]').forEach((btn) => {
    btn.addEventListener('click', () => copyText(btn.dataset.copyValue || '', btn.dataset.copyLabel || 'text'));
  });

  document.getElementById('viewOrderHistoryFromPayment')?.addEventListener('click', () => {
    closePaymentInstructions();
    openOrderHistory();
  });

  document.getElementById('paymentProofForm')?.addEventListener('submit', submitPaymentProof);
}

async function openPaymentInstructions(order) {
  currentOrderFlow = order;
  await fetchPaymentConfig();
  renderPaymentInstructions(order);
  if (!paymentInstructionsModal) return;
  paymentInstructionsModal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

async function submitPaymentProof(event) {
  event.preventDefault();
  const orderId = document.getElementById('paymentProofOrderId')?.value;
  const proofFile = document.getElementById('paymentProofFile')?.files?.[0];
  const transactionId = document.getElementById('paymentTransactionId')?.value?.trim() || '';
  const submitBtn = document.getElementById('submitProofButton');

  if (!orderId || !proofFile) {
    showToast('Please select your payment proof file.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('proof', proofFile);
  if (transactionId) formData.append('transactionId', transactionId);

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading proof…';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/proof`, {
      method: 'POST',
      headers: { ...authHeaders() },
      body: formData
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Proof upload failed');
    currentOrderFlow = data.data;
    renderPaymentInstructions(currentOrderFlow);
    showToast('Payment proof uploaded successfully.', 'success');
  } catch (err) {
    showToast(err.message || 'Could not upload proof.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> I have sent the payment & upload proof';
    }
  }
}

async function openOrderHistory() {
  closeDropdown();
  if (!currentUser) { openAuthModal('signin'); return; }
  if (!orderHistoryModal) return;

  orderHistoryModal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  if (orderHistoryList) orderHistoryList.innerHTML = `<div class="products-loading"><div class="spin"></div><p>Loading orders…</p></div>`;

  try {
    const res = await fetch(`${API_BASE_URL}/api/orders/my`, { headers: { ...authHeaders(), Accept: 'application/json' } });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Could not load orders');

    const orders = data.data || [];
    if (!orders.length) {
      orderHistoryList.innerHTML = `
        <div class="order-empty-state">
          <i class="fas fa-shopping-bag"></i>
          <p>No orders yet. Start shopping!</p>
          <button class="btn btn-tertiary" onclick="document.getElementById('orderHistoryModal').style.display='none';document.body.style.overflow='auto';">Browse Products</button>
        </div>`;
      return;
    }

    orderHistoryList.innerHTML = orders.map(order => {
      const statusMeta = getStatusMeta(order.status);
      const date = new Date(order.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
      const itemsSummary = (order.items || []).map(i => `${i.name} ×${i.quantity || 1}`).join(', ');
      return `
        <div class="order-card">
          <div class="order-card-header">
            <div>
              <span class="order-ref">${escapeHtml(order.orderRef)}</span>
              <span class="order-date">${date}</span>
            </div>
            <span class="status-badge status-${statusMeta.className}">${statusMeta.label}</span>
          </div>
          <div class="order-card-body">
            <p class="order-items-summary">${escapeHtml(itemsSummary || 'Order items')}</p>
            <p class="order-shipping">📍 ${escapeHtml(order.shippingState || 'N/A')} • ${formatCurrency(order.amount)}</p>
            ${renderTimeline(order)}
          </div>
          <div class="order-card-footer">
            <strong class="order-total">${formatCurrency(order.amount)}</strong>
            <div class="order-card-actions">
              <button class="btn-view-receipt" data-order-id="${order.id}" type="button">
                <i class="fas fa-receipt"></i> View Details
              </button>
              ${order.status !== 'paid' ? `<button class="btn-secondary-action" data-pay-order-id="${order.id}" type="button"><i class="fas fa-building-columns"></i> Payment</button>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    orderHistoryList.querySelectorAll('[data-order-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const order = orders.find(item => item.id === btn.dataset.orderId);
        if (order) openReceipt(order);
      });
    });

    orderHistoryList.querySelectorAll('[data-pay-order-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const order = orders.find(item => item.id === btn.dataset.payOrderId);
        if (order) {
          orderHistoryModal.style.display = 'none';
          openPaymentInstructions(order);
        }
      });
    });
  } catch (err) {
    orderHistoryList.innerHTML = `<p class="order-empty">Error: ${escapeHtml(err.message)}</p>`;
  }
}

function openReceipt(order) {
  if (!order || !receiptModal || !receiptContent) return;
  const date = new Date(order.createdAt).toLocaleDateString('en-NG', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const statusMeta = getStatusMeta(order.status);
  const itemsHtml = (order.items || []).map((item) => {
    const quantity = Number(item.quantity || 1);
    const lineTotal = Number(item.price || 0) * quantity;
    const itemImage = getOrderItemImage(item);
    return `
      <tr>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;">
          <div class="receipt-item-cell">
            ${itemImage
              ? `<img src="${escapeHtml(itemImage)}" alt="${escapeHtml(item.name || 'Product')}" class="receipt-item-thumb" />`
              : `<span class="receipt-empty-thumb"><i class="fas fa-box"></i></span>`}
            <div>
              <strong>${escapeHtml(item.name || 'Product')}</strong>
            </div>
          </div>
        </td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${quantity}</td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(lineTotal)}</td>
      </tr>`;
  }).join('');
  const helpLink = buildWhatsAppLink(order.orderRef);

  const receiptActions = order.status === 'paid'
    ? `
      ${order.receiptPdfUrl ? `<a class="btn btn-secondary receipt-screen-only" href="${order.receiptPdfUrl}" target="_blank" rel="noopener"><i class="fas fa-file-pdf"></i> Download Receipt PDF</a>` : ''}
      ${helpLink ? `<a class="whatsapp-help-btn receipt-screen-only" href="${helpLink}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp Help</a>` : ''}`
    : `
      <button type="button" class="btn btn-tertiary receipt-screen-only" id="continuePaymentBtn"><i class="fas fa-building-columns"></i> Continue Payment</button>
      ${helpLink ? `<a class="whatsapp-help-btn receipt-screen-only" href="${helpLink}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp Help</a>` : ''}`;

  receiptContent.innerHTML = `
    <div class="receipt-sheet">
      <div class="receipt-header">
        <div class="receipt-title-row">
          <div>
            <span class="payment-eyebrow" style="color:var(--brand-blue);opacity:1;">Order receipt</span>
            <h2>Fortune's <span>Hub</span></h2>
            <p class="receipt-sheet-subtitle">A clean single-page summary for your verified bank transfer order.</p>
          </div>
          <span class="status-badge status-${statusMeta.className} receipt-inline-status">${statusMeta.label}</span>
        </div>
      </div>

      <div class="receipt-summary-grid">
        <div class="receipt-meta-card"><span>Reference</span><strong><code>${escapeHtml(order.orderRef)}</code></strong></div>
        <div class="receipt-meta-card"><span>Date</span><strong>${date}</strong></div>
        <div class="receipt-meta-card"><span>Customer</span><strong>${escapeHtml(order.customerName || currentUser?.name || 'Customer')}</strong></div>
        <div class="receipt-meta-card"><span>Transaction ID</span><strong>${escapeHtml(order.transactionId || 'Not provided')}</strong></div>
      </div>

      <div class="receipt-meta">
        <div><strong>Email:</strong> ${escapeHtml(order.email || currentUser?.email || 'N/A')}</div>
        <div><strong>WhatsApp:</strong> ${escapeHtml(order.customerPhone || 'N/A')}</div>
        <div><strong>Shipping To:</strong> ${escapeHtml(order.shippingState || 'N/A')}</div>
        <div><strong>Payment Method:</strong> Bank transfer</div>
      </div>

      <table class="receipt-table receipt-table-compact" style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead><tr style="background:#f0f2ff;">
          <th style="padding:12px 10px;text-align:left;">Item</th>
          <th style="padding:12px 10px;text-align:center;">Qty</th>
          <th style="padding:12px 10px;text-align:right;">Amount</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div class="receipt-totals">
        <div class="receipt-row"><span>Subtotal</span><span>${formatCurrency(order.subtotal)}</span></div>
        <div class="receipt-row"><span>Shipping</span><span>${formatCurrency(order.shippingFee)}</span></div>
        <div class="receipt-row receipt-grand"><span>Total Paid</span><span>${formatCurrency(order.amount)}</span></div>
      </div>

      <div class="instruction-card receipt-timeline-card">
        <h3><i class="fas fa-route"></i> Order timeline</h3>
        ${renderTimeline(order)}
      </div>

      <div class="payment-modal-actions receipt-actions">
        ${receiptActions}
      </div>
    </div>
  `;

  document.getElementById('continuePaymentBtn')?.addEventListener('click', () => {
    receiptModal.style.display = 'none';
    openPaymentInstructions(order);
  });

  receiptModal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function showLoadingOverlay(message = 'Processing…') {
  hideLoadingOverlay();
  const overlay = document.createElement('div');
  overlay.id = 'paymentLoadingOverlay';
  overlay.innerHTML = `
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <h3 class="loading-title">${message}</h3>
      <p class="loading-subtitle">Please wait, do not close this window.</p>
      <div class="loading-progress"><div class="loading-progress-bar"></div></div>
    </div>
    <style>
      #paymentLoadingOverlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeInOvl .3s ease}
      @keyframes fadeInOvl{from{opacity:0}to{opacity:1}}
      .loading-content{background:#fff;border-radius:20px;padding:40px 50px;max-width:450px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4);animation:slideUpOvl .4s ease}
      @keyframes slideUpOvl{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
      .loading-spinner{width:60px;height:60px;border:5px solid #f0f0f0;border-top:5px solid #667eea;border-radius:50%;margin:0 auto 25px;animation:spinOvl 1s linear infinite}
      @keyframes spinOvl{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
      .loading-title{font-size:22px;font-weight:700;color:#1f2937;margin:0 0 10px}
      .loading-subtitle{font-size:15px;color:#595959;margin:0 0 25px;line-height:1.5}
      .loading-progress{width:100%;height:6px;background:#f0f0f0;border-radius:10px;overflow:hidden;margin-bottom:20px}
      .loading-progress-bar{height:100%;background:linear-gradient(90deg,#667eea,#764ba2);border-radius:10px;animation:progressBarOvl 60s ease-in-out;width:0%}
      @keyframes progressBarOvl{0%{width:0%}50%{width:75%}100%{width:95%}}
      @keyframes fadeOutOvl{from{opacity:1}to{opacity:0}}
    </style>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}
function hideLoadingOverlay() {
  const overlay = document.getElementById('paymentLoadingOverlay');
  if (overlay) { overlay.style.animation = 'fadeOutOvl .3s ease'; setTimeout(() => { overlay.remove(); document.body.style.overflow = 'auto'; }, 300); }
}

async function initiateManualCheckout() {
  if (cart.length === 0) { alert('Your cart is empty.'); return; }
  if (!currentUser) {
    closeCartModal();
    showToast('Please sign in to complete your purchase.', 'info');
    openAuthModal('signin');
    return;
  }
  if (!validateCustomerInfo()) { alert('Please complete all required information correctly.'); return; }

  const shippingFeeNaira = parseInt(shippingStateSelect?.value || '0', 10) || 0;
  const shippingState = shippingStateSelect?.options?.[shippingStateSelect.selectedIndex]?.text || '';
  const phone = (customerPhoneInput?.value || '').trim();

  showLoadingOverlay('Creating your order…');
  try {
    await fetchPaymentConfig();
    const res = await fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        items: cart,
        shippingState,
        shippingFee: shippingFeeNaira,
        customerPhone: phone
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Could not create order');
    currentOrderFlow = data.data;
    clearCartAfterOrder();
    hideLoadingOverlay();
    closeCartModal();
    showToast(`Order ${currentOrderFlow.orderRef} created. Complete your bank transfer using the account details provided.`, 'success');
    openPaymentInstructions(currentOrderFlow);
  } catch (err) {
    hideLoadingOverlay();
    alert(`❌ Could not create order: ${err.message || 'Unknown error'}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// PRODUCTS LOADING STATE (unchanged)
// ─────────────────────────────────────────────────────────────────────
function showProductsLoading(state = 'idle', opts = {}) {
  if (!productsGrid) return;
  let html = '';
  if (state === 'idle') {
    html = `<div class="products-loading"><div class="spin"></div><p>Loading products…</p><small>Please wait a moment.</small></div>`;
  } else if (state === 'waking') {
    html = `<div class="products-loading"><div class="spin"></div><p>Server is waking up…</p><small>This usually takes <strong>20–40 seconds</strong>. Products will appear automatically.</small></div>`;
  } else if (state === 'retrying') {
    html = `<div class="products-loading"><div class="spin"></div><p>Still waking up… <span style="color:#667eea;">(Attempt ${opts.attempt || 2} of ${opts.maxRetries || MAX_RETRIES})</span></p><small>Hang tight — your products will load shortly. ☕</small></div>`;
  } else if (state === 'error') {
    html = `<div class="products-loading" style="gap:12px;"><i class="fas fa-exclamation-circle" style="font-size:48px;color:#e74c3c;"></i><p style="color:#e74c3c;">Could not load products</p><small>Please check your connection and try again.</small><button id="retryLoadProducts" class="btn btn-primary" style="margin-top:10px;padding:10px 28px;font-size:15px;cursor:pointer;"><i class="fas fa-redo"></i> Retry</button></div>`;
  }
  productsGrid.innerHTML = html;
  const retryBtn = document.getElementById('retryLoadProducts');
  if (retryBtn && typeof opts.retryFn === 'function') retryBtn.addEventListener('click', opts.retryFn);
}

// ─────────────────────────────────────────────────────────────────────
// CART UI + LOGIC
// ─────────────────────────────────────────────────────────────────────
function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (cartCount) cartCount.textContent = totalItems;

  if (!cartItemsContainer) return;
  cartItemsContainer.innerHTML = '';
  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<p style="text-align:center;color:#555;">Your cart is empty.</p>';
    if (checkoutButton) checkoutButton.disabled = true;
    return;
  }

  cart.forEach(item => {
    const product = getProductById(item.id);
    const imgSrc  = getOrderItemImage(item) || resolveAssetUrl((product && getProductImage(product)) || '');
    cartItemsContainer.insertAdjacentHTML('beforeend', `
      <div class="cart-item">
        <div class="item-details">
          <img src="${imgSrc}" alt="${item.name}" onerror="this.style.display='none'">
          <div class="item-info"><h4>${item.name}</h4><span class="item-price">${formatCurrency(item.price)}</span></div>
        </div>
        <div class="item-quantity">
          <button class="btn-quantity minus" data-id="${item.id}" data-change="-1">-</button>
          <span>${item.quantity}</span>
          <button class="btn-quantity plus" data-id="${item.id}" data-change="1">+</button>
          <i class="fas fa-trash-alt remove-item" data-id="${item.id}"></i>
        </div>
      </div>`);
  });

  document.querySelectorAll('.btn-quantity').forEach(btn => {
    btn.addEventListener('click', e => updateQuantity(e.currentTarget.dataset.id, parseInt(e.currentTarget.dataset.change, 10)));
  });
  document.querySelectorAll('.remove-item').forEach(btn => {
    btn.addEventListener('click', e => removeItem(e.currentTarget.dataset.id));
  });

  const subtotal    = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = cart.length > 0 ? (parseInt(shippingStateSelect?.value || '0', 10) || 0) : 0;
  const grandTotal  = subtotal + shippingFee;

  if (cartSubTotalElement)      cartSubTotalElement.textContent      = formatCurrency(subtotal);
  if (shippingFeeAmountElement) shippingFeeAmountElement.textContent = formatCurrency(shippingFee);
  if (cartTotalElement)         cartTotalElement.textContent         = formatCurrency(grandTotal);

  if (checkoutButton) {
    const valid = validateCustomerInfo({ silent: true });
    if (!valid) {
      checkoutButton.disabled = true;
      checkoutButton.innerHTML = '<i class="fas fa-info-circle"></i> Complete Info to Continue';
    } else {
      checkoutButton.disabled = false;
      checkoutButton.innerHTML = '<i class="fas fa-building-columns"></i> Proceed to Bank Transfer';
    }
  }
}

function addToCart(productId, quantity = 1) {
  const product = getProductById(productId);
  if (!product || product.outOfStock) { alert('Product is out of stock.'); return; }
  const cartItem = cart.find(item => String(item.id) === String(productId));
  if (cartItem) { cartItem.quantity += quantity; }
  else {
    const primaryImage = getProductImage(product);
    cart.push({ id: product.id, productId: product._id || product.id, name: product.name, price: product.price, quantity, image: primaryImage });
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartUI();
  alert(`${product.name} added to cart!`);
}

function updateQuantity(productId, change) {
  const cartItem = cart.find(item => String(item.id) === String(productId));
  if (cartItem) {
    cartItem.quantity += change;
    if (cartItem.quantity <= 0) cart = cart.filter(item => String(item.id) !== String(productId));
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartUI();
}

function removeItem(productId) {
  cart = cart.filter(item => String(item.id) !== String(productId));
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartUI();
}

// ─────────────────────────────────────────────────────────────────────
// ✅ VALIDATION — aware of auth state
// ─────────────────────────────────────────────────────────────────────
function validateCustomerInfo({ silent = false } = {}) {
  let isValid = true;
  if (nameError)  nameError.style.display  = 'none';
  if (emailError) emailError.style.display = 'none';
  if (phoneError) phoneError.style.display = 'none';

  const phone = (customerPhoneInput?.value || '').trim();

  if (currentUser) {
    // Logged in — only validate phone + state
    const phoneRegex = /^(0[789][01])\d{8}$/;
    if (!phone || !phoneRegex.test(phone)) {
      if (!silent && phoneError) { phoneError.textContent = 'Enter a valid Nigerian WhatsApp number (e.g., 08031234567).'; phoneError.style.display = 'block'; }
      isValid = false;
    }
  } else {
    // Guest — validate all fields
    const name  = (customerNameInput?.value  || '').trim();
    const email = (customerEmailInput?.value || '').trim();

    if (!name || name.length < 3 || name.includes('@') || name.includes('.')) {
      if (!silent && nameError) { nameError.textContent = 'Please enter your full name (not email).'; nameError.style.display = 'block'; }
      isValid = false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      if (!silent && emailError) { emailError.textContent = 'Enter a valid email (e.g., name@example.com).'; emailError.style.display = 'block'; }
      isValid = false;
    }
    const phoneRegex = /^(0[789][01])\d{8}$/;
    if (!phone || !phoneRegex.test(phone)) {
      if (!silent && phoneError) { phoneError.textContent = 'Enter a valid Nigerian WhatsApp number (e.g., 08031234567).'; phoneError.style.display = 'block'; }
      isValid = false;
    }
  }

  if (!(shippingStateSelect?.value || '')) isValid = false;
  return isValid;
}

// ─────────────────────────────────────────────────────────────────────
// PRODUCT DETAIL MODAL (unchanged)
// ─────────────────────────────────────────────────────────────────────
function openProductDetail(productId) {
  const product = getProductById(productId);
  if (!product) return;
  currentProduct = product;
  zoomEnabled    = false;
  const mainContainer = document.querySelector('.main-image-container');
  if (mainContainer) mainContainer.classList.remove('zoom-active');
  if (detailCategory) detailCategory.textContent = product.category || 'Product';
  if (detailTitle)    detailTitle.textContent    = product.name;
  if (detailPrice)    detailPrice.textContent    = formatCurrency(product.price);
  if (detailBadge) {
    detailBadge.textContent = '';
    detailBadge.className   = 'detail-badge';
    if (product.sold)                { detailBadge.textContent = 'SOLD'; detailBadge.classList.add('badge-sold'); detailBadge.style.display = 'inline-block'; }
    else if (product.tag === 'new')  { detailBadge.textContent = 'NEW';  detailBadge.classList.add('badge-new');  detailBadge.style.display = 'inline-block'; }
    else if (product.tag === 'sale') { detailBadge.textContent = 'SALE'; detailBadge.classList.add('badge-sale'); detailBadge.style.display = 'inline-block'; }
    else detailBadge.style.display = 'none';
  }
  if (detailDescription) detailDescription.textContent = product.description || 'No description available.';
  if (detailSpecsList) {
    detailSpecsList.innerHTML = '';
    const specs = product.specifications || { 'Category': product.category, 'Availability': product.outOfStock ? 'Out of Stock' : 'In Stock', 'Price': formatCurrency(product.price) };
    Object.entries(specs).forEach(([key, value]) => {
      const li = document.createElement('li');
      li.innerHTML = `<i class="fas fa-check-circle"></i> <strong>${key}:</strong> ${value}`;
      detailSpecsList.appendChild(li);
    });
  }
  const imgs   = Array.isArray(product.images) && product.images.length ? product.images.slice(0, 4) : [product.image, product.image, product.image];
  const images = imgs.map(img => resolveAssetUrl(img || product.image));
  if (detailMainImage) { detailMainImage.src = images[0]; detailMainImage.alt = product.name; }
  if (detailThumbnails) {
    detailThumbnails.innerHTML = '';
    images.forEach((imgSrc, index) => {
      const thumb = document.createElement('img');
      thumb.src = imgSrc; thumb.alt = `${product.name} ${index + 1}`; thumb.classList.add('detail-thumb');
      if (index === 0) thumb.classList.add('active');
      thumb.addEventListener('click', () => { detailMainImage.src = imgSrc; detailThumbnails.querySelectorAll('img').forEach(t => t.classList.remove('active')); thumb.classList.add('active'); });
      detailThumbnails.appendChild(thumb);
    });
  }
  const isSoldOrOut = product.sold || product.outOfStock;
  if (detailAddCart) { detailAddCart.disabled = isSoldOrOut; detailAddCart.innerHTML = isSoldOrOut ? '<i class="fas fa-ban"></i> Out of Stock' : '<i class="fas fa-cart-plus"></i> Add to Cart'; }
  if (detailBuyNow)  { detailBuyNow.disabled  = isSoldOrOut; detailBuyNow.innerHTML  = isSoldOrOut ? '<i class="fas fa-ban"></i> Out of Stock' : '<i class="fas fa-bolt"></i> Buy Now'; }
  if (productDetailModal) { productDetailModal.style.display = 'block'; document.body.style.overflow = 'hidden'; }
  initImageZoom();
}

function closeProductDetail() {
  if (productDetailModal) { productDetailModal.style.display = 'none'; document.body.style.overflow = 'auto'; }
  currentProduct = null; zoomEnabled = false;
  const mainContainer = document.querySelector('.main-image-container');
  if (mainContainer) mainContainer.classList.remove('zoom-active');
}

// ─────────────────────────────────────────────────────────────────────
// IMAGE ZOOM (unchanged)
// ─────────────────────────────────────────────────────────────────────
function initImageZoom() {
  const mainImage = detailMainImage;
  const lens = zoomLens; const result = zoomResult;
  const container = document.querySelector('.main-image-container');
  if (!mainImage || !lens || !result || !container) return;
  let cx, cy;
  function updateZoomRatio() {
    cx = result.offsetWidth / lens.offsetWidth;
    cy = result.offsetHeight / lens.offsetHeight;
    result.style.backgroundImage = `url('${mainImage.src}')`;
    result.style.backgroundSize  = `${mainImage.width * cx}px ${mainImage.height * cy}px`;
  }
  function moveLens(e) {
    if (!zoomEnabled) return;
    e.preventDefault();
    const pos = getCursorPos(e);
    let x = pos.x - lens.offsetWidth / 2;
    let y = pos.y - lens.offsetHeight / 2;
    if (x > mainImage.width - lens.offsetWidth)   x = mainImage.width - lens.offsetWidth;
    if (x < 0) x = 0;
    if (y > mainImage.height - lens.offsetHeight) y = mainImage.height - lens.offsetHeight;
    if (y < 0) y = 0;
    lens.style.left = x + 'px'; lens.style.top = y + 'px';
    result.style.backgroundPosition = `-${x * cx}px -${y * cy}px`;
  }
  function getCursorPos(e) {
    const rect = mainImage.getBoundingClientRect();
    return { x: (e.pageX || e.touches[0].pageX) - rect.left - window.pageXOffset, y: (e.pageY || e.touches[0].pageY) - rect.top - window.pageYOffset };
  }
  if (zoomToggle) {
    zoomToggle.onclick = function () {
      zoomEnabled = !zoomEnabled;
      if (zoomEnabled) { container.classList.add('zoom-active'); updateZoomRatio(); this.querySelector('i').classList.replace('fa-search-plus', 'fa-search-minus'); }
      else { container.classList.remove('zoom-active'); this.querySelector('i').classList.replace('fa-search-minus', 'fa-search-plus'); }
    };
  }
  container.addEventListener('mousemove', moveLens);
  container.addEventListener('touchmove', moveLens);
  mainImage.addEventListener('load', updateZoomRatio);
  window.addEventListener('resize', updateZoomRatio);
}

// ─────────────────────────────────────────────────────────────────────
// PRODUCTS DISPLAY (unchanged)
// ─────────────────────────────────────────────────────────────────────
function displayProducts(productsToShow) {
  if (!productsGrid) return;
  productsGrid.innerHTML = '';
  if (!productsToShow || productsToShow.length === 0) {
    productsGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#555;"><i class="fas fa-box-open" style="font-size:48px;color:#ccc;margin-bottom:15px;display:block;"></i><p style="font-size:18px;margin:0;">No products found</p></div>`;
    return;
  }
  productsToShow.forEach(product => {
    const isSold = !!product.sold; const isOutOfStock = !!product.outOfStock;
    let badgeClass = '', badgeText = '';
    if (isSold)                    { badgeClass = 'badge-sold'; badgeText = 'SOLD'; }
    else if (product.tag === 'new') { badgeClass = 'badge-new';  badgeText = 'NEW';  }
    else if (product.tag === 'sale'){ badgeClass = 'badge-sale'; badgeText = 'SALE'; }
    let buttonText = 'Add to Cart', buttonClass = 'btn-add-to-cart add-to-cart';
    let buyNowText = 'Buy Now',     buyNowClass  = 'btn-buy-now buy-now';
    let isDisabled = '';
    if (isSold || isOutOfStock) { const label = isSold ? 'SOLD' : 'Out of Stock'; buttonText = label; buttonClass = 'btn-secondary'; buyNowText = label; buyNowClass = 'btn-secondary'; isDisabled = 'disabled'; }
    const imgs   = Array.isArray(product.images) && product.images.length ? product.images.slice(0, 3) : [product.image, product.image, product.image];
    const images = [ resolveAssetUrl(imgs[0] || product.image), resolveAssetUrl(imgs[1] || product.image), resolveAssetUrl(imgs[2] || product.image) ];
    productsGrid.insertAdjacentHTML('beforeend', `
      <div class="product-card" data-category="${product.category}" data-product-id="${product.id}">
        <div class="product-image-slider" data-images='${JSON.stringify(images)}'>
          <img src="${images[0]}" alt="${product.name}" class="product-main-img" loading="lazy">
          <div class="product-thumbnails">
            <img src="${images[0]}" alt="view 1" class="thumb active" data-index="0" loading="lazy">
            <img src="${images[1]}" alt="view 2" class="thumb"        data-index="1" loading="lazy">
            <img src="${images[2]}" alt="view 3" class="thumb"        data-index="2" loading="lazy">
          </div>
          ${badgeText ? `<span class="product-badge ${badgeClass}">${badgeText}</span>` : ''}
        </div>
        <div class="product-info">
          <p class="product-category">${product.category}</p>
          <h3 class="product-title">${product.name}</h3>
          <p class="product-price">${formatCurrency(product.price)}</p>
          <p class="product-description">${product.description}</p>
          <div class="product-actions">
            <button class="btn ${buttonClass}" ${isDisabled} data-id="${product.id}">${buttonText}</button>
            <button class="btn ${buyNowClass}"  ${isDisabled} data-id="${product.id}">${buyNowText}</button>
          </div>
        </div>
      </div>`);
  });
}

function filterProducts(category) {
  const filtered = category === 'all' ? products : products.filter(p => (p.category || '').toLowerCase() === category.toLowerCase());
  displayProducts(filtered);
}

function searchProducts(query) {
  const text = (query || '').toLowerCase();
  displayProducts(products.filter(p => (p.name || '').toLowerCase().includes(text) || (p.category || '').toLowerCase().includes(text) || (p.description || '').toLowerCase().includes(text)));
}

// ─────────────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────────────────────────────
function setActiveFilterButton(category) {
  filterButtons.forEach(btn => { const isActive = btn.dataset.category === category; btn.classList.toggle('active', isActive); btn.setAttribute('aria-pressed', isActive ? 'true' : 'false'); });
}

function setupEventListeners() {
  searchIconBtn?.addEventListener('click', () => { document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => searchInput?.focus(), 400); });
  searchInput?.addEventListener('input', e => searchProducts(e.target.value));
  filterButtons.forEach(btn => { btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false'); btn.addEventListener('click', () => { setActiveFilterButton(btn.dataset.category); filterProducts(btn.dataset.category); }); });
  categoryCards.forEach(card => { card.addEventListener('click', () => { setActiveFilterButton(card.dataset.category); filterProducts(card.dataset.category); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }); }); });

  cartIcon?.addEventListener('click', openCartModal);
  footerOpenCart?.addEventListener('click', e => { e.preventDefault(); openCartModal(); });
  closeModal?.addEventListener('click', closeCartModal);
  continueShoppingButton?.addEventListener('click', closeCartModal);
  closeProductModal?.addEventListener('click', closeProductDetail);

  detailAddCart?.addEventListener('click', () => { if (currentProduct && !currentProduct.sold && !currentProduct.outOfStock) addToCart(String(currentProduct.id)); });
  detailBuyNow?.addEventListener('click',  () => { if (currentProduct && !currentProduct.sold && !currentProduct.outOfStock) { addToCart(String(currentProduct.id), 1); closeProductDetail(); openCartModal(); } });

  window.addEventListener('click', e => {
    if (cartModal          && e.target === cartModal)          closeCartModal();
    if (productDetailModal && e.target === productDetailModal) closeProductDetail();
    if (authModal          && e.target === authModal)          closeAuthModal_fn();
    if (orderHistoryModal  && e.target === orderHistoryModal)  { orderHistoryModal.style.display = 'none'; document.body.style.overflow = 'auto'; }
    if (receiptModal       && e.target === receiptModal)       { receiptModal.style.display = 'none'; document.body.style.overflow = 'auto'; }
    if (paymentInstructionsModal && e.target === paymentInstructionsModal) closePaymentInstructions();
    // Close dropdown when clicking outside
    if (!e.target.closest('.user-avatar-wrap')) closeDropdown();
  });

  shippingStateSelect?.addEventListener('change', updateCartUI);
  customerNameInput?.addEventListener('input',  updateCartUI);
  customerEmailInput?.addEventListener('input', updateCartUI);
  customerPhoneInput?.addEventListener('input', () => {
    updateCartUI();
    // Save phone for logged-in users
    if (currentUser && customerPhoneInput.value) {
      currentUser.phone = customerPhoneInput.value.trim();
      localStorage.setItem('fh_auth', JSON.stringify(currentUser));
      // Sync phone to backend (fire-and-forget)
      fetch(`${API_BASE_URL}/api/auth/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ phone: currentUser.phone }) }).catch(() => {});
    }
  });

  checkoutButton?.addEventListener('click', initiateManualCheckout);

  productsGrid?.addEventListener('click', e => {
    const target = e.target;
    const card   = target.closest('.product-card');
    if (card && !target.closest('button') && !target.closest('.thumb')) { openProductDetail(card.dataset.productId); return; }
    if (target?.classList?.contains('add-to-cart')) { e.stopPropagation(); addToCart(target.dataset.id); return; }
    if (target?.classList?.contains('buy-now'))     { e.stopPropagation(); addToCart(target.dataset.id, 1); openCartModal(); return; }
    if (target?.classList?.contains('thumb')) {
      e.stopPropagation();
      const slider  = target.closest('.product-image-slider');
      const mainImg = slider?.querySelector('.product-main-img');
      if (!slider || !mainImg) return;
      const images = JSON.parse(slider.dataset.images || '[]');
      const index  = parseInt(target.dataset.index, 10);
      if (images[index]) mainImg.src = images[index];
      slider.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
      target.classList.add('active');
    }
  });

  // ──── AUTH EVENT LISTENERS ─────────────────────────────
  headerSignInBtn?.addEventListener('click', () => openAuthModal('signin'));
  closeAuthModal?.addEventListener('click', closeAuthModal_fn);
  tabSignIn?.addEventListener('click', () => switchAuthTab('signin'));
  tabSignUp?.addEventListener('click', () => switchAuthTab('signup'));
  signInForm?.addEventListener('submit', handleEmailSignIn);
  signUpForm?.addEventListener('submit', handleEmailSignUp);

  userAvatarBtn?.addEventListener('click', e => { e.stopPropagation(); toggleDropdown(); });
  signOutBtn?.addEventListener('click', signOut);
  viewHistoryBtn?.addEventListener('click', openOrderHistory);
  changeAccountBtn?.addEventListener('click', () => { closeCartModal(); openAuthModal('signin'); });
  cartSignInPromptBtn?.addEventListener('click', () => { closeCartModal(); openAuthModal('signin'); });

  // Close order history + receipt modals
  closeOrderHistoryModal?.addEventListener('click', () => { orderHistoryModal.style.display = 'none'; document.body.style.overflow = 'auto'; });
  closeReceiptModal?.addEventListener('click',      () => { receiptModal.style.display = 'none'; document.body.style.overflow = 'auto'; });
  closePaymentInstructionsModal?.addEventListener('click', closePaymentInstructions);

  // Password toggle
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      const isText = target.type === 'text';
      target.type = isText ? 'password' : 'text';
      const icon = btn.querySelector('i');
      if (icon) { icon.classList.toggle('fa-eye', isText); icon.classList.toggle('fa-eye-slash', !isText); }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────
// MODAL OPENERS
// ─────────────────────────────────────────────────────────────────────
function openCartModal() {
  if (!cartModal) return;
  cartModal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  updateCartUI();
}
function closeCartModal() {
  if (!cartModal) return;
  cartModal.style.display = 'none';
  document.body.style.overflow = 'auto';
}

// ─────────────────────────────────────────────────────────────────────
// MANUAL OPAY FLOW
// ─────────────────────────────────────────────────────────────────────
// Checkout now creates an order first, then opens the bank-transfer
// instructions modal for proof upload and manual verification.

// ─────────────────────────────────────────────────────────────────────
// FETCH PRODUCTS WITH RETRY (unchanged)
// ─────────────────────────────────────────────────────────────────────
async function fetchProductsWithRetry() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt === 1)      showProductsLoading('idle');
    else if (attempt === 2) showProductsLoading('waking');
    else                    showProductsLoading('retrying', { attempt, maxRetries: MAX_RETRIES });

    const controller = new AbortController();
    const timerId    = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timerId);
      if (response.ok) {
        const data  = await response.json();
        let found   = null;
        if (data.success && Array.isArray(data.data) && data.data.length) found = data.data;
        else if (Array.isArray(data) && data.length) found = data;
        if (found) { console.log(`✅ Products loaded on attempt ${attempt}`); return found; }
        console.warn(`⚠️ Attempt ${attempt}: empty product list`);
      } else { console.warn(`⚠️ Attempt ${attempt}: HTTP ${response.status}`); }
    } catch (err) {
      clearTimeout(timerId);
      console.warn(`⚠️ Attempt ${attempt}:`, err.name === 'AbortError' ? 'timed out' : err.message);
    }
    if (attempt < MAX_RETRIES) await sleep(RETRY_DELAYS[attempt - 1] || 10000);
  }
  return null;
}

function warmUpBackend() {
  fetch(`${API_BASE_URL}/health`, { cache: 'no-store', method: 'GET' }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────
async function initializeApp() {
  // Load persisted auth state
  loadAuthState();
  updateAuthUI();
  fetchPaymentConfig().catch(() => {});

  // Init Google Sign-In (may be called again later if GIS not ready yet)
  if (typeof google !== 'undefined') initGoogleSignIn();
  else {
    // GIS script loads async — poll until ready
    const poll = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts) { clearInterval(poll); initGoogleSignIn(); }
    }, 300);
    setTimeout(() => clearInterval(poll), 10000); // give up after 10s
  }

  warmUpBackend();

  const fetched = await fetchProductsWithRetry();
  if (fetched) {
    products = fetched;
  } else {
    console.warn('❌ Backend unreachable. Trying products.json fallback…');
    try {
      const fallbackResp = await fetch(getProductsJsonUrl(), { cache: 'no-store' });
      if (!fallbackResp.ok) throw new Error(`HTTP ${fallbackResp.status}`);
      const rawProducts = await fallbackResp.json();
      if (Array.isArray(rawProducts) && rawProducts.length) {
        products = rawProducts.map(p => ({ ...p, price: (Number(p.price) || 0) / 100 }));
      } else throw new Error('products.json is empty');
    } catch (fallbackErr) {
      console.error('❌ products.json fallback failed:', fallbackErr.message);
      products = [];
      showProductsLoading('error', { retryFn: () => initializeApp() });
      setupEventListeners();
      updateCartUI();
      setActiveFilterButton('all');
      return;
    }
  }

  displayProducts(products);
  setupEventListeners();
  updateCartUI();
  setActiveFilterButton('all');
}

document.addEventListener('DOMContentLoaded', initializeApp);
