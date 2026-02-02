/**
 * QORTA Frontend - Admin Login Page Logic
 */

// Get redirect URL from query params or default to admin
function getRedirectUrl() {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');

    // Validate redirect URL (only allow local pages)
    if (redirect && (redirect.endsWith('.html') || redirect === '/')) {
        return redirect;
    }

    // Default to admin dashboard
    return 'admin.html';
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
    loginBtn.innerHTML = '<span class="spinner"></span> Signing in...';

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
                        const tenant = data.data[0];
                        localStorage.setItem('qorta_tenant_slug', tenant.slug);
                        console.log('Set tenant session:', tenant.slug);
                    }
                }
            } catch (e) {
                console.warn('Failed to auto-discover tenant:', e);
            }

            // Set explicit kitchen flag if redirecting to kitchen
            if (getRedirectUrl().includes('kitchen.html')) {
                sessionStorage.setItem('kitchen_access_granted', 'true');
            }

            // Redirect to intended page or admin dashboard
            window.location.href = getRedirectUrl();
        } else {
            // Show error
            errorMessage.textContent = result.error;
            errorMessage.style.display = 'block';
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'Sign In';
        }
    } catch (error) {
        errorMessage.textContent = 'An unexpected error occurred. Please try again.';
        errorMessage.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'Sign In';
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
