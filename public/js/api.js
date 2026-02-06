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
            // No tenant context - let the app handle the "Not Found" state
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
            // Token retrieval failed - will proceed without auth
        }

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const url = `${this.baseUrl}/api/${this.tenantSlug}${endpoint}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Request failed' }));

                // Handle 401 - redirect to tenant-scoped login (SAFE REDIRECT)
                if (response.status === 401) {
                    this.safeRedirect(`/${this.tenantSlug}/login`);
                    return;
                }

                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Safe redirect - validates destination is within allowed paths
     * Prevents open redirect vulnerabilities
     */
    safeRedirect(path) {
        // Only allow relative paths starting with /
        if (!path || typeof path !== 'string' || !path.startsWith('/')) {
            return;
        }

        // Must be a tenant-scoped path or allowed root path
        const allowedRootPaths = ['/', '/landing'];
        const pathParts = path.split('/').filter(p => p);

        // Allow root paths
        if (allowedRootPaths.includes(path)) {
            window.location.href = path;
            return;
        }

        // Validate tenant-scoped redirect: /{slug}/...
        // First segment must be current tenant
        if (pathParts[0] === this.tenantSlug) {
            window.location.href = path;
            return;
        }

        // Block cross-tenant or invalid redirects
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
    createKitchenStream(token, onMessage, onError) {
        const url = `${this.baseUrl}/api/${this.tenantSlug}/events/kitchen?token=${encodeURIComponent(token)}`;
        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch (error) {
                // Parse error - skip malformed message
            }
        };

        eventSource.onerror = (error) => {
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
                // Parse error - skip malformed message
            }
        };

        eventSource.onerror = (error) => {
            eventSource.close();
            if (onError) onError(error);
        };

        return eventSource;
    }
}

// Create global API instance
const api = new QortaAPI();
