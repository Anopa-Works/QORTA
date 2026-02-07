/**
 * QORTA Service Worker
 * Enables offline menu viewing and faster load times
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `qorta-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `qorta-dynamic-${CACHE_VERSION}`;
const API_CACHE = `qorta-api-${CACHE_VERSION}`;

// Static assets to pre-cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/track.html',
    '/history.html',
    '/css/main.css',
    '/css/menu.css',
    '/css/loader.css',
    '/css/mobile-nav.css',
    '/js/api.js',
    '/js/cart.js',
    '/js/menu.js',
    '/js/mobile-nav.js',
    '/logos/q-mark.png',
    '/manifest.json'
];

// API endpoints to cache for offline use
const CACHEABLE_API_PATTERNS = [
    /\/api\/[^/]+\/menu$/,
    /\/api\/[^/]+\/categories$/,
    /\/api\/[^/]+\/featured$/
];

// Install event - pre-cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => {
                return Promise.all(
                    keys
                        .filter((key) => key.startsWith('qorta-') &&
                                        key !== STATIC_CACHE &&
                                        key !== DYNAMIC_CACHE &&
                                        key !== API_CACHE)
                        .map((key) => caches.delete(key))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) return;

    // Handle API requests
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleApiRequest(request));
        return;
    }

    // Handle static assets
    event.respondWith(handleStaticRequest(request));
});

/**
 * Handle API requests - Network first, cache fallback
 * Caches menu/categories for offline viewing
 */
async function handleApiRequest(request) {
    const url = new URL(request.url);
    const isCacheable = CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname));

    try {
        // Try network first
        const response = await fetch(request);

        // Cache successful GET responses for cacheable endpoints
        if (response.ok && isCacheable) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        // Network failed - try cache
        if (isCacheable) {
            const cached = await caches.match(request);
            if (cached) {
                return cached;
            }
        }

        // Return offline response for menu requests
        if (url.pathname.includes('/menu')) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'You are offline. Please check your connection.',
                    offline: true
                }),
                {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        throw error;
    }
}

/**
 * Handle static requests - Cache first, network fallback
 */
async function handleStaticRequest(request) {
    // Check cache first
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        // Fetch from network
        const response = await fetch(request);

        // Cache successful responses
        if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        // For HTML navigation requests, return cached index
        if (request.headers.get('accept')?.includes('text/html')) {
            const cachedIndex = await caches.match('/index.html');
            if (cachedIndex) {
                return cachedIndex;
            }
        }

        // Return offline page or error
        return new Response('Offline', { status: 503 });
    }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }

    if (event.data === 'clearCache') {
        event.waitUntil(
            caches.keys().then((keys) => {
                return Promise.all(keys.map((key) => caches.delete(key)));
            })
        );
    }
});
