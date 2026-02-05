/**
 * QORTA API Client
 * Handles all communication with the backend
 */

class QortaAPI {
    constructor() {
        // Use environment-based URL
        // If on localhost (likely using Live Server on distinct port), default to :3000
        // Otherwise (production), use the current origin
        this.baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3000'
            : window.location.origin;

        // Extract tenant slug from URL
        this.tenantSlug = this.extractTenantSlug();
    }

    extractTenantSlug() {
        // NON-NEGOTIABLE: Tenant must be resolved from URL PATH ONLY.
        // No localStorage. No query params. No defaults.

        // 1. Get path segments, ignoring empty strings
        const pathParts = window.location.pathname.split('/').filter(p => p && p.trim() !== '');

        // 2. First segment is ALWAYS the tenant slug
        const possibleSlug = pathParts[0];

        // 3. Validation
        // Ignore known system paths or static files if they somehow got here (though server shouldn't route them)
        const systemPaths = ['api', 'js', 'css', 'images', 'favicon.ico'];

        if (!possibleSlug || systemPaths.includes(possibleSlug) || possibleSlug.includes('.')) {
            // CRITICAL: If we are at root "/" or an invalid path, we have NO tenant context.
            console.error('CRITICAL: No tenant context found in URL path.');
            // Only redirect if we are strictly not on a valid tenant
            if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
                // Optional: redirect to a specific default or landing page if desired, 
                // but for now we basically leave it null or let the app handle the "Not Found" state.
                // The user said: If missing -> show "Restaurant not found" error.
                return null;
            }
            return null;
        }

        return possibleSlug;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}/api/${this.tenantSlug}${endpoint}`;

        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Request failed' }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Authenticated request - includes Firebase ID token
    async authRequest(endpoint, options = {}) {
        // Get auth token from Firebase directly
        let token = null;
        try {
            const user = firebase.auth().currentUser;
            if (user) {
                token = await user.getIdToken();
            }
        } catch (e) {
            console.error('Failed to get auth token:', e);
        }

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            console.warn('No auth token available - user may not be logged in');
        }

        const url = `${this.baseUrl}/api/${this.tenantSlug}${endpoint}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Request failed' }));

                // Handle 401 - redirect to login
                if (response.status === 401) {
                    window.location.href = 'admin-login.html';
                    return;
                }

                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Auth API Request failed:', error);
            throw error;
        }
    }

    // Menu endpoints (public)
    async getMenu(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(query ? `/menu?${query}` : '/menu');
    }

    async getFeaturedItems() {
        return this.request('/menu/featured');
    }

    async getCategories() {
        return this.request('/categories');
    }

    // Order endpoints (public - customer side)
    async createOrder(orderData) {
        return this.request('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    }

    async getOrder(orderId) {
        return this.request(`/orders/${orderId}`);
    }

    // Admin endpoints (protected - require auth)
    async getOrders(params = {}) {
        const queryParams = new URLSearchParams(params).toString();
        const endpoint = queryParams ? `/orders?${queryParams}` : '/orders';
        return this.authRequest(endpoint);
    }

    async getKitchenBoard() {
        return this.authRequest('/orders/kitchen');
    }

    async updateOrderStatus(orderId, newStatus) {
        return this.authRequest(`/orders/${orderId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
    }

    // Server-Sent Events for real-time updates
    createKitchenStream(onMessage, onError) {
        const url = `${this.baseUrl}/api/${this.tenantSlug}/events/kitchen`;
        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch (error) {
                console.error('Failed to parse SSE message:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            eventSource.close();
            if (onError) onError(error);
        };

        return eventSource;
    }

    createOrderTrackingStream(orderId, onMessage, onError) {
        const url = `${this.baseUrl}/api/${this.tenantSlug}/events/order/${orderId}`;
        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch (error) {
                console.error('Failed to parse SSE message:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            eventSource.close();
            if (onError) onError(error);
        };

        return eventSource;
    }
}

// Create global API instance
const api = new QortaAPI();
