/**
 * QORTA Frontend - Waiter Dashboard Logic
 */

let menuItems = [];
let cart = [];
let selectedTable = null;
let authToken = null;
let restaurantConfig = null;
let serviceRequests = [];
let serviceRequestPollInterval = null;

// Initialize dashboard
async function init() {
    try {
        // Wait for Firebase auth
        await new Promise((resolve) => {
            firebase.auth().onAuthStateChanged(resolve);
        });

        const user = firebase.auth().currentUser;
        if (!user) {
            window.location.href = window.location.pathname.replace('/waiter', '/waiter-login');
            return;
        }

        // Get auth token
        authToken = await user.getIdToken();

        // Display waiter name
        document.getElementById('waiterName').textContent = user.email;

        // Load data
        await Promise.all([
            loadRestaurantConfig(),
            loadMenuItems()
        ]);

        // Generate table options
        generateTableOptions();

        // Start service request polling
        await loadServiceRequests();
        startServiceRequestPolling();

        // Hide loading overlay
        document.getElementById('authLoading').style.display = 'none';

    } catch (error) {
        alert('Failed to load dashboard. Please login again.');
        window.location.href = window.location.pathname.replace('/waiter', '/waiter-login');
    }
}

// Load restaurant config
async function loadRestaurantConfig() {
    try {
        const response = await api.request('/config');
        restaurantConfig = response.data;

        // Update restaurant name
        document.getElementById('headerLogo').textContent = restaurantConfig.name;
    } catch (error) {
        restaurantConfig = { mode: 'service', taxRate: 0.08, serviceMode: { tableCount: 10 } };
    }
}

// Generate table selection options
function generateTableOptions() {
    const tableCount = restaurantConfig?.serviceMode?.tableCount || 10;
    const assignedTables = restaurantConfig?.assignedTables; // null/undefined = all tables
    const selectEl = document.getElementById('tableSelect');

    // Determine which tables to show
    let tablesToShow = [];
    if (!assignedTables || assignedTables === null) {
        // No restrictions - show all tables (backward compatible)
        for (let i = 1; i <= tableCount; i++) {
            tablesToShow.push(i);
        }
    } else if (assignedTables.length === 0) {
        // Empty array = no table access
        tablesToShow = [];
    } else {
        // Show only assigned tables, sorted
        tablesToShow = [...assignedTables].sort((a, b) => a - b);
    }

    // Populate dropdown with assigned tables
    tablesToShow.forEach(tableNum => {
        const option = document.createElement('option');
        option.value = tableNum;
        option.textContent = `Table ${tableNum}`;
        selectEl.appendChild(option);
    });

    // If no tables available, disable select and show message
    if (tablesToShow.length === 0) {
        selectEl.disabled = true;
        const cartTableInfo = document.getElementById('cartTableInfo');
        if (cartTableInfo) {
            cartTableInfo.innerHTML = '<p style="color: #DC2626;">No tables assigned. Contact admin.</p>';
        }
    }
}

// Handle table selection change
function handleTableChange() {
    const tableSelect = document.getElementById('tableSelect');
    selectedTable = tableSelect.value ? parseInt(tableSelect.value) : null;

    // Update UI
    const indicator = document.getElementById('tableIndicator');
    const cartTableInfo = document.getElementById('cartTableInfo');
    const submitBtn = document.getElementById('submitOrderBtn');

    if (selectedTable) {
        indicator.textContent = `Table ${selectedTable} selected`;
        indicator.style.display = 'inline-block';
        cartTableInfo.innerHTML = `<strong>Table ${selectedTable}</strong>`;
        submitBtn.disabled = cart.length === 0;
    } else {
        indicator.style.display = 'none';
        cartTableInfo.innerHTML = '<p>No table selected</p>';
        submitBtn.disabled = true;
    }
}

// Load menu items
async function loadMenuItems() {
    try {
        const response = await api.request('/menu');
        menuItems = response.data || [];
        renderMenu();
    } catch (error) {
        alert('Failed to load menu items');
    }
}

// Render menu
function renderMenu() {
    const container = document.getElementById('menuSections');
    container.innerHTML = menuItems.map(item => `
        <div class="menu-item-card" onclick="addToCart('${item.id}')">
            <div class="menu-item-info">
                <h4>${item.name}</h4>
                <p class="item-price">$${item.price.toFixed(2)}</p>
            </div>
            <button class="add-btn">+</button>
        </div>
    `).join('');
}

// Add item to cart
function addToCart(itemId) {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;

    const existingItem = cart.find(i => i.menuItemId === itemId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            menuItemId: itemId,
            name: item.name,
            price: item.price,
            quantity: 1
        });
    }

    updateCartDisplay();
}

