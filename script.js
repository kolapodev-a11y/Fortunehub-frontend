// Admin Panel JavaScript

let adminPassword = '';
let currentDeleteId = '';

// DOM Elements
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loginErrorText = document.getElementById('loginErrorText');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const transactionsBody = document.getElementById('transactionsBody');
const totalTransactionsEl = document.getElementById('totalTransactions');
const completedTransactionsEl = document.getElementById('completedTransactions');
const totalAmountEl = document.getElementById('totalAmount');

// Modal Elements
const clearConfirmModal = document.getElementById('clearConfirmModal');
const clearConfirmInput = document.getElementById('clearConfirmInput');
const confirmClearBtn = document.getElementById('confirmClearBtn');
const cancelClearBtn = document.getElementById('cancelClearBtn');

const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const deleteTransactionId = document.getElementById('deleteTransactionId');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

// Alert Elements
const alertSuccess = document.getElementById('alertSuccess');
const alertSuccessText = document.getElementById('alertSuccessText');
const alertError = document.getElementById('alertError');
const alertErrorText = document.getElementById('alertErrorText');

// API Base URL
const API_BASE_URL = window.location.origin;

// Show Alert
function showAlert(type, message) {
    if (type === 'success') {
        alertSuccessText.textContent = message;
        alertSuccess.classList.add('active');
        alertError.classList.remove('active');
        setTimeout(() => {
            alertSuccess.classList.remove('active');
        }, 5000);
    } else {
        alertErrorText.textContent = message;
        alertError.classList.add('active');
        alertSuccess.classList.remove('active');
        setTimeout(() => {
            alertError.classList.remove('active');
        }, 5000);
    }
}

// Login Form Handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;
    
    try {
        // Verify password by trying to fetch transactions
        const response = await fetch(`${API_BASE_URL}/api/admin/transactions?password=${encodeURIComponent(password)}`);
        
        if (response.ok) {
            adminPassword = password;
            loginSection.style.display = 'none';
            dashboardSection.classList.add('active');
            loginError.classList.remove('active');
            loadTransactions();
        } else {
            loginErrorText.textContent = 'Invalid password. Please try again.';
            loginError.classList.add('active');
        }
    } catch (error) {
        console.error('Login error:', error);
        loginErrorText.textContent = 'Connection error. Please try again.';
        loginError.classList.add('active');
    }
});

// Logout Handler
logoutBtn.addEventListener('click', () => {
    adminPassword = '';
    loginSection.style.display = 'block';
    dashboardSection.classList.remove('active');
    document.getElementById('adminPassword').value = '';
    transactionsBody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-inbox"></i><p>No transactions found</p></td></tr>';
});

// Refresh Button Handler
refreshBtn.addEventListener('click', () => {
    refreshBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Loading...';
    loadTransactions();
});

// Load Transactions
async function loadTransactions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/transactions?password=${encodeURIComponent(adminPassword)}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();
        displayTransactions(data);
        updateStats(data);
        
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
    } catch (error) {
        console.error('Error loading transactions:', error);
        showAlert('error', 'Failed to load transactions');
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
    }
}

