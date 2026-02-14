// Product data - embedded for GitHub Pages compatibility
const productsData = [
  {
    "id": 1,
    "name": "Wireless Bluetooth Headphones",
    "price": 59999.00,
    "category": "accessories",
    "description": "Premium wireless headphones with noise cancellation, 30-hour battery life, and superior sound quality.",
    "image": "images/product1.jpg",
    "images": ["images/product1.jpg", "images/product1b.jpg", "images/product1c.jpg"],
    "tag": "new",
    "outOfStock": false,
    "sold": false,
    "statusIndicator": "new"
  },
  {
    "id": 2,
    "name": "Iphone 14 Pro Max",
    "price": 599990.00,
    "category": "phones",
    "description": "The latest flagship phone with a stunning display and 5G capability.",
    "image": "images/product2.jpg",
    "images": ["images/product2.jpg", "images/product2b.jpg", "images/product2c.jpg"],
    "tag": "sale",
    "outOfStock": false,
    "sold": false,
    "statusIndicator": "sale"
  },
  {
    "id": 3,
    "name": "Super Fast Charger",
    "price": 24999.00,
    "category": "accessories",
    "description": "30W USB-C fast charger compatible with all modern smartphones.",
    "image": "images/product3.jpg",
    "images": ["images/product3.jpg", "images/product3b.jpg", "images/product3c.jpg"],
    "tag": "none",
    "outOfStock": false,
    "sold": false,
    "statusIndicator": "available"
  },
  {
    "id": 4,
    "name": "Gaming Laptop X1",
    "price": 950000.00,
    "category": "laptops",
    "description": "High-performance laptop for professional gaming and content creation.",
    "image": "images/product4.jpg",
    "images": ["images/product4.jpg", "images/product4b.jpg", "images/product4c.jpg"],
    "tag": "none",
    "outOfStock": true,
    "sold": false,
    "statusIndicator": "outofstock"
  },
  {
    "id": 5,
    "name": "Portable Bluetooth Speaker",
    "price": 45000.00,
    "category": "speakers",
    "description": "Loud and clear portable speaker with waterproof rating.",
    "image": "images/product5.jpg",
    "images": ["images/product5.jpg", "images/product5b.jpg", "images/product5c.jpg"],
    "tag": "none",
    "outOfStock": false,
    "sold": true,
    "statusIndicator": "available"
  },
  {
    "id": 6,
    "name": "Smart Watch Series 7",
    "price": 70000.00,
    "category": "watches",
    "description": "Feature-rich smartwatch with health monitoring.",
    "image": "images/product6.jpg",
    "images": ["images/product6.jpg", "images/product6b.jpg", "images/product6c.jpg"],
    "tag": "sale",
    "outOfStock": false,
    "sold": false,
    "statusIndicator": "sale"
  },
  {
    "id": 7,
    "name": "Playstation Portal",
    "price": 340000.00,
    "category": "games",
    "description": "Sony PlayStation Portal Remote Player - PlayStation 5",
    "image": "images/product7.jpg",
    "images": ["images/product7.jpg", "images/product7b.jpg", "images/product7c.jpg"],
    "tag": "sale",
    "outOfStock": false,
    "sold": false,
    "statusIndicator": "sale"
  },
  {
    "id": 8,
    "name": "Wireless Bluetooth Headphones (Budget)",
    "price": 20000.00,
    "category": "accessories",
    "description": "Affordable wireless headphones with 20-hour battery life.",
    "image": "images/product8.jpg",
    "images": ["images/product8.jpg", "images/product8b.jpg", "images/product8c.jpg"],
    "tag": "sale",
    "outOfStock": false,
    "sold": false,
    "statusIndicator": "sale"
  }
];

// Global variables
let allProducts = [];
let filteredProducts = [];
let cart = [];
let currentFilter = 'all';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Initialize application
function initializeApp() {
    // Load products from embedded data
    allProducts = productsData;
    filteredProducts = [...allProducts];
    
    // Load cart from localStorage
    loadCart();
    
    // Display products
    displayProducts(filteredProducts);
    
    // Setup event listeners
    setupEventListeners();
    
    // Hide loading state
    document.getElementById('loadingState').style.display = 'none';
}

