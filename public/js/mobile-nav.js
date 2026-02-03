/**
 * QORTA - Mobile Navigation Logic
 */

// Update cart badge count
function updateMobileCartBadge() {
    const cartBadge = document.getElementById('mobileCartBadge');
    if (!cartBadge) return;

    // Use tenant-specific storage key, defaulting to burger-palace if api not ready
    const tenantSlug = (window.api && window.api.tenantSlug) ? window.api.tenantSlug : 'burger-palace';
    const storageKey = `qorta_cart_${tenantSlug}`;

    // Fallback: Check if the legacy key has data if the new one is empty? 
    // No, strictly use namespaced key to prevent leakage.

    const cart = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (totalItems > 0) {
        cartBadge.textContent = totalItems > 99 ? '99+' : totalItems;
        cartBadge.classList.remove('hidden');
    } else {
        cartBadge.classList.add('hidden');
    }
}

// Set active nav item based on current page
function setActiveMobileNav() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navItems = document.querySelectorAll('.mobile-nav-item');

    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href === currentPage ||
            (currentPage === '' && href === 'index.html') ||
            (currentPage === '/' && href === 'index.html')) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Initialize mobile nav
function initMobileNav() {
    updateMobileCartBadge();
    setActiveMobileNav();

    // DYNAMIC LINK REWRITING: Fixes "Sticky Session Reset"
    // If we are on a tenant page (e.g. /chicken-matty), 'Home' links should point to /chicken-matty, NOT index.html
    if (window.api && window.api.tenantSlug && window.api.tenantSlug !== 'burger-palace') {
        const slug = window.api.tenantSlug;
        const tenantHomeUrl = `/${slug}`;

        // 1. Rewrite Mobile Nav "Home"
        document.querySelectorAll('a[href="index.html"], a[href="/"], .logo').forEach(link => {
            // Only rewrite if it's actually a home link
            if (link.getAttribute('href') === 'index.html' || link.getAttribute('href') === '/') {
                link.href = tenantHomeUrl;
            }
        });
    }

    // Update cart badge when storage changes (e.g., from another tab or cart update)
    window.addEventListener('storage', updateMobileCartBadge);

    // Update cart badge when cart is modified
    window.addEventListener('cartUpdated', updateMobileCartBadge);
}

// Run on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
} else {
    initMobileNav();
}
