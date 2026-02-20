/**
 * QORTA Backend - Main Server
 * Multi-tenant SaaS backend for restaurant ordering
 *
 * SECURITY HARDENED:
 * - Strict CORS allowlist (no wildcards in production)
 * - Structured logging (no console.log)
 * - Tenant validation on page routes
 * - Request ID tracking
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { logger, requestLogger } = require('./utils/logger');
const { apiLimiter, authLimiter, orderLimiter } = require('./middleware/rateLimiter');

// Routes
const tenantRoutes = require('./routes/tenant');
const platformRoutes = require('./routes/platform');
const menuRoutes = require('./routes/menu');
const categoryRoutes = require('./routes/categories');
const orderRoutes = require('./routes/orders');
const eventRoutes = require('./routes/events');
const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');

// Models
const Tenant = require('./models/Tenant');

// ================== GLOBAL ERROR HANDLERS ==================

process.on('uncaughtException', (err) => {
    logger.error('CRITICAL: Uncaught Exception', {
        meta: { message: err.message, stack: err.stack }
    });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('CRITICAL: Unhandled Rejection', {
        meta: { reason: String(reason) }
    });
    process.exit(1);
});

// Initialize Express app
const app = express();

// ================== SECURITY: CORS CONFIGURATION ==================

/**
 * CORS Allowlist - CRITICAL SECURITY
 * NO WILDCARDS IN PRODUCTION
 */
const getAllowedOrigins = () => {
    const origins = [];

    // Production domains (from environment)
    if (process.env.CORS_ALLOWED_ORIGINS) {
        origins.push(...process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()));
    }

    // Default production domain
    if (process.env.PRODUCTION_URL) {
        origins.push(process.env.PRODUCTION_URL);
    }

    // Development only
    if (process.env.NODE_ENV !== 'production') {
        origins.push('http://localhost:3000');
        origins.push('http://localhost:5500');
        origins.push('http://127.0.0.1:3000');
        origins.push('http://127.0.0.1:5500');
    }

    return origins;
};

const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();

        // Allow requests with no origin (same-origin, mobile apps)
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.security(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
};

app.use(cors(corsOptions));

// ================== MIDDLEWARE ==================

// Parse JSON bodies (with size limit for security)
app.use(express.json({ limit: '10kb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logging and ID generation
app.use(requestLogger);

// Serve static files from 'public' directory
app.use(express.static('public'));

// ================== HELPER: TENANT VALIDATION ==================

/**
 * Validate tenant exists before serving page
 * Prevents serving app shell for non-existent tenants
 */
const validateTenantForPage = async (req, res, next) => {
    const { slug } = req.params;

    // Skip system paths
    const systemPaths = ['api', 'js', 'css', 'images', 'favicon.ico', 'landing', 'logos', 'platform'];
    if (systemPaths.includes(slug)) {
        return next();
    }

    try {
        const tenant = await Tenant.findBySlug(slug);

        if (!tenant) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head><title>Restaurant Not Found</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1>Restaurant Not Found</h1>
                    <p>The restaurant "${slug}" does not exist or is no longer available.</p>
                    <p>Please check the URL you were given.</p>
                </body>
                </html>
            `);
        }

        if (!tenant.isActive) {
            return res.status(403).send(`
                <!DOCTYPE html>
                <html>
                <head><title>Restaurant Unavailable</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1>Restaurant Temporarily Unavailable</h1>
                    <p>This restaurant is currently not accepting orders.</p>
                    <p>Please try again later.</p>
                </body>
                </html>
            `);
        }

        // Tenant is valid, proceed
        next();
    } catch (error) {
        logger.error('Tenant validation failed', {
            tenantId: slug,
            meta: { error: error.message }
        });
        return res.status(500).send('Server error. Please try again.');
    }
};

// ================== ROUTES ==================

// Health check (no auth required)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'QORTA Backend'
    });
});

// Platform admin dashboard (SUPER_ADMIN only - auth handled client-side)
app.get('/platform/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'platform', 'admin.html'));
});

// Super admin routes (SUPER_ADMIN only)
app.use('/api/platform', apiLimiter, platformRoutes);

// Legacy tenant routes (for existing admin functionality)
app.use('/api/tenants', apiLimiter, tenantRoutes);

// Tenant-scoped API routes with rate limiting
app.use('/api/:slug/config', apiLimiter, configRoutes);
app.use('/api/:slug/menu', apiLimiter, menuRoutes);
app.use('/api/:slug/categories', apiLimiter, categoryRoutes);
app.use('/api/:slug/orders', orderLimiter, orderRoutes);  // Stricter limit for orders
app.use('/api/:slug/events', apiLimiter, eventRoutes);
app.use('/api/:slug/auth', authLimiter, authRoutes);      // Brute force protection

// ================== TENANT PAGE ROUTES ==================
// All tenant pages validate tenant exists BEFORE serving HTML

app.get('/:slug/admin', validateTenantForPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/:slug/kitchen', validateTenantForPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'kitchen.html'));
});

app.get('/:slug/login', validateTenantForPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/:slug/waiter-login', validateTenantForPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'waiter-login.html'));
});

app.get('/:slug/waiter', validateTenantForPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'waiter.html'));
});

app.get('/:slug/history', validateTenantForPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'history.html'));
});

app.get('/:slug/track', validateTenantForPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'track.html'));
});

app.get('/:slug/track/:id', validateTenantForPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'track.html'));
});

// Main Menu (Tenant Index)
app.get('/:slug', validateTenantForPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ================== ROOT & FALLBACK ==================

// Root Path - No tenant selected
app.get('/', (req, res) => {
    // Serve landing page if it exists
    res.sendFile(path.join(__dirname, 'public', 'landing', 'index.html'), (err) => {
        if (err) {
            res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head><title>QORTA</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1>Welcome to QORTA</h1>
                    <p>Please use the restaurant URL you were given to place an order.</p>
                </body>
                </html>
            `);
        }
    });
});

// SPA Fallback - validate tenant before serving
app.get('*', async (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
        return next();
    }

    // Extract potential slug from path
    const pathParts = req.path.split('/').filter(p => p);
    const possibleSlug = pathParts[0];

    // Skip system paths
    const systemPaths = ['api', 'js', 'css', 'images', 'favicon.ico', 'landing', 'logos', 'platform'];
    if (!possibleSlug || systemPaths.includes(possibleSlug)) {
        return next();
    }

    // Validate tenant exists
    try {
        const tenant = await Tenant.findBySlug(possibleSlug);
        if (tenant && tenant.isActive) {
            return res.sendFile(path.join(__dirname, 'public', 'index.html'));
        }
    } catch (error) {
        logger.debug('SPA fallback tenant check failed', { meta: { path: req.path } });
    }

    next();
});

// 404 handler (for API routes)
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ================== START SERVER ==================

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`QORTA Backend started on port ${PORT}`, {
        meta: { environment: process.env.NODE_ENV || 'development' }
    });
});

// Keep-Alive settings for load balancers
server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

module.exports = app;