// Setup event listeners
function setupEventListeners() {
    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.getAttribute('data-filter');
            filterProducts(currentFilter);
        });
    });
    
    // Category cards
    const categoryCards = document.querySelectorAll('.category-card');
    categoryCards.forEach(card => {
        card.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            scrollToProducts();
            setTimeout(() => {
                const filterBtn = document.querySelector(`[data-filter="${category}"]`);
                if (filterBtn) {
                    filterBtn.click();
                }
            }, 500);
        });
    });
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', function() {
        searchProducts(this.value);
    });
    
    // Cart button
    const cartBtn = document.querySelector('.cart-btn');
    cartBtn.addEventListener('click', openCartModal);
    
    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    menuToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
    });
    
    // Modal close on outside click
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// Scroll to search section
function scrollToSearch() {
    const searchSection = document.getElementById('search-section');
    searchSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Focus on search input after scrolling
    setTimeout(() => {
        document.getElementById('searchInput').focus();
    }, 500);
}

// Scroll to products section
function scrollToProducts() {
    const productsSection = document.getElementById('products');
    productsSection.scrollIntoView({ behavior: 'smooth' });
}

// Scroll to categories section
function scrollToCategories() {
    const categoriesSection = document.getElementById('categories');
    categoriesSection.scrollIntoView({ behavior: 'smooth' });
}

// Display products
function displayProducts(products) {
    const productsGrid = document.getElementById('productsGrid');
    const noProducts = document.getElementById('noProducts');
    
    productsGrid.innerHTML = '';
    
    if (products.length === 0) {
        noProducts.style.display = 'flex';
        return;
    }
    
    noProducts.style.display = 'none';
    
    products.forEach(product => {
        const productCard = createProductCard(product);
        productsGrid.appendChild(productCard);
    });
}

// Create product card
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    // Status indicator
    let statusBadge = '';
    if (product.outOfStock) {
        statusBadge = '<span class="status-badge out-of-stock">Out of Stock</span>';
    } else if (product.tag === 'new') {
        statusBadge = '<span class="status-badge new">New</span>';
    } else if (product.tag === 'sale') {
        statusBadge = '<span class="status-badge sale">Sale</span>';
    }
    
    card.innerHTML = `
        ${statusBadge}
        <div class="product-image">
            <img src="${product.image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/300x300?text=Product+Image'">
            <div class="product-overlay">
                <button class="btn-icon" onclick="viewProduct(${product.id})" title="Quick View">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        </div>
        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-description">${product.description.substring(0, 60)}...</p>
            <div class="product-footer">
                <span class="product-price">₦${formatPrice(product.price)}</span>
                <button class="btn-add-cart" onclick="addToCart(${product.id})" ${product.outOfStock ? 'disabled' : ''}>
                    <i class="fas fa-shopping-cart"></i>
                    ${product.outOfStock ? 'Out of Stock' : 'Add to Cart'}
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// Filter products
function filterProducts(filter) {
    if (filter === 'all') {
        filteredProducts = [...allProducts];
    } else {
        filteredProducts = allProducts.filter(product => product.category === filter);
    }
    
    displayProducts(filteredProducts);
}

// Search products
function searchProducts(query) {
    const searchQuery = query.toLowerCase().trim();
    
    if (searchQuery === '') {
        filteredProducts = currentFilter === 'all' 
            ? [...allProducts] 
            : allProducts.filter(p => p.category === currentFilter);
    } else {
        const baseProducts = currentFilter === 'all' 
            ? allProducts 
            : allProducts.filter(p => p.category === currentFilter);
            
        filteredProducts = baseProducts.filter(product => 
            product.name.toLowerCase().includes(searchQuery) ||
            product.description.toLowerCase().includes(searchQuery) ||
            product.category.toLowerCase().includes(searchQuery)
        );
    }
    
    displayProducts(filteredProducts);
}

// Add to cart
function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    
    if (!product || product.outOfStock) {
        return;
    }
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }
    
    saveCart();
    updateCartCount();
    showNotification('Product added to cart!');
}

// Remove from cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartCount();
    displayCart();
}

// Update cart quantity
function updateCartQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    
    if (item) {
        item.quantity += change;
        
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            displayCart();
        }
    }
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('fortunehub_cart', JSON.stringify(cart));
}

// Load cart from localStorage
function loadCart() {
    const savedCart = localStorage.getItem('fortunehub_cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartCount();
    }
}

// Update cart count
function updateCartCount() {
    const cartCount = document.querySelector('.cart-count');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    
    if (totalItems > 0) {
        cartCount.style.display = 'flex';
    } else {
        cartCount.style.display = 'none';
    }
}

// Open cart modal
function openCartModal() {
    const modal = document.getElementById('cartModal');
    modal.classList.add('active');
    displayCart();
}

// Close cart modal
function closeCartModal() {
    const modal = document.getElementById('cartModal');
    modal.classList.remove('active');
}

// Display cart
function displayCart() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-cart"><i class="fas fa-shopping-cart"></i><p>Your cart is empty</p></div>';
        cartTotal.textContent = '₦0.00';
        return;
    }
    
    let total = 0;
    cartItems.innerHTML = '';
    
    cart.forEach(item => {
        total += item.price * item.quantity;
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/80x80?text=Product'">
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p class="cart-item-price">₦${formatPrice(item.price)}</p>
            </div>
            <div class="cart-item-quantity">
                <button onclick="updateCartQuantity(${item.id}, -1)">-</button>
                <span>${item.quantity}</span>
                <button onclick="updateCartQuantity(${item.id}, 1)">+</button>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${item.id})">
                <i class="fas fa-trash"></i>
            </button>
        `;
        cartItems.appendChild(cartItem);
    });
    
    cartTotal.textContent = `₦${formatPrice(total)}`;
}

