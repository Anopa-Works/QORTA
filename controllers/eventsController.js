/**
 * QORTA Backend - Events Controller
 * Server-Sent Events for real-time updates
 */

const admin = require('firebase-admin');
const Order = require('../models/Order');
const {
    registerKitchenClient,
    unregisterKitchenClient,
    registerOrderClient,
    unregisterOrderClient,
    registerWaiterClient,
    unregisterWaiterClient
} = require('./orderController');
const { formatOrderForKitchen, formatOrderForTracking } = require('../utils/orderUtils');

// SSE stream for kitchen board
const kitchenStream = async (req, res) => {
    try {
        const { logger } = require('../utils/logger');
        // Optional auth for Service Mode - kitchen can stream without login
        const { token } = req.query;

        logger.info('🔌 SSE Kitchen connection attempt', {
            requestId: req.requestId,
            tenantId: req.tenant?.id,
            meta: {
                hasToken: !!token,
                tenantSlug: req.tenant?.slug
            }
        });

        if (token) {
            // If token provided, verify it
            const decodedToken = await admin.auth().verifyIdToken(token);
            const db = admin.firestore();
            const adminDoc = await db.collection('admins').doc(decodedToken.uid).get();

            logger.info('🔐 SSE Token verified', {
                requestId: req.requestId,
                tenantId: req.tenant?.id,
                meta: {
                    userUid: decodedToken.uid,
                    userEmail: decodedToken.email,
                    adminDocExists: adminDoc.exists,
                    adminTenantId: adminDoc.exists ? adminDoc.data().tenantId : null,
                    requestTenantId: req.tenant?.id,
                    match: adminDoc.exists && adminDoc.data().tenantId === req.tenant.id
                }
            });

            if (!adminDoc.exists || adminDoc.data().tenantId !== req.tenant.id) {
                logger.warn('❌ SSE Access denied', {
                    requestId: req.requestId,
                    tenantId: req.tenant?.id,
                    meta: {
                        reason: !adminDoc.exists ? 'Admin doc not found' : 'Tenant ID mismatch',
                        userUid: decodedToken.uid,
                        adminTenantId: adminDoc.exists ? adminDoc.data().tenantId : null,
                        requestTenantId: req.tenant?.id
                    }
                });
                return res.status(403).json({ success: false, error: 'Access denied' });
            }
        } else {
            // No token provided — only allow if service mode is explicitly enabled for this tenant
            const isServiceModeEnabled = req.tenant.settings?.serviceMode?.enabled === true;
            if (!isServiceModeEnabled) {
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }
        }

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // Send initial data
        const { ORDER_STATUS } = require('../config/constants');
        const kitchenData = await Order.getKitchenBoard(req.tenant.id);

    const initialData = {
        type: 'INITIAL',
        data: {
            counts: kitchenData.counts,
            avgPrepTime: kitchenData.avgPrepTime,
            orders: {
                [ORDER_STATUS.NEW]: kitchenData.orders[ORDER_STATUS.NEW].map(formatOrderForKitchen),
                [ORDER_STATUS.PREP]: kitchenData.orders[ORDER_STATUS.PREP].map(formatOrderForKitchen),
                [ORDER_STATUS.READY]: kitchenData.orders[ORDER_STATUS.READY].map(formatOrderForKitchen)
            }
        }
    };

    res.write(`data: ${JSON.stringify(initialData)}\n\n`);

    // Register client
    registerKitchenClient(req.tenant.id, res);

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

        // Clean up on close
        req.on('close', () => {
            clearInterval(heartbeat);
            unregisterKitchenClient(req.tenant.id, res);
        });
    } catch (error) {
        const { logger } = require('../utils/logger');
        logger.error('Kitchen SSE error', { meta: { message: error.message, code: error.code } });
        if (!res.headersSent) {
            return res.status(error.code === 'auth/argument-error' ? 401 : 500).json({
                success: false,
                error: 'Stream error'
            });
        }
    }
};

// SSE stream for order tracking
const orderTrackingStream = async (req, res) => {
    try {
        const { id } = req.params;

        // Verify order exists and belongs to tenant
        const order = await Order.findById(req.tenant.id, id);
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial data
    const initialData = {
        type: 'INITIAL',
        data: formatOrderForTracking(order)
    };

    res.write(`data: ${JSON.stringify(initialData)}\n\n`);

    // Register client
    registerOrderClient(id, res);

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

        // Clean up on close
        req.on('close', () => {
            clearInterval(heartbeat);
            unregisterOrderClient(id, res);
        });
    } catch (error) {
        const { logger } = require('../utils/logger');
        logger.error('Order tracking SSE error', { meta: { message: error.message } });
        if (!res.headersSent) {
            return res.status(500).json({ success: false, error: 'Stream error' });
        }
    }
};

// SSE stream for waiter dashboard — keyed by waiter email
const waiterStream = async (req, res) => {
    try {
        const { logger } = require('../utils/logger');
        const { token } = req.query;

        if (!token) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        // Verify token and confirm waiter belongs to this tenant
        const decodedToken = await admin.auth().verifyIdToken(token);
        const db = admin.firestore();
        const adminDoc = await db.collection('admins').doc(decodedToken.uid).get();

        if (!adminDoc.exists || adminDoc.data().tenantId !== req.tenant.id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const waiterEmail = decodedToken.email;

        logger.info('🔌 SSE Waiter connection', {
            requestId: req.requestId,
            tenantId: req.tenant?.id,
            meta: { waiterEmail }
        });

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // Confirm connection to client
        res.write(`data: ${JSON.stringify({ type: 'CONNECTED', waiterEmail })}\n\n`);

        // Register this waiter's SSE connection
        registerWaiterClient(req.tenant.id, waiterEmail, res);

        // Heartbeat every 30 seconds
        const heartbeat = setInterval(() => {
            res.write(': heartbeat\n\n');
        }, 30000);

        // Clean up on disconnect
        req.on('close', () => {
            clearInterval(heartbeat);
            unregisterWaiterClient(req.tenant.id, waiterEmail, res);
        });
    } catch (error) {
        const { logger } = require('../utils/logger');
        logger.error('Waiter SSE error', { meta: { message: error.message, code: error.code } });
        if (!res.headersSent) {
            return res.status(error.code === 'auth/argument-error' ? 401 : 500).json({
                success: false,
                error: 'Stream error'
            });
        }
    }
};

module.exports = {
    kitchenStream,
    orderTrackingStream,
    waiterStream
};
