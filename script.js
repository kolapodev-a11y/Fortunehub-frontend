
// ===================================================
// 1. DATA AND CONSTANTS
// ===================================================

let products = []; 
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// DOM Elements
const productsGrid = document.getElementById('productsGrid');
const cartCount = document.getElementById('cartCount');
const cartModal = document.getElementById('cartModal');
const closeModal = document.getElementById('closeCartModal');
const cartItemsContainer = document.getElementById('cartItems');
const cartTotalElement = document.getElementById('cartTotal');
const cartSubTotalElement = document.getElementById('cartSubTotal');
const shippingFeeAmountElement = document.getElementById('shippingFeeAmount');
const checkoutButton = document.getElementById('checkoutButton');
const continueShoppingButton = document.getElementById('continueShoppingButton');
const filterButtons = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('searchInput');
const categoryCards = document.querySelectorAll('.category-card');
const cartIcon = document.getElementById('cartIcon');

// Customer info fields
const customerNameInput = document.getElementById('customerName');
const customerEmailInput = document.getElementById('customerEmail');
const customerPhoneInput = document.getElementById('customerPhone');
const shippingStateSelect = document.getElementById('shippingState');

// Error elements
const nameError = document.getElementById('nameError');
const emailError = document.getElementById('emailError');
const phoneError = document.getElementById('phoneError');

// ✅ CORRECT: Use only TEST PUBLIC KEY in frontend
const PAYSTACK_PUBLIC_KEY = 'pk_test_9f6a5cb45aeab4bd8bccd72129beda47f2609921';

// 🔑 CORRECT NGROK URL (NO EXTRA SPACES)
const API_BASE_URL = `https://fortunehub-backend.onrender.com`;

// ===================================================
// 2. CORE E-COMMERCE LOGIC
// ===================================================

