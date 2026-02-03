/**
 * QORTA Backend - Events Controller
 * Server-Sent Events for real-time updates
 */

const Order = require('../models/Order');
const {
    registerKitchenClient,
    unregisterKitchenClient,
    registerOrderClient,
    unregisterOrderClient
} = require('./orderController');
const { formatOrderForKitchen, formatOrderForTracking } = require('../utils/orderUtils');

// SSE stream for kitchen board
const kitchenStream = async (req, res) => {
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
};

// SSE stream for order tracking
const orderTrackingStream = async (req, res) => {
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
};

module.exports = {
    kitchenStream,
    orderTrackingStream
};
