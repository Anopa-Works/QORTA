/**
 * QORTA Backend - Events Routes
 * Server-Sent Events for real-time updates
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const tenantResolver = require('../middleware/tenantResolver');
const {
    kitchenStream,
    orderTrackingStream,
    waiterStream
} = require('../controllers/eventsController');

// Apply tenant resolver to all routes
router.use(tenantResolver);

// Kitchen board SSE stream
router.get('/kitchen', kitchenStream);

// Waiter dashboard SSE stream — receives ORDER_READY push from kitchen
router.get('/waiter', waiterStream);

// Order tracking SSE stream
router.get('/order/:id', orderTrackingStream);

module.exports = router;