function getProductById(id) {
    return products.find(p => p.id === id); 
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount) cartCount.textContent = totalItems;

    cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align: center; color: #555;">Your cart is empty.</p>';
        if (checkoutButton) checkoutButton.disabled = true;
        return;
    }

    cart.forEach(item => {
        const itemHTML = `
            <div class="cart-item">
                <div class="item-details">
                    <img src="${item.image}" alt="${item.name}">
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
        cartItemsContainer.insertAdjacentHTML('beforeend', itemHTML);
    });

    document.querySelectorAll('.btn-quantity').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const change = parseInt(e.currentTarget.dataset.change);
            updateQuantity(id, change);
        });
    });

    document.querySelectorAll('.remove-item').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            removeItem(id);
        });
    });

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const selectedShippingFeeNaira = parseInt(shippingStateSelect?.value || '0');
    const shippingFee = cart.length > 0 ? selectedShippingFeeNaira * 100 : 0;
    const grandTotal = subtotal + shippingFee;

    if (cartSubTotalElement) cartSubTotalElement.textContent = formatCurrency(subtotal);
    if (shippingFeeAmountElement) shippingFeeAmountElement.textContent = formatCurrency(shippingFee);
    if (cartTotalElement) cartTotalElement.textContent = (grandTotal / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });

    // Update checkout button state with comprehensive validation
    if (checkoutButton) {
        const isValid = validateCustomerInfo({ silent: true });
        const name = customerNameInput?.value?.trim() || '';
        const email = customerEmailInput?.value?.trim() || '';
        const phone = customerPhoneInput?.value?.trim() || '';
        
        if (!isValid || !name || !email || !phone) {
            checkoutButton.disabled = true;
            checkoutButton.textContent = 'Complete Info to Continue';
        } else {
            checkoutButton.disabled = false;
            checkoutButton.textContent = 'Proceed to Checkout';
        }
    }
}

function validateCustomerInfo({ silent = false } = {}) {
    let isValid = true;

    // Reset errors
    if (nameError) nameError.style.display = 'none';
    if (emailError) emailError.style.display = 'none';
    if (phoneError) phoneError.style.display = 'none';

    const name = customerNameInput?.value?.trim() || '';
    const email = customerEmailInput?.value?.trim() || '';
    const phone = customerPhoneInput?.value?.trim() || '';
    const stateValue = shippingStateSelect?.value || '';

    // Name validation - must be at least 3 characters and not an email
    if (!name || name.length < 3) {
        if (!silent && nameError) {
            nameError.textContent = 'Full name is required (at least 3 characters)';
            nameError.style.display = 'block';
        }
        isValid = false;
    } else if (name.includes('@') || name.includes('.') || name === 'Valued Customer') {
        if (!silent && nameError) {
            nameError.textContent = 'Please enter your actual name, not email address';
            nameError.style.display = 'block';
        }
        isValid = false;
    }

    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
        if (!silent && emailError) {
            emailError.textContent = 'Email address is required';
            emailError.style.display = 'block';
        }
        isValid = false;
    } else if (!emailRegex.test(email)) {
        if (!silent && emailError) {
            emailError.textContent = 'Please enter a valid email address (e.g., name@example.com)';
            emailError.style.display = 'block';
        }
        isValid = false;
    } else {
        // Additional check for common typos
        const commonTypos = ['@gamil.com', '@gnail.com', '@gamil.com', '@yaho.com', '@hotmal.com'];
        const hasTypo = commonTypos.some(typo => email.toLowerCase().includes(typo));
        
        if (hasTypo && !silent && emailError) {
            emailError.textContent = 'Did you mean to use @gmail.com? Please check your email address.';
            emailError.style.display = 'block';
            isValid = false;
        }
    }

    // Phone validation - Nigerian format
    const phoneRegex = /^(0[789][01])\d{8}$/;
    if (!phone) {
        if (!silent && phoneError) {
            phoneError.textContent = 'Phone number is required';
            phoneError.style.display = 'block';
        }
        isValid = false;
    } else if (!phoneRegex.test(phone)) {
        if (!silent && phoneError) {
            phoneError.textContent = 'Please enter a valid Nigerian phone number(Whatsapp) (e.g., 08031234567)';
            phoneError.style.display = 'block';
        }
        isValid = false;
    }

    // State validation
    if (!stateValue) {
        isValid = false;
    }

    return isValid;
}

function addToCart(productId, quantity = 1) {
    const product = getProductById(productId);
    if (!product || product.outOfStock) {
        alert('Product is out of stock.');
        return;
    }

    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += quantity;
    } else {
        cart.push({
            id: productId,
            name: product.name,
            price: product.price,
            quantity: quantity,
            image: product.image
        });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    alert(`${product.name} added to cart!`);
}

function updateQuantity(productId, change) {
    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            cart = cart.filter(item => item.id !== productId);
        }
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
}

function removeItem(productId) {
    cart = cart.filter(item => item.id !== productId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
}

function formatCurrency(amountInKobo) {
    return `₦${(amountInKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

// ===================================================
// UPDATED: displayProducts — NOW WITH 3-IMAGE SLIDER
// ===================================================

function displayProducts(productsToShow) {
    if (!productsGrid) return;
    productsGrid.innerHTML = '';

    productsToShow.forEach(product => {
        const isSold = product.sold;
        const isOutOfStock = product.outOfStock;

        let badgeClass = 'hidden';
        let badgeText = '';

        if (isSold) {
            badgeClass = 'badge-sold';
            badgeText = 'SOLD';
        } else if (product.tag === 'new') {
            badgeClass = 'badge-new';
            badgeText = 'NEW';
        } else if (product.tag === 'sale') {
            badgeClass = 'badge-sale';
            badgeText = 'SALE';
        }

        let buttonText = 'Add to Cart';
        let buttonClass = 'btn-add-to-cart add-to-cart';
        let buyNowText = 'Buy Now';
        let buyNowClass = 'btn-buy-now buy-now';
        let isDisabled = '';

        if (isSold) {
            buttonText = 'SOLD';
            buttonClass = 'btn-sold';
            buyNowText = 'SOLD';
            buyNowClass = 'btn-sold';
            isDisabled = 'disabled';
        } else if (isOutOfStock) {
            buttonText = 'Out of Stock';
            buttonClass = 'btn-secondary';
            buyNowText = 'Out of Stock';
            buyNowClass = 'btn-secondary';
            isDisabled = 'disabled';
        }

        // Use images array if available; fallback to single image repeated
        const images = Array.isArray(product.images) && product.images.length >= 3
            ? product.images.slice(0, 3)
            : [product.image, product.image, product.image];

        const productHTML = `
            <div class="product-card" data-category="${product.category}" data-images='${JSON.stringify(images)}'>
                <div class="product-image-slider">
                    <img src="${images[0]}" alt="${product.name}" class="product-main-img">
                    <div class="product-thumbnails">
                        <img src="${images[0]}" alt="1" class="thumb active" data-index="0">
                        <img src="${images[1]}" alt="2" class="thumb" data-index="1">
                        <img src="${images[2]}" alt="3" class="thumb" data-index="2">
                    </div>
                    ${badgeClass !== 'hidden' ? `<span class="product-badge ${badgeClass}">${badgeText}</span>` : ''} 
                </div>
                <div class="product-info">
                    <p class="product-category">${product.category}</p>
                    <h3 class="product-title">${product.name}</h3>
                    <p class="product-price">${formatCurrency(product.price)}</p>
                    <p class="product-description">${product.description}</p>
                    <div class="product-actions">
                        <button class="btn ${buttonClass}" ${isDisabled} data-id="${product.id}">${buttonText}</button>
                        <button class="btn ${buyNowClass}" ${isDisabled} data-id="${product.id}">${buyNowText}</button>
                    </div>
                </div>
            </div>
        `;
        productsGrid.insertAdjacentHTML('beforeend', productHTML);
    });

    attachProductButtonEvents();
    attachThumbnailEvents(); // 👈 NEW: enables image switching
}

// ===================================================
// NEW: Handle thumbnail clicks to change main image
// ===================================================

function attachThumbnailEvents() {
    document.querySelectorAll('.product-thumbnails .thumb').forEach(thumb => {
        thumb.addEventListener('click', function () {
            const container = this.closest('.product-card');
            const mainImg = container.querySelector('.product-main-img');
            const index = this.dataset.index;
            const images = JSON.parse(container.dataset.images);

            mainImg.src = images[index];

            // Update active state
            container.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });
}
    attachProductButtonEvents();
}

function filterProducts(category) {
    if (!products || products.length === 0) return;
    const filtered = category === "all" 
        ? products 
        : products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    displayProducts(filtered);
}

function searchProducts(query) {
    const text = query.toLowerCase();
    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(text) ||
        p.category.toLowerCase().includes(text) ||
        p.description.toLowerCase().includes(text)
    );
    displayProducts(filtered);
}

function attachProductButtonEvents() {
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            addToCart(id);
        });
    });

    document.querySelectorAll('.buy-now').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            addToCart(id, 1);
            openCartModal();
        });
    });
}