// View product detail
function viewProduct(productId) {
    const product = allProducts.find(p => p.id === productId);
    
    if (!product) return;
    
    const modal = document.getElementById('productModal');
    const productDetail = document.getElementById('productDetail');
    
    let statusBadge = '';
    if (product.outOfStock) {
        statusBadge = '<span class="status-badge out-of-stock">Out of Stock</span>';
    } else if (product.tag === 'new') {
        statusBadge = '<span class="status-badge new">New</span>';
    } else if (product.tag === 'sale') {
        statusBadge = '<span class="status-badge sale">Sale</span>';
    }
    
    productDetail.innerHTML = `
        <div class="product-detail-images">
            <div class="main-image">
                ${statusBadge}
                <img src="${product.image}" alt="${product.name}" id="mainProductImage" onerror="this.src='https://via.placeholder.com/500x500?text=Product+Image'">
            </div>
            <div class="thumbnail-images">
                ${product.images.map(img => `
                    <img src="${img}" alt="${product.name}" onclick="changeMainImage('${img}')" onerror="this.src='https://via.placeholder.com/100x100?text=Image'">
                `).join('')}
            </div>
        </div>
        <div class="product-detail-info">
            <h2>${product.name}</h2>
            <p class="product-detail-price">₦${formatPrice(product.price)}</p>
            <p class="product-detail-description">${product.description}</p>
            <div class="product-detail-actions">
                <button class="btn btn-primary" onclick="addToCart(${product.id}); closeProductModal();" ${product.outOfStock ? 'disabled' : ''}>
                    <i class="fas fa-shopping-cart"></i>
                    ${product.outOfStock ? 'Out of Stock' : 'Add to Cart'}
                </button>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
}

// Close product modal
function closeProductModal() {
    const modal = document.getElementById('productModal');
    modal.classList.remove('active');
}

// Change main product image
function changeMainImage(imageSrc) {
    const mainImage = document.getElementById('mainProductImage');
    mainImage.src = imageSrc;
}

// Format price
function formatPrice(price) {
    return price.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}
