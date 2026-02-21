/**
 * QORTA Frontend - Menu Page Logic
 */

let menuItems = [];
let categories = [];
let currentCategory = '';
let searchQuery = '';

// Initialize page
let loaderTimeout = null;

async function init() {
    const loader = document.getElementById('contextLoader');
    const mainContent = document.getElementById('mainContent');
    const statusEl = document.getElementById('loaderStatus');

    // Fail-safe: Update status after 4 seconds
    loaderTimeout = setTimeout(() => {
        if (loader && !loader.classList.contains('hidden') && statusEl) {
            statusEl.innerHTML = 'Still loading<span class="loading-dots"></span>';
        }
    }, 4000);

    // Inject dynamic restaurant name from API slug
    if (typeof api !== 'undefined' && api.tenantSlug) {
        const name = api.tenantSlug
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        const nameEl = document.getElementById('loaderRestaurantName');
        if (nameEl) nameEl.textContent = name;
        const logoEl = document.getElementById('headerLogo');
        if (logoEl) logoEl.textContent = name;
    }

    try {
        // Enforce minimum 2-second display time for branding (max 2.5s requirement)
        const minWaitPromise = new Promise(resolve => setTimeout(resolve, 2000));

        await Promise.all([
            loadRestaurantConfig(),
            loadCategories(),
            loadFeaturedItems(),
            loadMenuItems(),
            minWaitPromise
        ]);
        updateCartDisplay();
        setupCartListener();
        applyServiceModeRestrictions();

        // Data ready - hide loader, show content
        hideLoader();

    } catch (error) {
        // Error:('Failed to load menu:', error);
        showError('Unable to load menu. Please refresh the page.');
        // Still hide loader even on error
        hideLoader();
    }
}

// Load restaurant configuration
async function loadRestaurantConfig() {
    try {
        const response = await api.request('/config');
        window.restaurantConfig = response.data;
    } catch (error) {
        // Fail gracefully - default to ordering mode
        window.restaurantConfig = { mode: 'ordering', taxRate: 0.08 };
    }
}

// Apply service mode restrictions if enabled
function applyServiceModeRestrictions() {
    if (window.restaurantConfig?.mode === 'service') {
        // Hide cart float button
        const cartFloat = document.getElementById('cartFloat');
        if (cartFloat) {
            cartFloat.style.display = 'none';
        }

        // Hide mobile nav cart
        const mobileNavCart = document.querySelector('.mobile-nav-item.cart');
        if (mobileNavCart) {
            mobileNavCart.style.display = 'none';
        }

        // Replace entire menu content with table selection UI
        showServiceModeUI();
    }
}

// Global variable to track selected table
let selectedTableNumber = null;

// Show service mode UI (table selection + call waiter)
function showServiceModeUI() {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;

    const tableCount = window.restaurantConfig?.serviceMode?.tableCount || 10;

    // Build table selection grid
    let tableButtons = '';
    for (let i = 1; i <= tableCount; i++) {
        tableButtons += `
            <button class="table-btn" data-table="${i}" onclick="selectTable(${i})">
                <div class="table-number">Table ${i}</div>
            </button>
        `;
    }

    mainContent.innerHTML = `
        <div class="service-mode-container">
            <div class="service-mode-header">
                <h1>Welcome!</h1>
                <p>Please select your table number to request service</p>
            </div>

            <div class="table-grid">
                ${tableButtons}
            </div>

            <div class="selected-table-info" id="selectedTableInfo" style="display: none;">
                <p>Selected: <strong id="selectedTableDisplay">Table 1</strong></p>
                <button class="call-waiter-btn" id="callWaiterBtn" onclick="callWaiter()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    Call Waiter
                </button>
            </div>

            <div class="service-mode-footer">
                <p>A member of our staff will assist you shortly</p>
            </div>
        </div>
    `;
}

// Handle table selection
function selectTable(tableNumber) {
    selectedTableNumber = tableNumber;

    // Update visual selection
    document.querySelectorAll('.table-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    const selectedBtn = document.querySelector(`[data-table="${tableNumber}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('selected');
    }

    // Show call waiter section
    const selectedInfo = document.getElementById('selectedTableInfo');
    const selectedDisplay = document.getElementById('selectedTableDisplay');
    if (selectedInfo && selectedDisplay) {
        selectedDisplay.textContent = `Table ${tableNumber}`;
        selectedInfo.style.display = 'block';
    }
}

// Call waiter function
async function callWaiter() {
    if (!selectedTableNumber) {
        showNotification('Please select your table first');
        return;
    }

    const btn = document.getElementById('callWaiterBtn');
    if (!btn) return;

    // Disable button during request
    btn.disabled = true;
    btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner">
            <circle cx="12" cy="12" r="10"/>
        </svg>
        Calling...
    `;

    try {
        const response = await api.request('/orders/service-requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tableNumber: selectedTableNumber,
                message: `Service request - Table ${selectedTableNumber}`
            })
        });

        if (response.success) {
            // Show success message
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                Waiter Notified!
            `;
            btn.style.background = '#10b981';

            // Reset after 3 seconds
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    Call Waiter
                `;
                btn.style.background = '';
            }, 3000);
        }
    } catch (error) {
        showNotification('Failed to call waiter. Please try again.');
        btn.disabled = false;
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            Call Waiter
        `;
    }
}

