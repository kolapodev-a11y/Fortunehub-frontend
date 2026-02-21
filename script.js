// Configuration
const API_BASE_URL = 'http://localhost:3000/api'; // Change to your server URL in production

// DOM Elements
let paymentModal, loadingOverlay, successModal, errorModal;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeModals();
  setupEventListeners();
});

// Initialize modals
function initializeModals() {
  // Create loading overlay
  loadingOverlay = createLoadingOverlay();
  document.body.appendChild(loadingOverlay);

  // Create success modal
  successModal = createSuccessModal();
  document.body.appendChild(successModal);

  // Create error modal
  errorModal = createErrorModal();
  document.body.appendChild(errorModal);
}

// Create loading overlay with progress indicator
function createLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'payment-loading-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(5px);
  `;

  overlay.innerHTML = `
    <div style="text-align: center; color: white; padding: 40px; background: rgba(255,255,255,0.1); border-radius: 20px; max-width: 400px;">
      <div class="spinner" style="
        border: 5px solid rgba(255,255,255,0.3);
        border-top: 5px solid #fff;
        border-radius: 50%;
        width: 60px;
        height: 60px;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      "></div>
      <h3 id="loading-title" style="margin: 20px 0 10px; font-size: 24px;">Processing Payment...</h3>
      <p id="loading-message" style="margin: 10px 0; opacity: 0.9; font-size: 16px;">
        Please wait while we verify your payment
      </p>
      <div id="loading-progress" style="margin-top: 20px;">
        <div style="background: rgba(255,255,255,0.2); height: 8px; border-radius: 4px; overflow: hidden;">
          <div id="progress-bar" style="
            background: linear-gradient(90deg, #4CAF50, #8BC34A);
            height: 100%;
            width: 0%;
            transition: width 0.3s ease;
            border-radius: 4px;
          "></div>
        </div>
        <p id="progress-text" style="margin-top: 10px; font-size: 14px; opacity: 0.8;">
          Verifying... 0%
        </p>
      </div>
      <p style="margin-top: 20px; font-size: 13px; opacity: 0.7;">
        ⏱️ This may take up to 60 seconds<br>
        Please do not close this window
      </p>
    </div>
  `;

  // Add spinner animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);

  return overlay;
}

// Create success modal
function createSuccessModal() {
  const modal = document.createElement('div');
  modal.id = 'payment-success-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 10001;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      padding: 40px;
      border-radius: 20px;
      text-align: center;
      max-width: 500px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    ">
      <div style="
        width: 80px;
        height: 80px;
        background: #4CAF50;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
        animation: scaleIn 0.5s ease;
      ">
        <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h2 style="color: #4CAF50; margin: 20px 0;">Payment Successful!</h2>
      <p id="success-message" style="color: #666; margin: 15px 0; font-size: 16px;">
        Your payment has been processed successfully.
      </p>
      <div id="payment-details" style="
        background: #f5f5f5;
        padding: 20px;
        border-radius: 10px;
        margin: 20px 0;
        text-align: left;
      "></div>
      <button onclick="closeSuccessModal()" style="
        background: #4CAF50;
        color: white;
        border: none;
        padding: 15px 40px;
        border-radius: 25px;
        font-size: 16px;
        cursor: pointer;
        margin-top: 10px;
        transition: all 0.3s ease;
      " onmouseover="this.style.background='#45a049'" onmouseout="this.style.background='#4CAF50'">
        Continue
      </button>
    </div>
  `;

  return modal;
}

// Create error modal
function createErrorModal() {
  const modal = document.createElement('div');
  modal.id = 'payment-error-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 10001;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      padding: 40px;
      border-radius: 20px;
      text-align: center;
      max-width: 500px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    ">
      <div style="
        width: 80px;
        height: 80px;
        background: #f44336;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
      ">
        <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </div>
      <h2 style="color: #f44336; margin: 20px 0;">Payment Failed</h2>
      <p id="error-message" style="color: #666; margin: 15px 0; font-size: 16px;"></p>
      <button onclick="closeErrorModal()" style="
        background: #f44336;
        color: white;
        border: none;
        padding: 15px 40px;
        border-radius: 25px;
        font-size: 16px;
        cursor: pointer;
        margin-top: 20px;
        transition: all 0.3s ease;
      " onmouseover="this.style.background='#da190b'" onmouseout="this.style.background='#f44336'">
        Try Again
      </button>
    </div>
  `;

  return modal;
}

// Setup event listeners
function setupEventListeners() {
  // Example: Payment button
  const paymentBtn = document.getElementById('payment-btn');
  if (paymentBtn) {
    paymentBtn.addEventListener('click', initiatePayment);
  }
}

// Initialize payment
async function initiatePayment() {
  try {
    // Get payment details from form
    const email = document.getElementById('email')?.value;
    const amount = document.getElementById('amount')?.value;
    const customerName = document.getElementById('customer-name')?.value;
    const phoneNumber = document.getElementById('phone')?.value;

    // Validation
    if (!email || !amount) {
      showError('Please fill in all required fields');
      return;
    }

    if (!validateEmail(email)) {
      showError('Please enter a valid email address');
      return;
    }

    if (amount <= 0) {
      showError('Please enter a valid amount');
      return;
    }

    // Show loading
    showLoading('Initializing payment...', 0);

    // Initialize payment
    const response = await fetch(`${API_BASE_URL}/payment/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: parseFloat(amount),
        customerName,
        phoneNumber,
        metadata: {
          // Add any additional metadata
        }
      })
    });

    const data = await response.json();

    if (data.success) {
      // Store reference for verification
      sessionStorage.setItem('payment_reference', data.data.reference);
      
      // Redirect to Paystack
      window.location.href = data.data.authorization_url;
    } else {
      hideLoading();
      showError(data.message || 'Payment initialization failed');
    }
  } catch (error) {
    hideLoading();
    console.error('Payment initialization error:', error);
    showError('An error occurred. Please try again.');
  }
}

