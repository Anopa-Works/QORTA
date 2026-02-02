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
    await auth.init();
    if (auth.isAuthenticated()) {
        // Already logged in, redirect to intended page
        window.location.href = getRedirectUrl();
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', checkAuth);
