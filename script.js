// =====================================================================
// FortuneHub Frontend Script  v6 — Auth-Gated Checkout + Google OAuth Fixes
//
// ✅ FIXED in v6:
//    • Purchase now REQUIRES sign-in (no guest checkout)
//    • Google Sign-In: fixed isEmailVerified state & account conflicts
//    • Email verification routes fixed (were dead code on backend)
//    • Checkout button shows "Sign In to Checkout" for guests
//    • Better error messages for Google account conflicts
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
//    • Lazy Paystack loader
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

let PAYSTACK_PUBLIC_KEY = 'pk_test_9f6a5cb45aeab4bd8bccd72129beda47f2609921';

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
    let m = item;
    if (item.price && item.price > 10000) m = { ...item, price: Math.round(item.price / 100) };
    const img = String(m.image || '');
    if (img.startsWith('data:') || img.length > 300) m = { ...m, image: '' };
    return m;
  });
})();

let currentProduct = null;
let zoomEnabled    = false;

// ✅ FIX: Track active payment reference to cancel it if user closes popup
let _pendingPaymentRef = null;  // set when Paystack popup opens, cleared on verify/cancel

// ─────────────────────────────────────────────────────────────────────
// ✅ AUTH STATE
// ─────────────────────────────────────────────────────────────────────
let currentUser = null; // { id, name, email, picture, phone, token, authProvider }
let pendingVerifyEmail = null;

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
// Paystack lazy-load state
// ─────────────────────────────────────────────────────────────────────
let paystackScriptLoaded  = false;
let paystackScriptLoading = false;
let paystackLoadCallbacks = [];

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
const customerPhoneInput       = document.getElementById('customerPhone');
const shippingStateSelect      = document.getElementById('shippingState');
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