// Update cart display
function updateCartDisplay() {
    const cartItemsEl = document.getElementById('cartItems');
    const submitBtn = document.getElementById('submitOrderBtn');

    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="empty-cart">No items added yet</p>';
        submitBtn.disabled = true;
        updateTotals();
        return;
    }

    cartItemsEl.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-price">$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
            <div class="quantity-controls">
                <button class="qty-btn" onclick="changeQuantity('${item.menuItemId}', -1)">−</button>
                <span class="qty">${item.quantity}</span>
                <button class="qty-btn" onclick="changeQuantity('${item.menuItemId}', 1)">+</button>
            </div>
        </div>
    `).join('');

    submitBtn.disabled = !selectedTable;
    updateTotals();
}

// Change item quantity
function changeQuantity(itemId, delta) {
    const item = cart.find(i => i.menuItemId === itemId);
    if (!item) return;

    item.quantity += delta;

    if (item.quantity <= 0) {
        cart = cart.filter(i => i.menuItemId !== itemId);
    }

    updateCartDisplay();
}

// Update totals
function updateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = restaurantConfig?.taxRate || 0.08;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    document.getElementById('cartSubtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('cartTax').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('cartTotal').textContent = `$${total.toFixed(2)}`;
}

// Clear cart
function clearCart() {
    if (cart.length === 0) return;
    if (!confirm('Clear all items from cart?')) return;

    cart = [];
    updateCartDisplay();
}

// Submit order
async function submitOrder() {
    if (!selectedTable || cart.length === 0) return;

    const submitBtn = document.getElementById('submitOrderBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
        const orderData = {
            items: cart.map(i => ({
                menuItemId: i.menuItemId,
                quantity: i.quantity,
                modifiers: []
            })),
            orderType: 'DINE_IN',
            tableNumber: selectedTable,
            customerName: 'Service Order',
            notes: ''
        };

        const response = await fetch(api.baseUrl + `/api/${api.tenantSlug}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            throw new Error('Failed to submit order');
        }

        const result = await response.json();

        // Show success overlay
        document.getElementById('orderNumberText').textContent = `Order #${result.data.orderNumber}`;
        document.getElementById('successOverlay').classList.add('show');

        // Reset
        cart = [];
        selectedTable = null;
        document.getElementById('tableSelect').value = '';
        handleTableChange();
        updateCartDisplay();

        // Hide success overlay after 2 seconds
        setTimeout(() => {
            document.getElementById('successOverlay').classList.remove('show');
        }, 2000);

        submitBtn.textContent = 'Submit Order';
    } catch (error) {
        alert('Failed to submit order: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Order';
    }
}

// Load service requests
async function loadServiceRequests() {
    try {
        const response = await fetch(api.baseUrl + `/api/${api.tenantSlug}/orders/service-requests`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Service requests fetch failed:', response.status, errorData);
            return;
        }

        const result = await response.json();
        serviceRequests = result.data || [];
        console.log('Service requests loaded:', serviceRequests.length);
        renderServiceRequests();
    } catch (error) {
        console.error('Error loading service requests:', error);
    }
}

// Start polling for service requests
function startServiceRequestPolling() {
    // Poll every 5 seconds
    serviceRequestPollInterval = setInterval(loadServiceRequests, 5000);
}

// Stop polling
function stopServiceRequestPolling() {
    if (serviceRequestPollInterval) {
        clearInterval(serviceRequestPollInterval);
        serviceRequestPollInterval = null;
    }
}

// Render service requests
function renderServiceRequests() {
    const panel = document.getElementById('serviceRequestsPanel');
    const list = document.getElementById('serviceRequestsList');
    const countEl = document.getElementById('requestCount');

    console.log('Rendering service requests:', serviceRequests.length);

    if (!panel || !list || !countEl) {
        console.error('Service request panel elements not found');
        return;
    }

    if (serviceRequests.length === 0) {
        panel.style.display = 'none';
        return;
    }

    // Show panel
    panel.style.display = 'block';
    countEl.textContent = serviceRequests.length;

    // Render requests
    list.innerHTML = serviceRequests.map(request => {
        const createdAt = new Date(request.createdAt);
        const timeAgo = getTimeAgo(createdAt);

        return `
            <div class="service-request-card">
                <div class="request-info">
                    <div class="request-table">Table ${request.tableNumber}</div>
                    <div class="request-time">${timeAgo}</div>
                </div>
                <button class="btn-primary btn-resolve" onclick="resolveServiceRequest('${request.id}')">
                    Resolve
                </button>
            </div>
        `;
    }).join('');
}

// Resolve service request
async function resolveServiceRequest(requestId) {
    try {
        console.log('Resolving service request:', requestId);
        const response = await fetch(api.baseUrl + `/api/${api.tenantSlug}/orders/service-requests/${requestId}/resolve`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Failed to resolve service request:', errorData);
            throw new Error('Failed to resolve service request');
        }

        console.log('Service request resolved successfully');

        // Remove from local state
        serviceRequests = serviceRequests.filter(r => r.id !== requestId);
        renderServiceRequests();
    } catch (error) {
        console.error('Error resolving service request:', error);
        alert('Failed to resolve service request: ' + error.message);
    }
}

// Toggle service requests panel
function toggleServiceRequests() {
    const panel = document.getElementById('serviceRequestsPanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
    } else {
        panel.style.display = 'none';
    }
}

// Get time ago string
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'Just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// Handle logout
async function handleLogout() {
    if (!confirm('Logout from waiter dashboard?')) return;

    try {
        stopServiceRequestPolling();
        await firebase.auth().signOut();
        window.location.href = window.location.pathname.replace('/waiter', '/waiter-login');
    } catch (error) {
        alert('Logout failed');
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);
