/**
 * QORTA Frontend - Authentication Module
 * Handles Firebase authentication and token management
 */

const auth = {
    // Current user state
    currentUser: null,

    // Initialize auth state listener
    init: function () {
        return new Promise((resolve) => {
            firebase.auth().onAuthStateChanged((user) => {
                this.currentUser = user;
                resolve(user);
            });
        });
    },

    // Login with email and password
    login: async function (email, password) {
        try {
            const result = await firebase.auth().signInWithEmailAndPassword(email, password);
            this.currentUser = result.user;
            return { success: true, user: result.user };
        } catch (error) {
            // Error:('Login error:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    },

    // Logout
    logout: async function () {
        try {
            await firebase.auth().signOut();
            this.currentUser = null;
            return { success: true };
        } catch (error) {
            // Error:('Logout error:', error);
            return { success: false, error: error.message };
        }
    },

    // Get current ID token for API calls
    getToken: async function () {
        if (!this.currentUser) return null;
        try {
            return await this.currentUser.getIdToken();
        } catch (error) {
            // Error:('Token error:', error);
            return null;
        }
    },

    // Check if user is authenticated
    isAuthenticated: function () {
        return this.currentUser !== null;
    },

    // Require authentication (for protected pages)
    requireAuth: async function (redirectUrl = 'admin-login.html') {
        await this.init();
        if (!this.isAuthenticated()) {
            window.location.href = redirectUrl;
            return false;
        }
        return true;
    },

    // User-friendly error messages
    getErrorMessage: function (code) {
        const messages = {
            'auth/invalid-email': 'Invalid email address',
            'auth/user-disabled': 'This account has been disabled',
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/invalid-credential': 'Invalid email or password',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Check your connection.'
        };
        return messages[code] || 'Login failed. Please try again.';
    }
};

// Make auth available globally
window.auth = auth;
