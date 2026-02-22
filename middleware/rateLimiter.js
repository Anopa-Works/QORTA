/**
 * QORTA Backend - Rate Limiter Middleware
 * Simple in-memory rate limiting for abuse prevention
 *
 * NOTE: For production scale, consider Redis-backed rate limiting
 * This implementation is suitable for Tier 1 (single-instance deployment)
 */

const { logger } = require('../utils/logger');

// In-memory store for rate limiting
const requestCounts = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
        if (now - data.windowStart > 60000) {
            requestCounts.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Create a rate limiter middleware
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @param {number} options.max - Maximum requests per window (default: 100)
 * @param {string} options.message - Error message when rate limited
 * @param {Function} options.keyGenerator - Function to generate rate limit key (default: IP-based)
 */
const createRateLimiter = (options = {}) => {
    const {
        windowMs = 60000,
        max = 100,
        message = 'Too many requests. Please try again later.',
        keyGenerator = (req) => {
            // Use IP + tenant for rate limiting
            const ip = req.ip || req.socket?.remoteAddress || 'unknown';
            const tenant = req.params.slug || 'global';
            return `${ip}:${tenant}`;
        },
        skipSuccessfulRequests = false,
        skipFailedRequests = false
    } = options;

    return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();

        // Get or create request data
        let data = requestCounts.get(key);

        if (!data || now - data.windowStart > windowMs) {
            // New window
            data = {
                count: 0,
                windowStart: now
            };
            requestCounts.set(key, data);
        }

        data.count++;

        // Set rate limit headers
        const remaining = Math.max(0, max - data.count);
        const resetTime = Math.ceil((data.windowStart + windowMs) / 1000);

        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', resetTime);

        // Check if rate limited
        if (data.count > max) {
            logger.security(`Rate limit exceeded: ${key}`, {
                requestId: req.requestId,
                tenantId: req.params.slug,
                meta: { count: data.count, limit: max }
            });

            res.setHeader('Retry-After', Math.ceil(windowMs / 1000));

            return res.status(429).json({
                success: false,
                error: message,
                code: 'RATE_LIMITED',
                retryAfter: Math.ceil((data.windowStart + windowMs - now) / 1000)
            });
        }

        next();
    };
};

// Pre-configured rate limiters for different endpoints

// Standard API rate limiter - 100 requests per minute
const apiLimiter = createRateLimiter({
    windowMs: 60000,
    max: 100,
    message: 'Too many requests. Please slow down.'
});

// Auth rate limiter - 10 login attempts per minute (brute force protection)
// Compound key: tenant + IP to prevent cross-tenant attacks
const authLimiter = createRateLimiter({
    windowMs: 60000,
    max: 10,
    message: 'Too many authentication attempts. Please wait before trying again.',
    keyGenerator: (req) => {
        const ip = req.ip || req.socket?.remoteAddress || 'unknown';
        const tenant = req.params.slug || 'global';
        return `auth:${tenant}:${ip}`;
    }
});

// Order creation rate limiter - 20 orders per minute
// Compound key: tenant + IP to scope limits per restaurant
const orderLimiter = createRateLimiter({
    windowMs: 60000,
    max: 20,
    message: 'Too many orders. Please wait before placing another order.',
    keyGenerator: (req) => {
        const ip = req.ip || req.socket?.remoteAddress || 'unknown';
        const tenant = req.params.slug || 'global';
        return `order:${tenant}:${ip}`;
    }
});

// Strict limiter for sensitive operations - 5 per minute
const strictLimiter = createRateLimiter({
    windowMs: 60000,
    max: 5,
    message: 'Too many attempts. Please try again later.'
});

module.exports = {
    createRateLimiter,
    apiLimiter,
    authLimiter,
    orderLimiter,
    strictLimiter
};