// Verify / Forgot forms
const verifyEmailForm          = document.getElementById('verifyEmailForm');
const forgotPasswordForm       = document.getElementById('forgotPasswordForm');
const veEmailText              = document.getElementById('veEmailText');
const resendVerificationBtn     = document.getElementById('resendVerificationBtn');
const backToSignInBtn           = document.getElementById('backToSignInBtn');
const forgotPasswordLink        = document.getElementById('forgotPasswordLink');
const fpBackBtn                 = document.getElementById('fpBackBtn');

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
function getProductById(id) { return products.find(p => String(p.id) === String(id)); }
function getProductsJsonUrl() { return new URL('products.json', window.location.href).toString(); }
function getRepoBaseUrl() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const repoName = parts.length ? parts[0] : '';
  return `${window.location.origin}/${repoName}/`;
}
function resolveAssetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return `${window.location.origin}${path}`;
  return new URL(path, getRepoBaseUrl()).toString();
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
      // Close cart if it was open (user signed in via cart prompt)
      if (cartModal && cartModal.style.display === 'block') {
        // Re-open auth modal is not needed — just update cart
        updateCartUI();
      }
    } else {
      // ✅ FIX: Show friendly Google sign-in error
      const msg = data.message || 'Google sign-in failed. Please try again.';
      showToast(msg, 'error');
      openAuthModal('signin');
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
      if (data && data.requiresVerification) {
        pendingVerifyEmail = data.email || email;
        showVerifyEmailForm(data.email || email);
        showToast(data.message || 'Please verify your email.', 'info');
      } else if (data && data.isGoogleAccount) {
        // ✅ FIX: This email was registered via Google — guide user to Google sign-in
        document.getElementById('siGeneralError').textContent = data.message || 'Please sign in with Google.';
        showToast('This email uses Google Sign-In. Click "Continue with Google" below. 👆', 'info');
      } else {
        document.getElementById('siGeneralError').textContent = data.message || 'Sign in failed';
      }
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
  const confirm  = document.getElementById('suConfirmPassword')?.value || '';

  document.getElementById('suNameError').textContent     = '';
  document.getElementById('suEmailError').textContent    = '';
  document.getElementById('suPasswordError').textContent = '';
  const cpErr = document.getElementById('suConfirmPasswordError');
  if (cpErr) cpErr.textContent = '';
  document.getElementById('suGeneralError').textContent  = '';

  let valid = true;
  if (!name || name.length < 2)                     { document.getElementById('suNameError').textContent     = 'Enter your full name'; valid = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { document.getElementById('suEmailError').textContent    = 'Enter a valid email'; valid = false; }
  if (!password || password.length < 6)             { document.getElementById('suPasswordError').textContent = 'Password must be at least 6 characters'; valid = false; }
  if (!confirm || confirm !== password) { const el = document.getElementById('suConfirmPasswordError'); if (el) el.textContent = 'Passwords do not match'; valid = false; }
  if (!valid) return;

  document.getElementById('suSubmitText').style.display   = 'none';
  document.getElementById('suSubmitLoader').style.display = 'inline-flex';
  document.getElementById('suSubmitBtn').disabled         = true;

  try {
    const res  = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password, confirmPassword: confirm }),
    });
    const data = await res.json();

    if (data.success) {
      pendingVerifyEmail = email;
      showVerifyEmailForm(email);
      showToast(data.message || 'Verification code sent. Check your email.', 'info');
    } else {
      if (data && data.isGoogleAccount) {
        // ✅ FIX: This email was registered via Google — guide user to Google sign-in
        document.getElementById('suGeneralError').textContent = data.message || 'Please sign in with Google.';
        showToast('This email uses Google Sign-In. Click "Continue with Google" below. 👆', 'info');
      } else if (data && data.requiresVerification) {
        // Account exists but is unverified — show verify form
        pendingVerifyEmail = data.email || email;
        showVerifyEmailForm(data.email || email);
        showToast('Your account exists but is not verified yet. Please enter the code from your email.', 'info');
      } else {
        document.getElementById('suGeneralError').textContent = data.message || 'Sign up failed';
      }
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
// ✅ VERIFY EMAIL + FORGOT PASSWORD UI HELPERS
// ─────────────────────────────────────────────────────────────────────
function showVerifyEmailForm(email) {
  if (tabSignIn) tabSignIn.classList.remove('active');
  if (tabSignUp) tabSignUp.classList.remove('active');
  if (signInForm) signInForm.style.display = 'none';
  if (signUpForm) signUpForm.style.display = 'none';
  if (forgotPasswordForm) forgotPasswordForm.style.display = 'none';
  if (verifyEmailForm) verifyEmailForm.style.display = 'block';
  if (veEmailText) veEmailText.textContent = email || '';
  const code = document.getElementById('veCode');
  if (code) code.value = '';
}

function showForgotPasswordForm(prefillEmail = '') {
  if (tabSignIn) tabSignIn.classList.remove('active');
  if (tabSignUp) tabSignUp.classList.remove('active');
  if (signInForm) signInForm.style.display = 'none';
  if (signUpForm) signUpForm.style.display = 'none';
  if (verifyEmailForm) verifyEmailForm.style.display = 'none';
  if (forgotPasswordForm) forgotPasswordForm.style.display = 'block';
  const fpEmail = document.getElementById('fpEmail');
  if (fpEmail && prefillEmail) fpEmail.value = prefillEmail;
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
  ['siEmailError','siPasswordError','siGeneralError','suNameError','suEmailError','suPasswordError','suConfirmPasswordError','suGeneralError','veCodeError','veGeneralError','fpEmailError','fpGeneralError']
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
}

function switchAuthTab(tab) {
  if (tab === 'signin') {
    tabSignIn?.classList.add('active');
    tabSignUp?.classList.remove('active');
    if (signInForm) signInForm.style.display = 'block';
    if (verifyEmailForm) verifyEmailForm.style.display = 'none';
    if (forgotPasswordForm) forgotPasswordForm.style.display = 'none';
    if (signUpForm) signUpForm.style.display = 'none';
  } else {
    tabSignUp?.classList.add('active');
    tabSignIn?.classList.remove('active');
    if (signUpForm) signUpForm.style.display = 'block';
    if (verifyEmailForm) verifyEmailForm.style.display = 'none';
    if (forgotPasswordForm) forgotPasswordForm.style.display = 'none';
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
// ✅ ORDER HISTORY
// ─────────────────────────────────────────────────────────────────────
async function openOrderHistory() {
  closeDropdown();
  if (!currentUser) { openAuthModal('signin'); return; }
  if (!orderHistoryModal) return;

  orderHistoryModal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  if (orderHistoryList) orderHistoryList.innerHTML = `<div class="products-loading"><div class="spin"></div><p>Loading orders…</p></div>`;

  try {
    const res  = await fetch(`${API_BASE_URL}/api/transactions/my`, {
      headers: { ...authHeaders(), 'Accept': 'application/json' },
    });
    const data = await res.json();

    if (!data.success) {
      orderHistoryList.innerHTML = `<p class="order-empty">Could not load orders. Please try again.</p>`;
      return;
    }

    const orders = data.data || [];
    if (orders.length === 0) {
      orderHistoryList.innerHTML = `
        <div class="order-empty-state">
          <i class="fas fa-shopping-bag"></i>
          <p>No orders yet. Start shopping!</p>
          <button class="btn btn-tertiary" onclick="document.getElementById('orderHistoryModal').style.display='none';document.body.style.overflow='auto';">
            Browse Products
          </button>
        </div>`;
      return;
    }

    orderHistoryList.innerHTML = orders.map(order => {
      const items    = order.metadata?.cart_items || [];
      const date     = new Date(order.paymentDate || order.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
      const itemsSummary = items.map(i => `${i.name} ×${i.quantity || 1}`).join(', ');
      return `
        <div class="order-card">
          <div class="order-card-header">
            <div>
              <span class="order-ref">${order.reference}</span>
              <span class="order-date">${date}</span>
            </div>
            <span class="order-status order-status-${order.status}">${order.status}</span>
          </div>
          <div class="order-card-body">
            <p class="order-items-summary">${itemsSummary || 'Order items'}</p>
            <p class="order-shipping">📍 ${order.metadata?.shipping_state || 'N/A'}</p>
          </div>
          <div class="order-card-footer">
            <strong class="order-total">₦${Number(order.amount || 0).toLocaleString()}</strong>
            <button class="btn-view-receipt" data-ref="${order.reference}" type="button">
              <i class="fas fa-receipt"></i> View Receipt
            </button>
          </div>
        </div>`;
    }).join('');

    // Wire receipt buttons
    orderHistoryList.querySelectorAll('.btn-view-receipt').forEach(btn => {
      btn.addEventListener('click', () => openReceipt(btn.dataset.ref, orders));
    });

  } catch (err) {
    if (orderHistoryList) orderHistoryList.innerHTML = `<p class="order-empty">Error: ${err.message}</p>`;
  }
}

function openReceipt(reference, orders) {
  const order = orders.find(o => o.reference === reference);
  if (!order || !receiptModal || !receiptContent) return;

  const items    = order.metadata?.cart_items || [];
  const date     = new Date(order.paymentDate || order.createdAt).toLocaleDateString('en-NG', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const shipping = order.metadata?.shipping_state || 'N/A';
  const phone    = order.metadata?.customer_phone || order.metadata?.phone || 'N/A';
  const name     = order.metadata?.customer_name  || currentUser?.name   || 'Customer';
  const fee      = Number(order.metadata?.shipping_fee || 0);
  const total    = Number(order.amount || 0);
  const subtotal = total - fee;

  const itemsHtml = items.map(i => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${i.name}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${i.quantity || 1}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">₦${Number(i.price || 0).toLocaleString()}</td>
    </tr>`).join('');

  receiptContent.innerHTML = `
    <div class="receipt-header">
      <h2>Fortune's <span>Hub</span></h2>
      <p class="receipt-subtitle">Order Receipt</p>
    </div>
    <div class="receipt-meta">
      <div><strong>Reference:</strong><code>${reference}</code></div>
      <div><strong>Date:</strong> ${date}</div>
      <div><strong>Customer:</strong> ${name}</div>
      <div><strong>WhatsApp:</strong> ${phone}</div>
      <div><strong>Shipping To:</strong> ${shipping}</div>
      <div><strong>Email:</strong> ${order.email || currentUser?.email || 'N/A'}</div>
    </div>
    <table class="receipt-table" style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead><tr style="background:#f0f2ff;">
        <th style="padding:10px;text-align:left;">Item</th>
        <th style="padding:10px;text-align:center;">Qty</th>
        <th style="padding:10px;text-align:right;">Price</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="receipt-totals">
      <div class="receipt-row"><span>Subtotal</span><span>₦${subtotal.toLocaleString()}</span></div>
      <div class="receipt-row"><span>Shipping</span><span>₦${fee.toLocaleString()}</span></div>
      <div class="receipt-row receipt-grand"><span>Total Paid</span><span>₦${total.toLocaleString()}</span></div>
    </div>
    <p class="receipt-thankyou">Thank you for shopping with Fortune's Hub! 🛒</p>
    <p class="receipt-contact">Questions? WhatsApp: 09033489520 | fortunehabib9@gmail.com</p>`;

  receiptModal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

// ─────────────────────────────────────────────────────────────────────
// LAZY PAYSTACK LOADER (unchanged)
// ─────────────────────────────────────────────────────────────────────
function loadPaystackScript() {
  return new Promise((resolve, reject) => {
    if (paystackScriptLoaded && typeof PaystackPop !== 'undefined') { resolve(); return; }
    if (paystackScriptLoading) { paystackLoadCallbacks.push({ resolve, reject }); return; }
    paystackScriptLoading = true;
    paystackLoadCallbacks.push({ resolve, reject });
    const script = document.createElement('script');
    script.src   = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload  = () => { paystackScriptLoaded = true; paystackScriptLoading = false; paystackLoadCallbacks.forEach(cb => cb.resolve()); paystackLoadCallbacks = []; };
    script.onerror = () => { paystackScriptLoading = false; const err = new Error('Failed to load Paystack SDK.'); paystackLoadCallbacks.forEach(cb => cb.reject(err)); paystackLoadCallbacks = []; };
    document.head.appendChild(script);
  });
}

// ─────────────────────────────────────────────────────────────────────
// LOADING OVERLAY (unchanged)
// ─────────────────────────────────────────────────────────────────────
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
      <p class="loading-info"><i class="fas fa-info-circle"></i> Do not close or go back</p>
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
      .loading-info{font-size:13px;color:#9ca3af;margin:0;display:flex;align-items:center;justify-content:center;gap:8px}
      .loading-info i{color:#667eea}
      @keyframes fadeOutOvl{from{opacity:1}to{opacity:0}}
    </style>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}
function hideLoadingOverlay() {
  const overlay = document.getElementById('paymentLoadingOverlay');
  if (overlay) { overlay.style.animation = 'fadeOutOvl .3s ease'; setTimeout(() => { overlay.remove(); document.body.style.overflow = 'auto'; }, 300); }
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
    const imgSrc  = resolveAssetUrl(item.image || (product && product.image) || '');
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
    if (!currentUser) {
      // ✅ FIX: Show sign-in prompt when user is not logged in
      checkoutButton.disabled = false;
      checkoutButton.innerHTML = '<i class="fas fa-lock"></i> Sign In to Checkout';
      checkoutButton.classList.add('btn-signin-required');
    } else {
      checkoutButton.classList.remove('btn-signin-required');
      const valid = validateCustomerInfo({ silent: true });
      if (!valid) {
        checkoutButton.disabled = true;
        checkoutButton.innerHTML = '<i class="fas fa-info-circle"></i> Complete Info to Continue';
      } else {
        checkoutButton.disabled = false;
        checkoutButton.innerHTML = '<i class="fas fa-credit-card"></i> Proceed to Checkout';
      }
    }
  }
}

function addToCart(productId, quantity = 1) {
  const product = getProductById(productId);
  if (!product || product.outOfStock) { alert('Product is out of stock.'); return; }
  const cartItem = cart.find(item => String(item.id) === String(productId));
  if (cartItem) { cartItem.quantity += quantity; }
  else {
    const rawImg  = product.image || '';
    const safeImg = (rawImg.startsWith('data:') || rawImg.length > 300) ? '' : rawImg;
    cart.push({ id: product.id, name: product.name, price: product.price, quantity, image: safeImg });
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
  // Checkout is account-based: user must be signed in.
  if (!currentUser) return false;

  let isValid = true;
  if (phoneError) phoneError.style.display = 'none';

  const phone = (customerPhoneInput?.value || '').trim();
  const phoneRegex = /^(0[789][01])\d{8}$/;
  if (!phone || !phoneRegex.test(phone)) {
    if (!silent && phoneError) {
      phoneError.textContent = 'Enter a valid Nigerian WhatsApp number (e.g., 08031234567).';
      phoneError.style.display = 'block';
    }
    isValid = false;
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
    // Close dropdown when clicking outside
    if (!e.target.closest('.user-avatar-wrap')) closeDropdown();
  });

  shippingStateSelect?.addEventListener('change', updateCartUI);
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

  checkoutButton?.addEventListener('click', initiatePaystackPayment);

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
  verifyEmailForm?.addEventListener('submit', handleVerifyEmailCode);
  forgotPasswordForm?.addEventListener('submit', handleForgotPassword);
  forgotPasswordLink?.addEventListener('click', () => showForgotPasswordForm(document.getElementById('siEmail')?.value.trim() || ''));
  resendVerificationBtn?.addEventListener('click', resendVerificationCode);
  backToSignInBtn?.addEventListener('click', () => switchAuthTab('signin'));
  fpBackBtn?.addEventListener('click', () => switchAuthTab('signin'));

  userAvatarBtn?.addEventListener('click', e => { e.stopPropagation(); toggleDropdown(); });
  signOutBtn?.addEventListener('click', signOut);
  viewHistoryBtn?.addEventListener('click', openOrderHistory);
  changeAccountBtn?.addEventListener('click', () => { closeCartModal(); openAuthModal('signin'); });
  cartSignInPromptBtn?.addEventListener('click', () => { closeCartModal(); openAuthModal('signin'); });

  // Close order history + receipt modals
  closeOrderHistoryModal?.addEventListener('click', () => { orderHistoryModal.style.display = 'none'; document.body.style.overflow = 'auto'; });
  closeReceiptModal?.addEventListener('click',      () => { receiptModal.style.display = 'none'; document.body.style.overflow = 'auto'; });

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
// ✅ PAYSTACK PAYMENT — sends userId via auth header
// ─────────────────────────────────────────────────────────────────────
async function initiatePaystackPayment() {
  if (cart.length === 0) { alert('Your cart is empty.'); return; }

  // ✅ FIX: Require sign-in before checkout
  if (!currentUser) {
    closeCartModal();
    showToast('Please sign in to complete your purchase. 🔒', 'info');
    openAuthModal('signin');
    return;
  }

  // Logged in — use profile data
  const name  = currentUser.name;
  const email = currentUser.email;
  const phone = (customerPhoneInput?.value || '').trim();

  if (!validateCustomerInfo()) { alert('Please complete all required information correctly.'); return; }

  showLoadingOverlay('Loading payment system…');
  try { await loadPaystackScript(); }
  catch (err) { hideLoadingOverlay(); alert('Could not load payment system: ' + err.message + '\n\nPlease disable ad-blockers or try another network.'); return; }
  if (typeof PaystackPop === 'undefined') { hideLoadingOverlay(); alert('Paystack could not load. Please try again.'); return; }

  const shippingFeeNaira = parseInt(shippingStateSelect?.value || '0', 10) || 0;
  const subtotalNaira    = cart.reduce((sum, item) => sum + Number(item.price || 0) * (item.quantity || 1), 0);
  const totalNaira       = subtotalNaira + shippingFeeNaira;
  if (!Number.isFinite(totalNaira) || totalNaira <= 0) { hideLoadingOverlay(); alert('Invalid total. Please refresh and try again.'); return; }

  const totalKobo = Math.round(totalNaira * 100);
  const metadata  = {
    customer_name:  name,
    customer_email: email,
    customer_phone: phone,
    cart_items:     cart,
    shipping_fee:   shippingFeeNaira,
    shipping_state: shippingStateSelect?.options?.[shippingStateSelect.selectedIndex]?.text || '',
  };

  showLoadingOverlay('Starting payment…');

  fetch(`${API_BASE_URL}/api/payment/initialize`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...authHeaders() },
    body:    JSON.stringify({ email, amount: totalNaira, metadata }),
  })
    .then(r => { if (!r.ok) throw new Error(`Initialize failed (HTTP ${r.status})`); return r.json(); })
    .then(init => {
      if (!init?.success || !init?.access_code) throw new Error(init?.message || 'Failed to initialize transaction');
      if (init.public_key && init.public_key.startsWith('pk_')) PAYSTACK_PUBLIC_KEY = init.public_key;
      hideLoadingOverlay();

      // ✅ FIX: Store reference so we can cancel it if popup is closed
      _pendingPaymentRef = init.reference;

      const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY, email, amount: totalKobo, currency: 'NGN',
        access_code: init.access_code, ref: init.reference, metadata,
        callback: function (response) {
          // Payment completed in Paystack popup — now verify on backend
          _pendingPaymentRef = null; // clear: payment is being verified, not cancelled
          showLoadingOverlay('Verifying your payment…');
          const timeoutId = setTimeout(() => {
            hideLoadingOverlay();
            alert('⏱️ Verification taking longer than expected. Check your email for confirmation.\nReference: ' + response.reference);
          }, 90000);

          fetch(`${API_BASE_URL}/api/payment/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...authHeaders() },
            body:   JSON.stringify({ reference: response.reference }),
          })
            .then(r => { clearTimeout(timeoutId); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(data => {
              hideLoadingOverlay();
              if (data.success) {
                cart = []; localStorage.setItem('cart', JSON.stringify(cart));
                if (customerPhoneInput)  customerPhoneInput.value  = '';
                if (shippingStateSelect) shippingStateSelect.value = '';
                updateCartUI();
                closeCartModal();
                showToast('✅ Payment successful! Check your email for your receipt.', 'success');
                // Auto-open order history for logged-in users
                if (currentUser) setTimeout(openOrderHistory, 800);
              } else {
                alert('⚠️ Payment verification failed: ' + (data.message || 'Unknown error'));
              }
            })
            .catch(err => { clearTimeout(timeoutId); hideLoadingOverlay(); alert('❌ Failed to verify payment. Contact support with reference: ' + response.reference); });
        },
        onClose: function () {
          // ✅ FIX: User closed/cancelled Paystack popup without paying
          // Update status from 'pending' to 'cancelled' on the backend
          const ref = _pendingPaymentRef;
          _pendingPaymentRef = null;
          hideLoadingOverlay();
          if (ref) {
            fetch(`${API_BASE_URL}/api/payment/cancel`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...authHeaders() },
              body: JSON.stringify({ reference: ref }),
            }).catch(() => {}); // silent — best effort
            showToast('Payment cancelled. Your cart is still saved.', 'info');
          }
        },
      });
      handler.openIframe();
    })
    .catch(err => {
      hideLoadingOverlay();
      alert('❌ Could not start payment: ' + (err?.message || 'Unknown error') + '\n\nPossible causes:\n• Backend still waking up (wait 30s)\n• PAYSTACK_SECRET_KEY missing in server env');
    });
}

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
  // ✅ Handle verification-link redirects like:
  //   /?email_verified=1&email=user@example.com
  // This solves the "I verified but I still can't login" confusion.
  try {
    const url = new URL(window.location.href);
    const sp  = url.searchParams;
    if (sp.get('email_verified') === '1') {
      const e = (sp.get('email') || '').trim();
      showToast('✅ Email verified. Please sign in to continue.', 'success');
      openAuthModal('signin');
      if (e) {
        const siEmail = document.getElementById('siEmail');
        if (siEmail) siEmail.value = e;
      }
      // Clean URL (remove params) without reloading
      sp.delete('email_verified');
      sp.delete('email');
      url.search = sp.toString();
      window.history.replaceState({}, document.title, url.toString());
    }
  } catch (_) {}

  // Load persisted auth state
  loadAuthState();
  updateAuthUI();

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


