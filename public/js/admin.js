/**
 * QORTA Frontend - Admin Dashboard Logic
 */

let menuItems = [];
let categories = [];
let orders = [];
let currentFilter = 'all';
let currentDeleteCallback = null;

// Wait for Firebase auth to be ready
function waitForAuth() {
    return new Promise((resolve) => {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user);
        });
    });
}

// Initialize page
async function init() {
    const authLoading = document.getElementById('authLoading');

    try {
        const user = await waitForAuth();

        if (!user) {
            window.location.href = 'admin-login.html?redirect=admin.html';
            return;
        }

        // Debug:('Authenticated as:', user.email);
        if (authLoading) authLoading.style.display = 'none';

        // Wire tenant-scoped Kitchen Board link
        document.getElementById('kitchenLink').href = `/${api.tenantSlug}/kitchen`;

        // Check and display service mode status
        await checkServiceMode();

        // Load orders first (default view)
        await loadOrders();
        await loadCategories();
        await loadMenuItems();

        // Set up real-time updates for orders
        setupOrdersSSE();
        setInterval(loadOrders, 15000); // Auto-refresh every 15s
    } catch (error) {
        // Error:('Initialization error:', error);
        window.location.href = 'admin-login.html?redirect=admin.html';
    }
}

// Handle logout
async function handleLogout() {
    await firebase.auth().signOut();
    window.location.href = 'admin-login.html';
}

// Check service mode status and display badge
async function checkServiceMode() {
    try {
        const response = await api.request('/config');
        if (response.success && response.data) {
            const { mode } = response.data;
            const indicator = document.getElementById('serviceModeIndicator');
            if (mode === 'service' && indicator) {
                indicator.style.display = 'inline-flex';
            }
        }
    } catch (error) {
        // Silently fail - service mode indicator is not critical
    }
}