// Hide loader with fade transition
function hideLoader() {
    clearTimeout(loaderTimeout);

    const loader = document.getElementById('contextLoader');
    const mainContent = document.getElementById('mainContent');

    if (loader) {
        loader.classList.add('hidden');
        setTimeout(() => {
            loader.style.display = 'none';
        }, 200); // Wait for fade out
    }

    if (mainContent) {
        mainContent.classList.add('visible');
    }
}

// Helper: Retry operation with exponential backoff
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            // Warn:(`Attempt ${i + 1} failed, retrying in ${delay}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
        }
    }
}

// Load categories with retry
async function loadCategories() {
    try {
        const response = await retryOperation(() => api.getCategories());
        categories = response.data || [];
        renderCategoryNav();
    } catch (error) {
        // Error:('Failed to load categories after retries:', error);
        categories = [];
        // Non-critical, can continue without categories (display "All")
    }
}

// Load featured items with retry
async function loadFeaturedItems() {
    try {
        const response = await retryOperation(() => api.getFeaturedItems());
        const featured = response.data;

        if (!featured || featured.length === 0) {
            const section = document.getElementById('featuredSection');
            if (section) section.style.display = 'none';
            return;
        }

        const grid = document.getElementById('featuredGrid');
        if (grid) grid.innerHTML = featured.map(item => createMenuItemCard(item, true)).join('');
    } catch (error) {
        // Error:('Failed to load featured items:', error);
        const section = document.getElementById('featuredSection');
        if (section) section.style.display = 'none';
    }
}

// Load all menu items with retry (Critical)
async function loadMenuItems() {
    try {
        const response = await retryOperation(() => api.getMenu());
        menuItems = response.data;
        renderMenuByCategory();
    } catch (error) {
        // Error:('Failed to load menu items:', error);
        throw error; // Critical error, propagate to init
    }
}

// Render menu grouped by category
function renderMenuByCategory() {
    const sections = document.getElementById('menuSections');
    const grouped = groupByCategory(menuItems);

    sections.innerHTML = Object.entries(grouped).map(([categoryKey, items]) => {
        // Match by ID first, then by slug (for backwards compatibility)
        let category = categories.find(c => c.id === categoryKey);
        if (!category) {
            category = categories.find(c => c.slug === categoryKey);
        }
        const categoryName = category ? category.name : categoryKey;
        // Use category ID if found, otherwise use the original key
        const categoryId = category ? category.id : categoryKey;

        return `
      <section class="menu-category-section" data-category="${categoryId}">
        <div class="section-header">
          <h2 class="section-title">${categoryName}</h2>
        </div>
        <div class="menu-grid">
          ${items.map(item => createMenuItemCard(item)).join('')}
        </div>
      </section>
    `;
    }).join('');
}

