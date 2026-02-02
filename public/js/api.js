/**
 * QORTA API Client
 * Handles all communication with the backend
 */

class QortaAPI {
    constructor() {
        // Use environment-based URL
        this.baseUrl = window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : (window.location.origin.includes('://api.')
                ? window.location.origin
                : window.location.origin.replace('://', '://api.'));

        // Extract tenant slug from URL
        this.tenantSlug = this.extractTenantSlug();
    }

    extractTenantSlug() {
        // For localhost development, use the seeded tenant
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'burger-palace';
        }

        // For production: URL format https://qorta.app/{slug}/menu
        const pathParts = window.location.pathname.split('/').filter(p => p);
        return pathParts[0] || 'burger-palace';
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
    async getMenu() {
        return this.request('/menu');
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
