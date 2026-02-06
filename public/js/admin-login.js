/**
 * QORTA Frontend - Admin Login Page Logic
 */

// Build a tenant-scoped redirect URL from the ?redirect param
function getRedirectUrl() {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    const slug = localStorage.getItem('qorta_tenant_slug');

    // Map known page names to tenant-scoped routes
    const pageRoutes = { 'admin.html': 'admin', 'kitchen.html': 'kitchen' };
    const route = (redirect && pageRoutes[redirect]) || 'admin';

    return slug ? `/${slug}/${route}` : `/${route}`;
}

// Map raw auth errors to calm, neutral messages
function getFriendlyError(error) {
    const msg = (error || '').toLowerCase();
    if (msg.includes('wrong-password') || msg.includes('user-not-found') || msg.includes('invalid-credential') || msg.includes('invalid-email')) {
        return 'Incorrect email or password.';
    }
    if (msg.includes('user-disabled') || msg.includes('access-denied')) {
        return "You don't have access to this restaurant.";
    }
    if (msg.includes('too-many-requests')) {
        return 'Too many attempts. Please try again later.';
    }
    return 'Incorrect email or password.';
}

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');

    // Clear previous errors
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';

    // Disable button and show loading
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Logging in...';

    try {
        const result = await auth.login(email, password);

        if (result.success) {
            // Fetch associated tenant(s)
            // Note: In a real multi-tenant system, we'd check which tenants this user belongs to.
            // Here we'll just fetch the first available tenant to bootstrap the session.
            try {
                // We need to use raw fetch here because api.js might rely on the slug we haven't set yet
                // and /api/tenants is a platform-level route, not tenant-scoped.
                // However, api.baseUrl is correctly set now.
                const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                    ? 'http://localhost:3000'
                    : window.location.origin;

                const response = await fetch(`${baseUrl}/api/tenants`, {
                    headers: { 'Authorization': `Bearer ${await result.user.getIdToken()}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.data && data.data.length > 0) {
                        // Check if we already have a session slug
                        const storedSlug = localStorage.getItem('qorta_tenant_slug');
                        let tenant = null;

                        // Try to find the stored tenant in the user's available tenants
                        if (storedSlug) {
                            tenant = data.data.find(t => t.slug === storedSlug);
                        }

                        // If not found or no stored slug, default to first available
                        if (!tenant) {
                            tenant = data.data[0];
                        }

                        localStorage.setItem('qorta_tenant_slug', tenant.slug);
                        // Log:('Set tenant session:', tenant.slug);
                    }
                }
            } catch (e) {
                // Warn:('Failed to auto-discover tenant:', e);
            }

            // Set explicit kitchen flag if redirecting to kitchen
            if (getRedirectUrl().includes('/kitchen')) {
                sessionStorage.setItem('kitchen_access_granted', 'true');
            }

            // Brief success pulse before redirect
            const circle = document.getElementById('successCircle');
            if (circle) circle.classList.add('pop');
            setTimeout(() => {
                window.location.href = getRedirectUrl();
            }, 600);
        } else {
            // Show error
            errorMessage.textContent = getFriendlyError(result.error);
            errorMessage.style.display = 'block';
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'Log in';
        }
    } catch (error) {
        errorMessage.textContent = 'Something went wrong. Please try again.';
        errorMessage.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'Log in';
    }
}

// Check if already logged in
async function checkAuth() {
    const params = new URLSearchParams(window.location.search);
    const isReauth = params.get('reauth') === 'true';

    // Ensure session persistence (clears on tab close)
    await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);

    await auth.init();

    if (auth.isAuthenticated()) {
        if (isReauth) {
            // Force logout if re-authentication is requested
            await auth.logout();
            // Clear API tenant session too
            localStorage.removeItem('qorta_tenant_slug');
            sessionStorage.removeItem('kitchen_access_granted');
        } else {
            // Already logged in, redirect to intended page
            window.location.href = getRedirectUrl();
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', checkAuth);
