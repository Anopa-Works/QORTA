/**
 * QORTA Frontend - Checkout Page Logic
 */

let orderType = 'dine-in'; // Default order type

function init() {
    renderCart();
    setupCartListener();
    selectOrderType('dine-in'); // Initialize default

    // Fix Empty Cart "Browse Menu" button to respect tenant
    const browseBtn = document.getElementById('browseMenuBtn');
    if (browseBtn) {
        browseBtn.onclick = () => {
            const slug = (window.api && window.api.tenantSlug) ? window.api.tenantSlug : 'burger-palace';
            // If slug is burger-palace, go to root (or index.html)
            // If strictly burger-palace, we can go to index.html or /burger-palace
            // But to be safe and consistent with other fixes:
            if (slug && slug !== 'burger-palace') {
                window.location.href = `/${slug}`;
            } else {
                window.location.href = 'index.html';
            }
        };
    }
}

// Select order type
function selectOrderType(type) {
    orderType = type;

    // Update button states
    document.querySelectorAll('.order-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    // Show/hide relevant sections
    const tableSection = document.getElementById('tableSection');
    const deliverySection = document.getElementById('deliverySection');

    if (tableSection) {
        tableSection.style.display = type === 'dine-in' ? 'block' : 'none';
    }

    if (deliverySection) {
        deliverySection.style.display = type === 'delivery' ? 'block' : 'none';
    }
}

function renderCart() {
    const items = cart.getItems();
    const orderItemsContainer = document.getElementById('orderItems');
    const emptyCart = document.getElementById('emptyCart');
    const priceSummary = document.getElementById('priceSummary');
    const checkoutFooter = document.getElementById('checkoutFooter');

    if (!items || items.length === 0) {
        if (orderItemsContainer) orderItemsContainer.style.display = 'none';
        if (priceSummary) priceSummary.style.display = 'none';
        if (checkoutFooter) checkoutFooter.style.display = 'none';
        if (emptyCart) emptyCart.style.display = 'block';
        return;
    }

    if (orderItemsContainer) orderItemsContainer.style.display = 'block';
    if (priceSummary) priceSummary.style.display = 'block';
    if (checkoutFooter) checkoutFooter.style.display = 'block';
    if (emptyCart) emptyCart.style.display = 'none';

    if (orderItemsContainer)
        orderItemsContainer.innerHTML = items.map((item, index) => createOrderItemHTML(item, index)).join('');

    updatePriceSummary();
}

function createOrderItemHTML(item, index) {
    const itemTotal = (item.unitPrice + item.modifierPrices.reduce((a, b) => a + b, 0)) * item.quantity;
    const modifiersText = item.modifiers.length > 0 ? item.modifiers.join(', ') : '';
    const imageUrl = item.imageUrl || `https://placehold.co/80x80/EDF2F7/718096?text=${encodeURIComponent(item.name)}`;

    return `
    <div class="order-item">
      <img src="${imageUrl}" alt="${item.name}" class="item-image" onerror="this.style.display='none'">
      <div class="item-details">
        <div class="item-header">
          <h3 class="item-name">${item.name}</h3>
          <span class="item-price">$${itemTotal.toFixed(2)}</span>
        </div>
        ${modifiersText ? `<p class="item-modifiers">+ ${modifiersText}</p>` : ''}
        <div class="quantity-control">
          <button class="quantity-btn" onclick="decrementQuantity(${index})">−</button>
          <span class="quantity-value">${item.quantity}</span>
          <button class="quantity-btn" onclick="incrementQuantity(${index})">+</button>
        </div>
      </div>
    </div>
  `;
}

function updatePriceSummary() {
    const subtotal = cart.getSubtotal();
    const tax = cart.getTax();
    const total = cart.getTotal();

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('tax').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
}

function incrementQuantity(index) {
    const items = cart.getItems();
    cart.updateQuantity(index, items[index].quantity + 1);
}

function decrementQuantity(index) {
    const items = cart.getItems();
    cart.updateQuantity(index, items[index].quantity - 1);
}

function setupCartListener() {
    cart.onChange(() => {
        renderCart();
    });
}

// Clear validation errors
function clearValidationErrors() {
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('.text-input, .table-input').forEach(el => el.classList.remove('error'));
}

// Show validation error
function showError(inputId, errorId) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    if (input) input.classList.add('error');
    if (error) error.classList.add('show');
}

