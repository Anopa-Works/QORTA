/**
 * QORTA - Mobile Navigation Logic
 */

// Update cart badge count
function updateMobileCartBadge() {
    const cartBadge = document.getElementById('mobileCartBadge');
    if (!cartBadge) return;

    const cart = JSON.parse(localStorage.getItem('qorta_cart') || '[]');
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
