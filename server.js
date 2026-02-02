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

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ================== START SERVER ==================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   QORTA Backend Server                            ║
║   Multi-tenant Restaurant Ordering System         ║
║                                                   ║
║   Running on: http://localhost:${PORT}              ║
║   Environment: ${process.env.NODE_ENV || 'development'}                     ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
});

module.exports = app;
