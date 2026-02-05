/**
 * QORTA - Mobile Navigation Logic
 */

// Update cart badge count
function updateMobileCartBadge() {
    const cartBadge = document.getElementById('mobileCartBadge');
    if (!cartBadge) return;

    // TIER 1 STRICT: Use in-memory cart instance only. No localStorage.
    let totalItems = 0;
    if (typeof cart !== 'undefined' && cart.getItemCount) {
        totalItems = cart.getItemCount();
    }

    if (totalItems > 0) {
        cartBadge.textContent = totalItems > 99 ? '99+' : totalItems;
        cartBadge.classList.remove('hidden');
    } else {
        cartBadge.classList.add('hidden');
    }
}

// Set active nav item based on current page/modal
function setActiveMobileNav() {
    const segments = window.location.pathname.split('/').filter(p => p && p.trim() !== '');
    const lastSegment = segments.length > 1 ? segments[segments.length - 1] : 'home';

    // Simplistic active state
    // 'home' is active by default on index.html
    // 'track' is active if on track page
    // 'cart' is active if modal is open (handled by click listener ideally, but for now we leave it as 'home' usually)

    const navItems = document.querySelectorAll('.mobile-nav-item');
    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (lastSegment === 'track' && href.includes('track')) {
            item.classList.add('active');
        } else if (lastSegment !== 'track' && (href === 'index.html' || href === '/')) {
            item.classList.add('active'); // Default to home active
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
    if (window.api && window.api.tenantSlug) {
        const slug = window.api.tenantSlug;

        const rewriteMap = {
            'index.html': `/${slug}`,
            '/': `/${slug}`,
            // 'checkout.html': `/${slug}/checkout`, // DEPRECATED: Cart is now a modal
            'history.html': `/${slug}/history`,
            'track.html': `/${slug}/track`
        };

        // Rewrite Mobile Nav Links
        document.querySelectorAll('.mobile-nav-item, .logo, .btn-icon, a').forEach(link => {
            const href = link.getAttribute('href');

            // Special Handler for Cart Link (checkout.html) -> Modal OR Redirect to Menu
            if (href === 'checkout.html') {
                link.removeAttribute('href'); // Remove nav
                link.style.cursor = 'pointer';
                link.onclick = (e) => {
                    e.preventDefault();
                    if (typeof openCheckoutModal === 'function') {
                        openCheckoutModal();
                    } else {
                        // If logic for modal doesn't exist (e.g. on track.html), 
                        // go back to the menu (Home)
                        window.location.href = `/${slug}`;
                    }
                };
            }
            // Standard Rewrites
            else if (rewriteMap[href]) {
                link.href = rewriteMap[href];
            }
        });

        // Cart Float Button already handles onclick="openCheckoutModal()" in HTML
    }

    // Update cart badge when cart is modified (using event dispatched by cart.js)
    window.addEventListener('cartUpdated', updateMobileCartBadge);
}

// Run on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
} else {
    initMobileNav();
}
