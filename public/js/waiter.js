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
let ordersReady = [];
let ordersReadyPollInterval = null;
let audioCtx = null;
let waiterEventSource = null;
// Track by IDs (not counts) to avoid race conditions in rapid polling
let seenServiceRequestIds = new Set();
let seenReadyOrderIds = new Set();

// Initialize Audio Context
function initAudio() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    } catch (e) {
        // Audio not supported
    }
}

// Play service request chime (880Hz - high-pitched single ding)
function playServiceRequestChime() {
    if (!audioCtx) initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5 note
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
}

// Play kitchen ready chime (1046Hz - high C, two dings)
function playKitchenReadyChime() {
    if (!audioCtx) initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (!audioCtx) return;

    const now = audioCtx.currentTime;

    // First ding (high C)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046, now); // C6 note
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Second ding (slightly delayed)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046, now + 0.15);
    gain2.gain.setValueAtTime(0.35, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.65);
}

// Vibrate 3 times (gbm gbm gbm pattern)
function vibrateThreeTimes() {
    if ('vibrate' in navigator) {
        // Pattern: vibrate 200ms, pause 100ms, vibrate 200ms, pause 100ms, vibrate 200ms
        navigator.vibrate([200, 100, 200, 100, 200]);
    }
}

// Initialize dashboard
async function init() {
    try {
        // Initialize audio on first user interaction
        document.addEventListener('click', initAudio, { once: true });

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

        // Connect SSE for real-time ORDER_READY push from kitchen
        await setupWaiterSSE();

        // Start service request polling
        await loadServiceRequests();
        previousServiceRequestCount = serviceRequests.length;
        startServiceRequestPolling();

        // Start ready orders polling
        await loadReadyOrders();
        previousReadyOrderCount = ordersReady.length;
        startReadyOrdersPolling();

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
        // Always get a fresh token — the cached authToken expires after 1 hour
        // and optionalAuth silently drops req.user on expiry, causing waiterName to be null
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) throw new Error('Not authenticated');
        const freshToken = await currentUser.getIdToken();

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
                'Authorization': `Bearer ${freshToken}`
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

        if (!response.ok) return;

        const result = await response.json();
        const newServiceRequests = result.data || [];

        // Detect genuinely NEW requests by ID — avoids race conditions from count comparison
        const hasNewRequest = newServiceRequests.some(r => r.id && !seenServiceRequestIds.has(r.id));
        if (hasNewRequest && seenServiceRequestIds.size > 0) {
            playServiceRequestChime();
            vibrateThreeTimes();
        }

        // Update the seen IDs to the current active set
        seenServiceRequestIds = new Set(newServiceRequests.map(r => r.id).filter(Boolean));
        serviceRequests = newServiceRequests;
        renderServiceRequests();
    } catch (error) {
        // Network error — will retry on next poll
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

    if (!panel || !list || !countEl) return;

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
        const response = await fetch(api.baseUrl + `/api/${api.tenantSlug}/orders/service-requests/${requestId}/resolve`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) throw new Error('Failed to resolve service request');

        // Remove from local state and update seen IDs
        serviceRequests = serviceRequests.filter(r => r.id !== requestId);
        seenServiceRequestIds.delete(requestId);
        renderServiceRequests();
    } catch (error) {
        alert('Failed to resolve service request. Please try again.');
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

// Load ready orders
async function loadReadyOrders() {
    try {
        const response = await fetch(api.baseUrl + `/api/${api.tenantSlug}/orders/ready-for-pickup`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) return;

        const result = await response.json();
        const newReadyOrders = result.data || [];

        // Detect genuinely NEW ready orders by ID — avoids race conditions
        const hasNewOrder = newReadyOrders.some(o => o.id && !seenReadyOrderIds.has(o.id));
        if (hasNewOrder && seenReadyOrderIds.size > 0) {
            playKitchenReadyChime();
        }

        // Update the seen IDs to the current active set
        seenReadyOrderIds = new Set(newReadyOrders.map(o => o.id).filter(Boolean));
        ordersReady = newReadyOrders;
        renderReadyOrders();
    } catch (error) {
        // Network error — will retry on next poll
    }
}

// Start polling for ready orders
function startReadyOrdersPolling() {
    // Poll every 5 seconds
    ordersReadyPollInterval = setInterval(loadReadyOrders, 5000);
}

// Stop ready orders polling
function stopReadyOrdersPolling() {
    if (ordersReadyPollInterval) {
        clearInterval(ordersReadyPollInterval);
        ordersReadyPollInterval = null;
    }
}

// Render ready orders panel
function renderReadyOrders() {
    const panel = document.getElementById('ordersReadyPanel');
    const list = document.getElementById('ordersReadyList');
    const countEl = document.getElementById('readyOrdersCount');

    if (!panel || !list || !countEl) return;

    if (ordersReady.length === 0) {
        panel.style.display = 'none';
        return;
    }

    // Show panel
    panel.style.display = 'block';
    countEl.textContent = ordersReady.length;

    // Render ready orders
    list.innerHTML = ordersReady.map(order => {
        const createdAt = new Date(order.createdAt);
        const timeAgo = getTimeAgo(createdAt);
        const tableInfo = order.tableNumber ? `Table ${order.tableNumber}` : 'Takeout';

        return `
            <div class="ready-order-card">
                <div class="order-info">
                    <div class="order-number">Order #${order.orderNumber}</div>
                    <div class="order-table">${tableInfo}</div>
                    <div class="order-time">${timeAgo}</div>
                </div>
                <button class="btn-primary btn-pickup" onclick="pickupOrder('${order.id}')">
                    Pick Up
                </button>
            </div>
        `;
    }).join('');
}

// Pick up order (mark as complete)
async function pickupOrder(orderId) {
    try {
        const response = await fetch(api.baseUrl + `/api/${api.tenantSlug}/orders/${orderId}/pickup`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) throw new Error('Failed to pick up order');

        // Remove from local state and update seen IDs
        ordersReady = ordersReady.filter(o => o.id !== orderId);
        seenReadyOrderIds.delete(orderId);
        renderReadyOrders();
    } catch (error) {
        alert('Failed to pick up order. Please try again.');
    }
}

// Toggle ready orders panel
function toggleReadyOrders() {
    const panel = document.getElementById('ordersReadyPanel');
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

// Setup SSE stream to receive ORDER_READY pushes from kitchen in real-time
async function setupWaiterSSE() {
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) return;

        const token = await currentUser.getIdToken();

        waiterEventSource = api.createWaiterStream(
            token,
            (data) => handleWaiterSSEMessage(data),
            () => {
                // On error, retry after 10 seconds (polling still running as fallback)
                waiterEventSource = null;
                setTimeout(setupWaiterSSE, 10000);
            }
        );
    } catch (error) {
        // SSE unavailable — polling remains the fallback
    }
}

// Handle incoming SSE messages from the server
function handleWaiterSSEMessage(data) {
    if (data.type === 'ORDER_READY') {
        const order = data.order;
        // Only act if this order isn't already shown
        if (order.id && !seenReadyOrderIds.has(order.id)) {
            seenReadyOrderIds.add(order.id);
            ordersReady.push(order);
            renderReadyOrders();
            playKitchenReadyChime();
        }
    }
}

// Handle logout
async function handleLogout() {
    if (!confirm('Logout from waiter dashboard?')) return;

    try {
        stopServiceRequestPolling();
        stopReadyOrdersPolling();
        if (waiterEventSource) {
            waiterEventSource.close();
            waiterEventSource = null;
        }
        await firebase.auth().signOut();
        window.location.href = window.location.pathname.replace('/waiter', '/waiter-login');
    } catch (error) {
        alert('Logout failed');
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);
