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

// Get pending service requests - PROTECTED (waiters only)
router.get('/service-requests', auth, async (req, res) => {
    try {
        const { getDb } = require('../config/firebase');
        const db = getDb();

        // Fetch pending service requests for this tenant
        // Note: No orderBy to avoid needing composite index
        const snapshot = await db.collection('serviceRequests')
            .where('tenantId', '==', req.tenant.id)
            .where('status', '==', 'PENDING')
            .limit(50)
            .get();

        // Filter by assigned tables (in-memory to avoid Firestore 'in' operator 10-item limit)
        const assignedTables = req.user.assignedTables;
        const requests = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // If assignedTables is null/undefined, user sees all tables
            // If assignedTables is array, filter by tableNumber
            if (assignedTables === null || assignedTables === undefined ||
                assignedTables.includes(data.tableNumber)) {
                requests.push({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.() || data.createdAt
                });
            }
        });

        // Sort by createdAt descending on the server side
        requests.sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
            const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
            return dateB - dateA;
        });

        res.json({
            success: true,
            data: requests
        });

    } catch (error) {
        const { logger } = require('../utils/logger');
        logger.error('Failed to fetch service requests', {
            requestId: req.requestId,
            tenantId: req.tenant?.id,
            meta: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Failed to fetch service requests'
        });
    }
});

// Resolve service request - PROTECTED (waiters only)
router.patch('/service-requests/:id/resolve', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { getDb } = require('../config/firebase');
        const db = getDb();

        // Update service request status
        await db.collection('serviceRequests').doc(id).update({
            status: 'RESOLVED',
            resolvedAt: new Date()
        });

        const { logger } = require('../utils/logger');
        logger.info('Service request resolved', {
            requestId: req.requestId,
            tenantId: req.tenant.id,
            meta: { serviceRequestId: id }
        });

        res.json({
            success: true,
            message: 'Service request resolved'
        });

    } catch (error) {
        const { logger } = require('../utils/logger');
        logger.error('Failed to resolve service request', {
            requestId: req.requestId,
            tenantId: req.tenant?.id,
            meta: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Failed to resolve service request'
        });
    }
});

// ================== DYNAMIC ROUTES (LAST) ==================

// Get single order (for customer tracking page) - MUST BE LAST
router.get('/:id', getOrder);

module.exports = router;