// ─────────────────────────────────────────────────────────────────────
// ✅ VERIFY EMAIL (CODE)
// ─────────────────────────────────────────────────────────────────────
async function handleVerifyEmailCode(e) {
  e.preventDefault();
  const email = (pendingVerifyEmail || '').trim();
  const code  = document.getElementById('veCode')?.value.trim() || '';

  const err = document.getElementById('veCodeError');
  const gen = document.getElementById('veGeneralError');
  if (err) err.textContent = '';
  if (gen) gen.textContent = '';

  if (!email) {
    if (gen) gen.textContent = 'Missing email for verification. Please sign up again.';
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    if (err) err.textContent = 'Enter the 6-digit code.';
    return;
  }

  const t = document.getElementById('veSubmitText');
  const l = document.getElementById('veSubmitLoader');
  const b = document.getElementById('veSubmitBtn');
  if (t) t.style.display = 'none';
  if (l) l.style.display = 'inline-flex';
  if (b) b.disabled = true;


  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/verify-email-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email, code })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Email verified! Please sign in.', 'success');
      const siEmail = document.getElementById('siEmail');
      if (siEmail) siEmail.value = email;
      pendingVerifyEmail = null;
      switchAuthTab('signin');
    } else {
      if (gen) gen.textContent = data.message || 'Verification failed.';
    }
  } catch {
    if (gen) gen.textContent = 'Network error. Please try again.';
  } finally {
    if (t) t.style.display = 'inline';
    if (l) l.style.display = 'none';
    if (b) b.disabled = false;
  }
}