document.getElementById('searchIcon')?.addEventListener('click', function () {
    const input = document.getElementById('searchInput');
    if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
    }
});


// ===================================================
// 4. PAYSTACK INTEGRATION — FINAL FIXED VERSION
// ===================================================

function initiatePaystackPayment() {
    console.log('🚀 initiatePaystackPayment called');

    if (cart.length === 0) {
        alert('Your cart is empty.');
        return;
    }

    // Debug logging of form field values
    console.log('🔍 Form Field Values Before Payment:');
    console.log('Name field:', customerNameInput?.value);
    console.log('Email field:', customerEmailInput?.value);
    console.log('Phone field:', customerPhoneInput?.value);
    console.log('State field:', shippingStateSelect?.value);

    // Get values with proper trimming
    const name = (customerNameInput?.value || '').trim();
    const email = (customerEmailInput?.value || '').trim();
    const phone = (customerPhoneInput?.value || '').trim();
    
    // Enhanced validation for name field - prevent email as name
    if (!name || name.length < 3) {
        alert('Please enter your full name (at least 3 characters) to continue with payment.');
        if (customerNameInput) customerNameInput.focus();
        return;
    }
    
    if (name.includes('@') || name.includes('.') || name === 'Valued Customer') {
        alert('Please enter your actual name, not your email address.');
        if (customerNameInput) customerNameInput.focus();
        return;
    }
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Please enter a valid email address before proceeding to payment.');
        if (customerEmailInput) customerEmailInput.focus();
        return;
    }
    
    if (!phone || !/^(0[789][01])\d{8}$/.test(phone)) {
        alert('Please enter a valid Nigerian phone number (e.g., 08031234567) to continue.');
        if (customerPhoneInput) customerPhoneInput.focus();
        return;
    }

    if (!validateCustomerInfo()) {
        alert('Please complete all required information in the shipping section.');
        return;
    }

    const stateOption = shippingStateSelect.options[shippingStateSelect.selectedIndex];
    const shippingState = (stateOption?.textContent?.split('—')[0]?.trim() || 'Unknown');
    const shippingFeeNaira = parseInt(shippingStateSelect.value) || 0;

    const productNames = cart.map(item => item.name).join(', ') || 'Unknown Product';
    const subtotalKobo = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingKobo = shippingFeeNaira * 100;
    const totalKobo = subtotalKobo + shippingKobo;

    // ✅ CRITICAL: Validate amount is number
    if (typeof totalKobo !== 'number' || isNaN(totalKobo) || totalKobo <= 0) {
        console.error('❌ Invalid amount:', totalKobo);
        alert('Invalid payment amount. Please try again.');
        return;
    }

    // ✅ SAFE META: No undefined/null values - ENHANCED FOR CORRECT DATA HANDLING
    const safeMeta = {
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        shipping_state: shippingState,
        shipping_fee: shippingFeeNaira,
        products: productNames,
        cart_items: cart.map(item => ({
            id: item.id || 0,
            name: item.name || 'Unknown Item',
            price: item.price || 0,
            quantity: item.quantity || 1,
            image: item.image || ''
        })),
        product_names: productNames
    };

    console.log('📦 Meta Data Being Sent to Paystack:', safeMeta);
    console.log('👤 Customer Name from form:', name);
    console.log('📧 Customer Email from form:', email);
    console.log('💰 Amount (kobo):', totalKobo);

    const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: email,
        amount: totalKobo,
        metadata: safeMeta,
        callback: function(response) {
            console.log('✅ Paystack callback triggered with reference:', response.reference);

            // ✅ FIXED VERIFICATION ENDPOINT (NO EXTRA SPACES)
            fetch(`${API_BASE_URL}/api/verify-payment`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ reference: response.reference })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('✅ Verification response:', data);
                
                if (data.message && data.message.includes('email sent')) {
                    alert('✅ Order placed! We’ll contact you shortly.');
                    cart = [];
                    localStorage.setItem('cart', JSON.stringify(cart));
                    if (customerNameInput) customerNameInput.value = '';
                    if (customerEmailInput) customerEmailInput.value = '';
                    if (customerPhoneInput) customerPhoneInput.value = '';
                    if (shippingStateSelect) shippingStateSelect.value = '';
                    updateCartUI();
                    closeCartModal();
                } else if (data.error) {
                    alert('⚠️ ' + data.error);
                } else {
                    alert('⚠️ Payment verification failed. Please contact support.');
                }
            })
            .catch(err => {
                console.error('❌ Verification failed:', err);
                alert('❌ Failed to verify payment. Please try again. Error: ' + err.message);
            });
        },
        onClose: function() {
            console.log('CloseOperation');
            if (nameError) nameError.style.display = 'none';
            if (emailError) emailError.style.display = 'none';
            if (phoneError) phoneError.style.display = 'none';
        }
    });
    handler.openIframe();
}