// Validate order form
function validateOrder() {
    clearValidationErrors();
    let isValid = true;

    if (orderType === 'dine-in') {
        const tableNumber = document.getElementById('tableNumber')?.value;
        if (!tableNumber) {
            showError('tableNumber', 'tableError');
            isValid = false;
        }
    }

    if (orderType === 'delivery') {
        const address = document.getElementById('deliveryAddress')?.value.trim();
        const phone = document.getElementById('deliveryPhone')?.value.trim();

        if (!address) {
            showError('deliveryAddress', 'addressError');
            isValid = false;
        }
        if (!phone) {
            showError('deliveryPhone', 'phoneError');
            isValid = false;
        }
    }

    return isValid;
}

async function confirmOrder() {
    const items = cart.getItems();
    if (items.length === 0) return;

    // Validate form
    if (!validateOrder()) return;

    const confirmBtn = document.querySelector('.confirm-btn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner"></span> Processing...';

    let orderData = null; // Declare here for catch block access

    try {
        // Get form values
        const tableNumber = document.getElementById('tableNumber')?.value || null;
        const customerName = document.getElementById('customerName')?.value.trim() || 'Guest';
        const orderNotes = document.getElementById('orderNotes')?.value.trim() || '';
        const deliveryAddress = document.getElementById('deliveryAddress')?.value.trim() || '';
        const deliveryPhone = document.getElementById('deliveryPhone')?.value.trim() || '';

        // Map order type to backend format
        const orderTypeMap = {
            'dine-in': 'DINE_IN',
            'takeaway': 'TAKEOUT',
            'delivery': 'DELIVERY'
        };

        orderData = {
            items: items.map(item => ({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                modifiers: item.modifiers,
                modifierPrices: item.modifierPrices
            })),
            orderType: orderTypeMap[orderType] || 'DINE_IN',
            tableNumber: orderType === 'dine-in' ? parseInt(tableNumber) : null,
            customerName: customerName,
            notes: orderNotes,
            deliveryAddress: orderType === 'delivery' ? deliveryAddress : null,
            deliveryPhone: orderType === 'delivery' ? deliveryPhone : null
        };

        const response = await api.createOrder(orderData);

        // Save order to local history
        saveOrderToHistory(response.data);

        cart.clear();

        // Show success overlay
        const successOverlay = document.getElementById('successOverlay');
        if (successOverlay) {
            successOverlay.classList.add('show');
        }

        // Auto-redirect to tracking page after 3.5 seconds
        setTimeout(() => {
            window.location.href = `track.html?order=${response.data.id}`;
        }, 3500);

    } catch (error) {
        console.error('Order failed:', error);
        console.error('Error details:', error.message);
        console.error('Order data sent:', JSON.stringify(orderData, null, 2));

        // DEBUGGING: Show error visibly
        alert('ORDER FAILED\n\nError: ' + error.message + '\n\nOrder Type: ' + orderData.orderType + '\n\nCheck console for full details (F12)');

        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Confirm Order';

        // Show detailed error message
        const errorMsg = error.message || 'Failed to place order. Please try again.';
        showErrorToast(errorMsg);
    }
}

// Show error toast notification
function showErrorToast(message) {
    // Remove existing toast
    const existingToast = document.querySelector('.error-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <path d="M15 9l-6 6M9 9l6 6" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>${message}</span>
    `;
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: #dc2626;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(toast);

    // Remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Save order ID to localStorage for order history
function saveOrderToHistory(order) {
    const historyKey = 'qorta_order_history';
    let history = JSON.parse(localStorage.getItem(historyKey) || '[]');

    // Add new order to beginning
    history.unshift({
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        itemCount: order.items?.length || 0,
        createdAt: new Date().toISOString()
    });

    // Keep only last 20 orders
    history = history.slice(0, 20);

    localStorage.setItem(historyKey, JSON.stringify(history));
}

// Clear cart manually
function clearCart() {
    if (confirm('Are you sure you want to clear your cart?')) {
        cart.clear();
        renderCart();
    }
}

document.addEventListener('DOMContentLoaded', init);
