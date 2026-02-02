/**
 * QORTA Backend - Order Routes
 * Tenant-scoped routes for orders and kitchen board
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const tenantResolver = require('../middleware/tenantResolver');
const { auth } = require('../middleware/auth');
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

// Create new order
router.post('/', validateOrder, createOrder);

// Track order by order number (customer view)
router.get('/track/:orderNumber', trackOrder);

// ================== ADMIN ROUTES (PROTECTED) ==================

// Get kitchen board - PROTECTED
router.get('/kitchen', auth, getKitchenBoard);

// Get all orders (with optional filters)
router.get('/', auth, getOrders);

// Update order status - PROTECTED
router.patch('/:id/status', auth, validateStatusUpdate, updateOrderStatus);

// ================== DYNAMIC ROUTES (LAST) ==================

// Get single order (for customer tracking page) - MUST BE LAST
router.get('/:id', getOrder);

module.exports = router;