// ================== TAB SWITCHING ==================

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}Tab`);
    });
}

// ================== LOAD DATA ==================

async function loadMenuItems() {
    try {
        const response = await api.authRequest('/menu?includeUnavailable=true');
        menuItems = response.data || [];
        renderMenuItems();
    } catch (error) {
        // Error:('Failed to load menu items:', error);
        showToast('Failed to load menu items', 'error');
    }
}

async function loadCategories() {
    try {
        const response = await api.getCategories();
        categories = response.data || [];
        renderCategories();
        populateCategoryDropdown();
    } catch (error) {
        // Error:('Failed to load categories:', error);
        showToast('Failed to load categories', 'error');
    }
}

// ================== ORDERS MANAGEMENT ==================

async function loadOrders() {
    try {
        // Get all orders from kitchen board (already excludes COMPLETE)
        const response = await api.getKitchenBoard();

        // Extract orders from kitchen board structure
        if (response.data && response.data.orders) {
            // Kitchen board returns { orders: { NEW: [], PREP: [], READY: [] } }
            const allOrders = [
                ...(response.data.orders.NEW || []),
                ...(response.data.orders.PREP || []),
                ...(response.data.orders.READY || [])
            ];
            orders = allOrders;
        } else {
            orders = [];
        }

        renderOrders();
    } catch (error) {
        // Error:('Failed to load orders:', error);
        showToast('Failed to load orders', 'error');
    }
}

function filterOrders(filter) {
    currentFilter = filter;

    // Update filter button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    renderOrders();
}

function renderOrders() {
    const container = document.getElementById('ordersList');

    // Filter orders based on current filter
    // Map filter to backend status values (NEW, PREP, READY)
    const statusFilter = currentFilter === 'all' ? 'all' : currentFilter.toUpperCase();

    let filteredOrders = orders;
    if (statusFilter !== 'all') {
        filteredOrders = orders.filter(order => order.status === statusFilter);
    }

    if (!filteredOrders || filteredOrders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9 17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" stroke-width="2" />
                    <rect x="9" y="3" width="10" height="18" rx="2" stroke-width="2" />
                </svg>
                <h3>No ${currentFilter === 'all' ? '' : currentFilter.toLowerCase()} orders</h3>
                <p>Orders will appear here when placed</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredOrders.map(order => {
        const statusClass = order.status.toLowerCase();
        const statusLabel = order.status === 'PREP' ? 'PREPARING' : order.status;

        // Determine action button
        let actionClass, actionText, nextStatus;
        if (order.status === 'NEW') {
            actionClass = 'action-start';
            actionText = 'Start';
            nextStatus = 'PREP';
        } else if (order.status === 'PREP') {
            actionClass = 'action-ready';
            actionText = 'Mark Ready';
            nextStatus = 'READY';
        } else if (order.status === 'READY') {
            actionClass = 'action-complete';
            actionText = 'Complete';
            nextStatus = 'COMPLETE';
        }

        // Format timestamp
        const orderTime = order.createdAt ? new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Harare' }) : '';

        return `
            <div class="order-card status-${statusClass}">
                <div class="order-card-status">
                    <span>${statusLabel}</span>
                    <span class="order-number">#${order.orderNumber}</span>
                </div>
                <div class="order-card-items">
                    ${order.items.map(item => `
                        <div class="order-item">
                            <div>
                                <span class="order-item-quantity">${item.quantity}x</span>
                                <span class="order-item-name">${item.name}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="order-card-footer">
                    <div>
                        <div class="order-time">${orderTime}</div>
                        <div class="order-meta">
                            <span>${order.orderType || 'TAKEAWAY'}</span>
                            ${order.tableNumber ? `<span>Table ${order.tableNumber}</span>` : ''}
                        </div>
                    </div>
                    <button class="order-action-btn ${actionClass}" onclick="updateOrderStatus('${order.id}', '${nextStatus}')">
                        ${actionText}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        await api.updateOrderStatus(orderId, newStatus);
        // Reload orders immediately
        await loadOrders();
        showToast('Order status updated', 'success');
    } catch (error) {
        // Error:('Failed to update order:', error);
        // Error:('Order ID:', orderId, 'New Status:', newStatus);

        // More helpful error message
        const errorMsg = error.message || 'Failed to update order status';
        showToast(errorMsg, 'error');

        // Reload to get fresh state
        await loadOrders();
    }
}

// Set up Server-Sent Events for real-time order updates
let ordersEventSource = null;

async function setupOrdersSSE() {
    // Close existing connection if any
    if (ordersEventSource) {
        ordersEventSource.close();
    }

    try {
        const token = await firebase.auth().currentUser.getIdToken();
        ordersEventSource = api.createKitchenStream(
            token,
            (data) => {
                // Reload orders when kitchen board updates
                loadOrders();
            },
            (error) => {
                // Error:('SSE connection error:', error);
                // Try to reconnect after 5 seconds
                setTimeout(() => {
                    // Debug:('Attempting to reconnect SSE...');
                    setupOrdersSSE();
                }, 5000);
            }
        );
    } catch (error) {
        // Error:('Failed to set up SSE:', error);
    }
}

// ================== RENDER FUNCTIONS ==================

function renderMenuItems() {
    const container = document.getElementById('menuItemsList');

    if (!menuItems || menuItems.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 3h18v18H3zM3 9h18M9 21V9" stroke-width="2"/>
        </svg>
        <h3>No menu items yet</h3>
        <p>Add your first menu item to get started</p>
      </div>
    `;
        return;
    }

    container.innerHTML = menuItems.map(item => {
        const category = categories.find(c => c.id === item.category);
        const categoryName = category ? category.name : 'Uncategorized';

        return `
      <div class="item-card">
        ${item.imageUrl ?
                `<img src="${item.imageUrl}" alt="${item.name}" class="item-card-image" onerror="this.style.display='none'">` :
                `<div class="item-card-image"></div>`
            }
        <div class="item-card-body">
          <div class="item-card-header">
            <span class="item-card-name">${item.name}</span>
            <span class="item-card-price">$${(item.price || 0).toFixed(2)}</span>
          </div>
          <p class="item-card-description">${item.description || 'No description'}</p>
          <div class="item-card-meta">
            <span class="item-badge badge-category">${categoryName}</span>
            ${item.isFeatured ? '<span class="item-badge badge-featured">Featured</span>' : ''}
            ${!item.available ? '<span class="item-badge badge-unavailable">Unavailable</span>' : ''}
          </div>
          <div class="item-card-actions">
            <button class="btn btn-secondary" onclick="editItem('${item.id}')">Edit</button>
            <button class="btn btn-secondary" onclick="toggleItemAvailability('${item.id}', ${!item.available})">
              ${item.available ? 'Hide' : 'Show'}
            </button>
            <button class="btn btn-secondary" onclick="confirmDeleteItem('${item.id}', '${item.name}')">Delete</button>
          </div>
        </div>
      </div>
    `;
    }).join('');
}