// Verify payment (call this after redirect back from Paystack)
async function verifyPayment(reference) {
  if (!reference) {
    reference = sessionStorage.getItem('payment_reference') || getUrlParameter('reference');
  }

  if (!reference) {
    showError('No payment reference found');
    return;
  }

  // Show loading with progress
  showLoading('Verifying your payment...', 10);

  let attempts = 0;
  const maxAttempts = 20; // Maximum 20 attempts (60 seconds with 3-second intervals)
  const verificationInterval = 3000; // 3 seconds

  const verifyLoop = async () => {
    try {
      attempts++;
      const progress = Math.min(10 + (attempts * 4), 95); // Progress from 10% to 95%
      updateLoadingProgress(progress, `Verifying payment... Attempt ${attempts}/${maxAttempts}`);

      const response = await fetch(`${API_BASE_URL}/payment/verify/${reference}`);
      const data = await response.json();

      if (data.success && data.data.status === 'success') {
        // Payment successful
        updateLoadingProgress(100, 'Payment verified!');
        setTimeout(() => {
          hideLoading();
          showSuccess(data.data);
          sessionStorage.removeItem('payment_reference');
        }, 500);
        return;
      }

      // Check if max attempts reached
      if (attempts >= maxAttempts) {
        hideLoading();
        showError('Payment verification timeout. Please contact support with reference: ' + reference);
        return;
      }

      // Continue polling
      setTimeout(verifyLoop, verificationInterval);

    } catch (error) {
      console.error('Verification error:', error);
      
      if (attempts >= maxAttempts) {
        hideLoading();
        showError('Unable to verify payment. Please contact support with reference: ' + reference);
        return;
      }

      // Retry on error
      setTimeout(verifyLoop, verificationInterval);
    }
  };

  // Start verification loop
  verifyLoop();
}

// Show loading overlay
function showLoading(message = 'Processing...', progress = 0) {
  const overlay = document.getElementById('payment-loading-overlay');
  const title = document.getElementById('loading-title');
  const msg = document.getElementById('loading-message');
  
  if (title) title.textContent = message;
  if (msg) msg.textContent = 'Please wait while we process your request';
  
  updateLoadingProgress(progress, 'Initializing...');
  overlay.style.display = 'flex';
}

// Update loading progress
function updateLoadingProgress(percentage, message) {
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  
  if (progressBar) {
    progressBar.style.width = percentage + '%';
  }
  
  if (progressText) {
    progressText.textContent = message || `Processing... ${percentage}%`;
  }
}

// Hide loading overlay
function hideLoading() {
  const overlay = document.getElementById('payment-loading-overlay');
  overlay.style.display = 'none';
}

// Show success modal
function showSuccess(data) {
  const modal = document.getElementById('payment-success-modal');
  const detailsDiv = document.getElementById('payment-details');
  
  detailsDiv.innerHTML = `
    <p style="margin: 8px 0;"><strong>Reference:</strong> ${data.reference}</p>
    <p style="margin: 8px 0;"><strong>Amount:</strong> ₦${data.amount.toLocaleString()}</p>
    <p style="margin: 8px 0;"><strong>Email:</strong> ${data.email}</p>
    ${data.customerName ? `<p style="margin: 8px 0;"><strong>Name:</strong> ${data.customerName}</p>` : ''}
    <p style="margin: 8px 0;"><strong>Payment Method:</strong> ${data.paymentMethod || 'N/A'}</p>
    <p style="margin: 8px 0;"><strong>Date:</strong> ${new Date(data.paidAt).toLocaleString()}</p>
  `;
  
  modal.style.display = 'flex';
  
  // Call success callback if defined
  if (window.onPaymentSuccess) {
    window.onPaymentSuccess(data);
  }
}

// Close success modal
function closeSuccessModal() {
  const modal = document.getElementById('payment-success-modal');
  modal.style.display = 'none';
}

// Show error modal
function showError(message) {
  const modal = document.getElementById('payment-error-modal');
  const errorMessage = document.getElementById('error-message');
  
  errorMessage.textContent = message;
  modal.style.display = 'flex';
  
  // Call error callback if defined
  if (window.onPaymentError) {
    window.onPaymentError(message);
  }
}

// Close error modal
function closeErrorModal() {
  const modal = document.getElementById('payment-error-modal');
  modal.style.display = 'none';
}

// Utility: Validate email
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Utility: Get URL parameter
function getUrlParameter(name) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
  const results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Auto-verify on page load if reference exists
window.addEventListener('load', () => {
  const reference = getUrlParameter('reference') || sessionStorage.getItem('payment_reference');
  if (reference && getUrlParameter('trxref')) {
    // Likely returning from Paystack
    verifyPayment(reference);
  }
});

// Export functions for global use
window.initiatePayment = initiatePayment;
window.verifyPayment = verifyPayment;
window.closeSuccessModal = closeSuccessModal;
window.closeErrorModal = closeErrorModal;
