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

// ================== DYNAMIC ROUTES (LAST) ==================

// Get single order (for customer tracking page) - MUST BE LAST
router.get('/:id', getOrder);

module.exports = router;
