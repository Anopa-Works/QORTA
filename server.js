/**
 * QORTA Backend - Main Server
 * Multi-tenant SaaS backend for restaurant ordering
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Routes
const tenantRoutes = require('./routes/tenant');
const menuRoutes = require('./routes/menu');
const categoryRoutes = require('./routes/categories');
const orderRoutes = require('./routes/orders');
const eventRoutes = require('./routes/events');
const authRoutes = require('./routes/auth');

// Global Crash Handlers for Debugging
process.on('uncaughtException', (err) => {
    console.error('CRITICAL ERROR: Uncaught Exception:', err);
    // Keep it alive for a moment to flush logs if possible, but generally we should exit
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL ERROR: Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Initialize Express app
const app = express();

// ================== MIDDLEWARE ==================

// Enable CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Serve static files from 'public' directory
app.use(express.static('public'));

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
    });
}

// ================== ROUTES ==================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'QORTA Backend'
    });
});

// Platform admin routes (tenant management)
app.use('/api/tenants', tenantRoutes);

// Tenant-scoped routes
app.use('/api/:slug/menu', menuRoutes);
app.use('/api/:slug/categories', categoryRoutes);
app.use('/api/:slug/orders', orderRoutes);
app.use('/api/:slug/events', eventRoutes);
app.use('/api/:slug/auth', authRoutes);

// ================== ERROR HANDLING ==================

// Tenant-specific Pages (Serve static files with context)
app.get('/:slug/admin', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'admin.html'));
});

app.get('/:slug/kitchen', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'kitchen.html'));
});

app.get('/:slug/login', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'admin-login.html'));
});

app.get('/:slug/history', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'history.html'));
});

app.get('/:slug/track', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'track.html'));
});

app.get('/:slug/track/:id', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'track.html'));
});

// Main Menu (Tenant Index)
app.get('/:slug', (req, res, next) => {
    // Prevent system directories from being treated as slugs
    const systemPaths = ['api', 'js', 'css', 'images', 'favicon.ico'];
    if (systemPaths.includes(req.params.slug)) {
        return next();
    }
    res.sendFile(require('path').join(__dirname, 'public', 'index.html'));
});

// Root Path (No Tenant) - Should probably show a landing page or 404
// WE DO NOT DEFAULT TO ANY RESTAURANT.
app.get('/', (req, res) => {
    res.status(404).send('<h1>404 - No Restaurant Selected</h1><p>Please use the restaurant URL you were given.</p>');
});

// SPA Fallback: Serve index.html for any remaining non-API routes
// This allows paths like /chicken-matty to be handled by the frontend (menu)
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(require('path').join(__dirname, 'public', 'index.html'));
});

// 404 handler (for API only now)
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ================== START SERVER ==================

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   QORTA Backend Server                            ║
║   Multi-tenant Restaurant Ordering System         ║
║                                                   ║
║   Running on: http://0.0.0.0:${PORT}              ║
║   Environment: ${process.env.NODE_ENV || 'development'}                     ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
});

// Render / Load Balancer Keep-Alive settings
// Prevents 502 Bad Gateway errors by ensuring Node waits longer than the LB
server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

module.exports = app;
