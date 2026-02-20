/**
 * QORTA Backend - Order Routes
 * Tenant-scoped routes for orders and kitchen board
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const tenantResolver = require('../middleware/tenantResolver');
const { auth, optionalAuth } = require('../middleware/auth');
const { validateOrder, validateStatusUpdate } = require('../middleware/validateRequest');
const {
    createOrder,
    getOrder,
    trackOrder,
    getOrders,
    getKitchenBoard,
    updateOrderStatus
} = require('../controllers/orderController');

// Apply tenant resolver to all routes
router.use(tenantResolver);

// ================== CUSTOMER ROUTES (PUBLIC) ==================

// Create new order - optionalAuth allows waiter orders with token OR customer orders without
router.post('/', optionalAuth, validateOrder, createOrder);

// Track order by order number (customer view)
router.get('/track/:orderNumber', trackOrder);

// ================== ADMIN ROUTES (PROTECTED) ==================

// Get kitchen board - Open for Service Mode (waiters need to see orders)
router.get('/kitchen', getKitchenBoard);

// Get all orders (with optional filters)
router.get('/', auth, getOrders);

// Update order status - PROTECTED
router.patch('/:id/status', auth, validateStatusUpdate, updateOrderStatus);

// ================== SERVICE REQUESTS (PUBLIC) ==================

// Service request endpoint - customers can request waiter service
router.post('/service-requests', async (req, res) => {
    try {
        const { tableNumber, message } = req.body;

        if (!tableNumber) {
            return res.status(400).json({
                success: false,
                error: 'Table number is required'
            });
        }

        const { logger } = require('../utils/logger');
        const { getDb } = require('../config/firebase');
        const db = getDb();

        // Create service request document
        const serviceRequest = {
            tenantId: req.tenant.id,
            tableNumber: parseInt(tableNumber),
            message: message || `Service request - Table ${tableNumber}`,
            status: 'PENDING',
            createdAt: new Date(),
            resolvedAt: null
        };

        const docRef = await db.collection('serviceRequests').add(serviceRequest);

        logger.info('Service request created', {
            requestId: req.requestId,
            tenantId: req.tenant.id,
            meta: {
                serviceRequestId: docRef.id,
                tableNumber
            }
        });

        // TODO: Broadcast to waiter dashboard via SSE

        res.json({
            success: true,
            message: 'Waiter notified',
            data: {
                id: docRef.id,
                tableNumber
            }
        });

    } catch (error) {
        const { logger } = require('../utils/logger');
        logger.error('Failed to create service request', {
            requestId: req.requestId,
            tenantId: req.tenant?.id,
            meta: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Failed to send service request'
        });
    }
});

// ================== DYNAMIC ROUTES (LAST) ==================

// Get single order (for customer tracking page) - MUST BE LAST
router.get('/:id', getOrder);

module.exports = router;