// Display Transactions
function displayTransactions(data) {
    const { transactions } = data;
    
    if (!transactions || transactions.length === 0) {
        transactionsBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No transactions found</p>
                </td>
            </tr>
        `;
        return;
    }

    transactionsBody.innerHTML = transactions.map(transaction => {
        const date = new Date(transaction.createdAt).toLocaleString();
        const statusClass = transaction.status.toLowerCase();
        const payerInfo = transaction.payerName || transaction.payerEmail || 'N/A';
        
        return `
            <tr>
                <td><code style="font-size: 12px;">${transaction.id}</code></td>
                <td><strong>$${parseFloat(transaction.amount).toFixed(2)}</strong> ${transaction.currency || 'USD'}</td>
                <td><span class="status-badge ${statusClass}">${transaction.status}</span></td>
                <td>${transaction.description || 'Payment'}</td>
                <td><small>${date}</small></td>
                <td><small>${payerInfo}</small></td>
                <td>
                    <button class="btn btn-danger btn-sm delete-transaction" 
                            data-transaction-id="${transaction.id}"
                            title="Delete this transaction">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Attach delete event listeners
    attachDeleteListeners();
}

// Update Stats
function updateStats(data) {
    const { transactions, totalAmount } = data;
    const completedCount = transactions.filter(t => t.status === 'COMPLETED').length;
    
    totalTransactionsEl.textContent = transactions.length;
    completedTransactionsEl.textContent = completedCount;
    totalAmountEl.textContent = `$${totalAmount.toFixed(2)}`;
}

// Clear All Button Handler
clearAllBtn.addEventListener('click', () => {
    clearConfirmModal.classList.add('active');
    clearConfirmInput.value = '';
    clearConfirmInput.focus();
});

// Cancel Clear
cancelClearBtn.addEventListener('click', () => {
    clearConfirmModal.classList.remove('active');
    clearConfirmInput.value = '';
});

// Confirm Clear All
confirmClearBtn.addEventListener('click', async () => {
    const confirmText = clearConfirmInput.value.trim();
    
    if (confirmText !== 'DELETE ALL') {
        showAlert('error', 'Please type "DELETE ALL" exactly to confirm');
        clearConfirmInput.focus();
        return;
    }

    try {
        confirmClearBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
        confirmClearBtn.disabled = true;

        const response = await fetch(`${API_BASE_URL}/api/admin/transactions/clear`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                password: adminPassword, 
                confirmText: 'DELETE ALL' 
            })
        });

        const data = await response.json();

        if (response.ok) {
            showAlert('success', data.message);
            clearConfirmModal.classList.remove('active');
            clearConfirmInput.value = '';
            loadTransactions();
        } else {
            showAlert('error', data.error || 'Failed to clear transactions');
        }
    } catch (error) {
        console.error('Error clearing transactions:', error);
        showAlert('error', 'Error clearing transactions');
    } finally {
        confirmClearBtn.innerHTML = '<i class="fas fa-trash"></i> Confirm Delete';
        confirmClearBtn.disabled = false;
    }
});

// Attach Delete Listeners
function attachDeleteListeners() {
    const deleteButtons = document.querySelectorAll('.delete-transaction');
    deleteButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const transactionId = e.currentTarget.dataset.transactionId;
            currentDeleteId = transactionId;
            deleteTransactionId.textContent = transactionId;
            deleteConfirmModal.classList.add('active');
        });
    });
}

// Cancel Delete
cancelDeleteBtn.addEventListener('click', () => {
    deleteConfirmModal.classList.remove('active');
    currentDeleteId = '';
});

// Confirm Delete Single Transaction
confirmDeleteBtn.addEventListener('click', async () => {
    if (!currentDeleteId) return;

    try {
        confirmDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
        confirmDeleteBtn.disabled = true;

        const response = await fetch(`${API_BASE_URL}/api/admin/transactions/${currentDeleteId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: adminPassword })
        });

        const data = await response.json();

        if (response.ok) {
            showAlert('success', data.message);
            deleteConfirmModal.classList.remove('active');
            currentDeleteId = '';
            loadTransactions();
        } else {
            showAlert('error', data.error || 'Failed to delete transaction');
        }
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showAlert('error', 'Error deleting transaction');
    } finally {
        confirmDeleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
        confirmDeleteBtn.disabled = false;
    }
});

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === clearConfirmModal) {
        clearConfirmModal.classList.remove('active');
        clearConfirmInput.value = '';
    }
    if (e.target === deleteConfirmModal) {
        deleteConfirmModal.classList.remove('active');
        currentDeleteId = '';
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // ESC to close modals
    if (e.key === 'Escape') {
        clearConfirmModal.classList.remove('active');
        deleteConfirmModal.classList.remove('active');
        clearConfirmInput.value = '';
        currentDeleteId = '';
    }
    
    // Enter in clear confirm input
    if (e.key === 'Enter' && document.activeElement === clearConfirmInput) {
        confirmClearBtn.click();
    }
});

// Auto-refresh every 30 seconds (optional)
setInterval(() => {
    if (dashboardSection.classList.contains('active')) {
        loadTransactions();
    }
}, 30000);

console.log('Admin Panel loaded successfully');