async function resendVerificationCode() {
  const email = (pendingVerifyEmail || '').trim();
  const gen = document.getElementById('veGeneralError');
  if (gen) gen.textContent = '';
  if (!email) { if (gen) gen.textContent = 'Missing email. Please sign up again.'; return; }

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.success) showToast('Verification code sent again. Check your email.', 'info');
    else if (gen) gen.textContent = data.message || 'Could not resend.';
  } catch {
    if (gen) gen.textContent = 'Network error. Please try again.';
  }
}

// ─────────────────────────────────────────────────────────────────────
// ✅ FORGOT PASSWORD
// ─────────────────────────────────────────────────────────────────────
async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('fpEmail')?.value.trim() || '';
  const eErr  = document.getElementById('fpEmailError');
  const gen   = document.getElementById('fpGeneralError');
  if (eErr) eErr.textContent = '';
  if (gen)  gen.textContent  = '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (eErr) eErr.textContent = 'Enter a valid email.';
    return;
  }

  const t = document.getElementById('fpSubmitText');
  const l = document.getElementById('fpSubmitLoader');
  const b = document.getElementById('fpSubmitBtn');
  if (t) t.style.display = 'none';
  if (l) l.style.display = 'inline-flex';
  if (b) b.disabled = true;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.success) {
      showToast('If that email exists, a reset link/code has been sent.', 'info');
      switchAuthTab('signin');
      const siEmail = document.getElementById('siEmail');
      if (siEmail) siEmail.value = email;
    } else {
      if (gen) gen.textContent = data.message || 'Could not send reset email.';
    }
  } catch {
    if (gen) gen.textContent = 'Network error. Please try again.';
  } finally {
    if (t) t.style.display = 'inline';
    if (l) l.style.display = 'none';
    if (b) b.disabled = false;
  }
}