// Group menu items by category
function groupByCategory(items) {
    return items.reduce((acc, item) => {
        if (!acc[item.category]) {
            acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
    }, {});
}

// Render category filter pills
function renderCategoryNav() {
    const nav = document.getElementById('categoryNav');
    if (!nav) return;

    nav.innerHTML = [
        `<button class="category-pill active" data-category="" onclick="filterByCategory('')">All</button>`,
        ...categories
            .filter(cat => cat.slug !== 'all')
            .map(cat => `<button class="category-pill" data-category="${cat.id}" onclick="filterByCategory('${cat.id}')">${cat.name}</button>`)
    ].join('');
}

// Create menu item card HTML
function createMenuItemCard(item, isFeatured = false) {
    const badges = [];
    if (isFeatured) badges.push('<span class="badge badge-bestseller">BESTSELLER</span>');

    // Use item image if available, otherwise create a styled placeholder
    const hasImage = item.imageUrl && item.imageUrl.trim() !== '';
    const imageUrl = hasImage ? item.imageUrl : '';

    return `
    <div class="menu-item" onclick="addToCart('${item.id}')" data-item-name="${item.name.toLowerCase()}" data-item-description="${(item.description || '').toLowerCase()}">
      ${hasImage ? `
        <img 
          src="${imageUrl}" 
          alt="${item.name}"
          class="menu-item-image"
          loading="lazy"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        >
        <div class="menu-item-placeholder" style="display: none;">
          <span class="placeholder-icon">🍽️</span>
        </div>
      ` : `
        <div class="menu-item-placeholder">
          <span class="placeholder-icon">🍽️</span>
        </div>
      `}
      <div class="menu-item-content">
        ${badges.length ? `<div style="margin-bottom: 8px;">${badges.join('')}</div>` : ''}
        <div class="menu-item-header">
          <h3 class="menu-item-name">${item.name}</h3>
        </div>
        <p class="menu-item-description">${item.description || ''}</p>
        <div class="menu-item-footer">
          <span class="menu-item-price">$${item.price.toFixed(2)}</span>
          ${window.restaurantConfig?.mode === 'service'
            ? '<span class="service-mode-badge">Staff Only</span>'
            : `<button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${item.id}')">+</button>`
          }
        </div>
      </div>
    </div>
  `;
}

// Search functionality
function toggleSearch() {
    const searchBar = document.getElementById('searchBar');
    const searchInput = document.getElementById('searchInput');

    if (searchBar.style.display === 'none') {
        searchBar.style.display = 'flex';
        searchInput.focus();
    } else {
        searchBar.style.display = 'none';
        clearSearch();
    }
}

function searchMenu(query) {
    searchQuery = query.toLowerCase().trim();

    if (searchQuery === '') {
        // Show all items
        document.querySelectorAll('.menu-item').forEach(item => {
            item.style.display = 'block';
        });
        document.querySelectorAll('.menu-category-section').forEach(section => {
            section.style.display = 'block';
        });
        return;
    }

    // Filter items
    document.querySelectorAll('.menu-item').forEach(item => {
        const name = item.dataset.itemName || '';
        const description = item.dataset.itemDescription || '';
        const matches = name.includes(searchQuery) || description.includes(searchQuery);
        item.style.display = matches ? 'block' : 'none';
    });

    // Hide empty sections
    document.querySelectorAll('.menu-category-section').forEach(section => {
        const visibleItems = section.querySelectorAll('.menu-item[style*="display: block"]').length;
        section.style.display = visibleItems > 0 ? 'block' : 'none';
    });
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    searchQuery = '';
    searchMenu('');
}

// Filter by category
function filterByCategory(categorySlug) {
    currentCategory = categorySlug;
    clearSearch(); // Clear search when filtering by category

    // Update active pill
    document.querySelectorAll('.category-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.category === categorySlug);
    });

    // Show/hide sections
    if (categorySlug === '') {
        // Show all
        document.querySelectorAll('.menu-category-section').forEach(section => {
            section.style.display = 'block';
        });
        document.getElementById('featuredSection').style.display = 'block';
    } else {
        // Show specific category
        document.getElementById('featuredSection').style.display = 'none';
        document.querySelectorAll('.menu-category-section').forEach(section => {
            section.style.display = section.dataset.category === categorySlug ? 'block' : 'none';
        });
    }
}

// Add item to cart
function addToCart(itemId) {
    // Block adding to cart in service mode
    if (window.restaurantConfig?.mode === 'service') {
        showNotification('Service mode active. Orders placed by staff only.', 'info');
        return;
    }

    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;

    // For now, add without modifiers (can enhance later)
    cart.addItem(item, 1, []);

    // Visual feedback on button
    const btn = document.querySelector(`.menu-item[onclick="addToCart('${item.id}')"] .add-to-cart-btn`) ||
        event.target.closest('.add-to-cart-btn');

    if (btn) {
        const originalContent = btn.innerHTML;
        btn.innerHTML = '✓';
        btn.style.backgroundColor = 'var(--color-ready)'; // Green
        btn.disabled = true;

        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.style.backgroundColor = '';
            btn.disabled = false;
        }, 1000);
    }

    // Visual feedback notification
    showNotification(`${item.name} added to cart`);

    // Animate cart float
    const cartFloat = document.getElementById('cartFloat');
    cartFloat.classList.add('pulse');
    setTimeout(() => cartFloat.classList.remove('pulse'), 300);
}

// Update cart display
function updateCartDisplay() {
    const count = cart.getItemCount();
    const total = cart.getTotal();

    document.getElementById('cartCount').textContent = count;
    document.getElementById('cartTotal').textContent = `$${total.toFixed(2)} `;

    const cartFloat = document.getElementById('cartFloat');
    if (count > 0) {
        cartFloat.classList.remove('hidden');
        cartFloat.style.display = 'flex';
    } else {
        cartFloat.classList.add('hidden');
        cartFloat.style.display = 'none';
    }
}

// Setup cart change listener
function setupCartListener() {
    cart.onChange(() => {
        updateCartDisplay();
    });
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 16px;
    background: #1A1A1A;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Show error
// Show error with branded UI
function showError(message) {
    // Hide standard loader if visible
    const loader = document.getElementById('contextLoader');
    if (loader) loader.style.display = 'none';

    // Check if we already have an error container
    let errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'errorContainer';
        errorContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #F8F9FA;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 3000;
            padding: 20px;
            text-align: center;
        `;
        document.body.appendChild(errorContainer);
    }

    errorContainer.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">😕</div>
        <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 12px; color: #111;">Menu temporarily unavailable</h2>
        <p style="color: #666; margin-bottom: 32px; max-width: 300px; line-height: 1.5;">${message}</p>
        <button onclick="location.reload()" class="btn btn-primary" style="
            background: #000;
            color: white;
            padding: 16px 32px;
            border-radius: 100px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        ">Try Again</button>
    `;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
