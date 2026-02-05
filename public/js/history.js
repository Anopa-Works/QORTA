/**
 * QORTA Frontend - Order History Logic
 */

// Initialize page
async function init() {
    // FIX: Rewrite back links to avoid resetting session to Burger Palace
    // We check API first, then localStorage as fallback
    const slug = (window.api && window.api.tenantSlug) ? window.api.tenantSlug : localStorage.getItem('qorta_tenant_slug');

    if (slug) {
        const tenantUrl = `/${slug}`;
        document.querySelectorAll('a[href="index.html"]').forEach(link => {
            link.href = tenantUrl;
            // Remove any other click handlers to ensure href works
            link.onclick = null;
        });

        // Also fix the empty state Browse Menu button if it exists
        document.querySelectorAll('a.btn-primary[href="index.html"]').forEach(link => {
            link.href = tenantUrl;
        });
    }

    await loadOrderHistory();
}

// Load orders from localStorage and fetch current status
async function loadOrderHistory() {
    const historyKey = 'qorta_order_history';
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');

    const ordersList = document.getElementById('ordersList');
    const emptyState = document.getElementById('emptyState');

    if (history.length === 0) {
        ordersList.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }

    ordersList.style.display = 'block';
    emptyState.style.display = 'none';

    // Render orders with loading state
    ordersList.innerHTML = history.map(order => createOrderCardHTML(order, true)).join('');

    // Fetch current status for each order
    for (const order of history) {
        try {
            const response = await api.getOrder(order.id);
            updateOrderCard(order.id, response.data);
        } catch (error) {
            console.error(`Failed to load order ${order.id}:`, error);
            updateOrderCardError(order.id);
        }
    }
}

// Create order card HTML
function createOrderCardHTML(order, loading = false) {
    const date = new Date(order.createdAt);
    const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });

    return `
    <div class="order-card" id="order-${order.id}" onclick="viewOrder('${order.id}')">
      <div class="order-header">
        <div class="order-number">#${order.orderNumber || '---'}</div>
        <div class="order-status ${loading ? 'loading' : ''}" id="status-${order.id}">
          ${loading ? '<span class="spinner-small"></span>' : ''}
        </div>
      </div>
      <div class="order-meta">
        <span class="order-date">${formattedDate}</span>
        <span class="order-items">${order.itemCount || 0} item${order.itemCount !== 1 ? 's' : ''}</span>
      </div>
      <div class="order-footer">
        <span class="order-total">$${(order.total || 0).toFixed(2)}</span>
        <span class="view-details">View Details →</span>
      </div>
    </div>
  `;
}

// Update order card with fetched data
function updateOrderCard(orderId, orderData) {
    const statusEl = document.getElementById(`status-${orderId}`);
    if (!statusEl) return;

    const statusLabels = {
        'NEW': { text: 'Received', class: 'status-new' },
        'PREP': { text: 'Preparing', class: 'status-prep' },
        'READY': { text: 'Ready', class: 'status-ready' },
        'COMPLETE': { text: 'Completed', class: 'status-complete' }
    };

    const status = statusLabels[orderData.status] || { text: orderData.status, class: '' };
    statusEl.innerHTML = `<span class="status-badge ${status.class}">${status.text}</span>`;
    statusEl.classList.remove('loading');
}

// Update order card on error
function updateOrderCardError(orderId) {
    const statusEl = document.getElementById(`status-${orderId}`);
    if (!statusEl) return;

    statusEl.innerHTML = '<span class="status-badge status-error">Not found</span>';
    statusEl.classList.remove('loading');
}

// View order details
function viewOrder(orderId) {
    window.location.href = `track.html?order=${orderId}`;
}

// Clear order history
function clearHistory() {
    if (confirm('Are you sure you want to clear your order history?')) {
        localStorage.removeItem('qorta_order_history');
        loadOrderHistory();
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