function renderCategories() {
    const container = document.getElementById('categoriesList');

    if (!categories || categories.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke-width="2"/>
        </svg>
        <h3>No categories yet</h3>
        <p>Add categories to organize your menu</p>
      </div>
    `;
        return;
    }

    container.innerHTML = categories.map(category => {
        const itemCount = menuItems.filter(item => item.category === category.id).length;

        return `
      <div class="category-card">
        <div class="category-info">
          <span class="category-order">${category.order || 0}</span>
          <div>
            <div class="category-name">${category.name}</div>
            <div class="category-count">${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="category-actions">
          <button class="btn btn-secondary" onclick="editCategory('${category.id}')">Edit</button>
          <button class="btn btn-secondary" onclick="confirmDeleteCategory('${category.id}', '${category.name}')">Delete</button>
        </div>
      </div>
    `;
    }).join('');
}

function populateCategoryDropdown() {
    const select = document.getElementById('itemCategory');
    select.innerHTML = '<option value="">Select category...</option>' +
        categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

// ================== ITEM MODAL ==================

function showAddItemModal() {
    document.getElementById('itemModalTitle').textContent = 'Add Menu Item';
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('itemAvailable').checked = true;
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('imagePreview').classList.remove('has-image');
    document.getElementById('itemModal').style.display = 'flex';
}

function editItem(itemId) {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('itemModalTitle').textContent = 'Edit Menu Item';
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemName').value = item.name || '';
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('itemPrice').value = item.price || '';
    document.getElementById('itemCategory').value = item.category || '';
    document.getElementById('itemImage').value = item.imageUrl || '';
    document.getElementById('itemAvailable').checked = item.available !== false;
    document.getElementById('itemFeatured').checked = item.isFeatured === true;

    if (item.imageUrl) {
        previewImage(item.imageUrl);
    } else {
        document.getElementById('imagePreview').innerHTML = '';
        document.getElementById('imagePreview').classList.remove('has-image');
    }

    document.getElementById('itemModal').style.display = 'flex';
}

function closeItemModal() {
    document.getElementById('itemModal').style.display = 'none';
}

function previewImage(url) {
    const preview = document.getElementById('imagePreview');
    if (url) {
        preview.innerHTML = `<img src="${url}" alt="Preview" onerror="this.parentElement.innerHTML='Invalid image URL'">`;
        preview.classList.add('has-image');
    } else {
        preview.innerHTML = '';
        preview.classList.remove('has-image');
    }
}

async function saveItem(event) {
    event.preventDefault();

    const itemId = document.getElementById('itemId').value;
    const formData = {
        name: document.getElementById('itemName').value,
        description: document.getElementById('itemDescription').value,
        price: parseFloat(document.getElementById('itemPrice').value),
        category: document.getElementById('itemCategory').value,
        imageUrl: document.getElementById('itemImage').value,
        available: document.getElementById('itemAvailable').checked,
        isFeatured: document.getElementById('itemFeatured').checked
    };

    const saveBtn = document.getElementById('saveItemBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        if (itemId) {
            await api.authRequest(`/menu/${itemId}`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            showToast('Item updated successfully');
        } else {
            await api.authRequest('/menu', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            showToast('Item added successfully');
        }

        closeItemModal();
        await loadMenuItems();
    } catch (error) {
        // Error:('Failed to save item:', error);
        showToast('Failed to save item: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Item';
    }
}

async function toggleItemAvailability(itemId, available) {
    try {
        await api.authRequest(`/menu/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({ available })
        });
        showToast(available ? 'Item is now available' : 'Item is now hidden');
        await loadMenuItems();
    } catch (error) {
        // Error:('Failed to toggle availability:', error);
        showToast('Failed to update item', 'error');
    }
}