// ===================================================
// 5. MODAL CONTROL
// ===================================================

function openCartModal() {
    if (cartModal) {
        cartModal.style.display = 'block';
        updateCartUI();
        if (customerNameInput && !customerNameInput.value) customerNameInput.focus();
        else if (customerEmailInput && !customerEmailInput.value) customerEmailInput.focus();
    }
}

function closeCartModal() {
    if (cartModal) cartModal.style.display = 'none';
}


// ===================================================
// 6. INITIALIZATION — GUARANTEED TO RUN EVENT LISTENERS
// ===================================================

async function initializeApp() {
    try {
        const response = await fetch('products.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        products = await response.json();
    } catch (e) {
        console.warn('⚠️ products.json not loaded. Using empty list.');
        products = [];
    }

    // ✅ These must run regardless of product load
    displayProducts(products);
    setupEventListeners();
    updateCartUI();
}

function setupEventListeners() {
    // Input validation listeners (critical!)
    if (customerNameInput) customerNameInput.addEventListener('input', () => validateCustomerInfo({ silent: true }));
    if (customerEmailInput) customerEmailInput.addEventListener('input', () => validateCustomerInfo({ silent: true }));
    if (customerPhoneInput) customerPhoneInput.addEventListener('input', () => validateCustomerInfo({ silent: true }));
    if (shippingStateSelect) shippingStateSelect.addEventListener('change', updateCartUI);

    // UI listeners
    if (filterButtons) {
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                filterProducts(button.dataset.category);
            });
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => searchProducts(e.target.value));
    }

    if (cartIcon) cartIcon.addEventListener('click', openCartModal);
    if (checkoutButton) checkoutButton.addEventListener('click', initiatePaystackPayment);
    if (closeModal) closeModal.addEventListener('click', closeCartModal);
    if (continueShoppingButton) continueShoppingButton.addEventListener('click', closeCartModal);

    window.addEventListener('click', (e) => {
        if (cartModal && e.target === cartModal) closeCartModal();
    });

    if (categoryCards) {
        categoryCards.forEach(card => {
            card.addEventListener('click', () => {
                const category = card.dataset.category;
                filterProducts(category);
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.category === category) btn.classList.add('active');
                });
                document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }
}

// 🚀 Start the app — only after DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
