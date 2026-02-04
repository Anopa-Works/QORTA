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
    const segments = window.location.pathname.split('/').filter(p => p && p.trim() !== '');
    // Last segment usually: 'checkout', 'history', 'track', or the tenantSlug itself (home)
    const lastSegment = segments.length > 1 ? segments[segments.length - 1] : 'home';

    // Map URL segments to original hrefs for matching
    const segmentMap = {
        'home': 'index.html',
        'checkout': 'checkout.html',
        'history': 'history.html',
        'track': 'track.html'
    };

    const targetHref = segmentMap[lastSegment] || 'index.html';

    const navItems = document.querySelectorAll('.mobile-nav-item');
    navItems.forEach(item => {
        const href = item.getAttribute('href'); // This might be original 'checkout.html' OR rewritten '/slug/checkout'

        // Check if href matches our target or rewritten version
        if (href.includes(lastSegment) || (lastSegment === 'home' && (href.endsWith('index.html') || href === '/'))) {
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

    // DYNAMIC LINK REWRITING: Fixes Context Loss
    // Every link (Home, Checkout, Track, History) must include the current tenant slug.
    if (window.api && window.api.tenantSlug) {
        const slug = window.api.tenantSlug;

        const rewriteMap = {
            'index.html': `/${slug}`,
            '/': `/${slug}`,
            'checkout.html': `/${slug}/checkout`,
            'history.html': `/${slug}/history`,
            'track.html': `/${slug}/track`
        };

        // Rewrite Mobile Nav Links
        document.querySelectorAll('.mobile-nav-item, .logo, .btn-icon, a').forEach(link => {
            const href = link.getAttribute('href');
            if (rewriteMap[href]) {
                link.href = rewriteMap[href];
            }
        });

        // Special handling for the Cart Float Button (which uses onclick)
        const cartFloat = document.getElementById('cartFloat');
        if (cartFloat) {
            cartFloat.onclick = () => window.location.href = `/${slug}/checkout`;
        }
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