function confirmDeleteItem(itemId, itemName) {
    document.getElementById('deleteMessage').textContent =
        `Are you sure you want to delete "${itemName}"?`;
    currentDeleteCallback = () => deleteItem(itemId);
    document.getElementById('confirmDeleteBtn').onclick = currentDeleteCallback;
    document.getElementById('deleteModal').style.display = 'flex';
}

async function deleteItem(itemId) {
    try {
        await api.authRequest(`/menu/${itemId}`, { method: 'DELETE' });
        showToast('Item deleted');
        closeDeleteModal();
        await loadMenuItems();
    } catch (error) {
        // Error:('Failed to delete item:', error);
        showToast('Failed to delete item', 'error');
    }
}

// ================== CATEGORY MODAL ==================

function showAddCategoryModal() {
    document.getElementById('categoryModalTitle').textContent = 'Add Category';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryActive').checked = true;
    document.getElementById('categoryModal').style.display = 'flex';
}

function editCategory(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    document.getElementById('categoryModalTitle').textContent = 'Edit Category';
    document.getElementById('categoryId').value = category.id;
    document.getElementById('categoryName').value = category.name || '';
    document.getElementById('categoryOrder').value = category.order || 0;
    document.getElementById('categoryActive').checked = category.isActive !== false;

    document.getElementById('categoryModal').style.display = 'flex';
}

function closeCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
}

async function saveCategory(event) {
    event.preventDefault();

    const categoryId = document.getElementById('categoryId').value;
    const formData = {
        name: document.getElementById('categoryName').value,
        order: parseInt(document.getElementById('categoryOrder').value) || 0,
        isActive: document.getElementById('categoryActive').checked
    };

    try {
        if (categoryId) {
            await api.authRequest(`/categories/${categoryId}`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            showToast('Category updated');
        } else {
            await api.authRequest('/categories', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            showToast('Category added');
        }

        closeCategoryModal();
        await loadCategories();
        await loadMenuItems();
    } catch (error) {
        // Error:('Failed to save category:', error);
        showToast('Failed to save category', 'error');
    }
}

function confirmDeleteCategory(categoryId, categoryName) {
    const itemCount = menuItems.filter(item => item.category === categoryId).length;
    document.getElementById('deleteMessage').textContent =
        itemCount > 0
            ? `"${categoryName}" has ${itemCount} item(s). Are you sure you want to delete it?`
            : `Are you sure you want to delete "${categoryName}"?`;
    currentDeleteCallback = () => deleteCategory(categoryId);
    document.getElementById('confirmDeleteBtn').onclick = currentDeleteCallback;
    document.getElementById('deleteModal').style.display = 'flex';
}

async function deleteCategory(categoryId) {
    try {
        await api.authRequest(`/categories/${categoryId}`, { method: 'DELETE' });
        showToast('Category deleted');
        closeDeleteModal();
        await loadCategories();
        await loadMenuItems();
    } catch (error) {
        // Error:('Failed to delete category:', error);
        showToast('Failed to delete category', 'error');
    }
}

// ================== DELETE MODAL ==================

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    currentDeleteCallback = null;
}

// ================== TOAST NOTIFICATIONS ==================

function showToast(message, type = 'success') {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    z-index: 2000;
    animation: slideUp 0.3s ease;
    background-color: ${type === 'error' ? '#DC2626' : '#059669'};
  `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// CSS animation for toast
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from { transform: translate(-50%, 100%); opacity: 0; }
    to { transform: translate(-50%, 0); opacity: 1; }
  }
  @keyframes slideDown {
    from { transform: translate(-50%, 0); opacity: 1; }
    to { transform: translate(-50%, 100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
