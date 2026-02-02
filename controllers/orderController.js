/**
 * QORTA Backend - Order Controller
 * Handles order creation, status updates, and kitchen board
 */

const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const { ORDER_STATUS, STATUS_TRANSITIONS } = require('../config/constants');
const {
    calculateSubtotal,
    calculateTax,
    calculateTotal,
    formatOrderForKitchen,
    formatOrderForTracking
} = require('../utils/orderUtils');

// Store SSE clients for real-time updates
const kitchenClients = new Map();  // tenantId -> Set of response objects
const orderClients = new Map();    // orderId -> Set of response objects

// Create new order
const createOrder = async (req, res, next) => {
    try {
        const { items, orderType, tableNumber, customerName, deliveryPlatform, notes, deliveryAddress, deliveryPhone } = req.body;

        // Enrich items with menu data
        const enrichedItems = await Promise.all(items.map(async (item) => {
            const menuItem = await MenuItem.findById(item.menuItemId);
            if (!menuItem) {
                throw Object.assign(new Error(`Menu item not found: ${item.menuItemId}`), { code: 'NOT_FOUND' });
            }

            return {
                menuItemId: item.menuItemId,
                name: menuItem.name,
                quantity: item.quantity,
                unitPrice: menuItem.price,
                modifiers: item.modifiers || [],
                modifierPrices: item.modifierPrices || [],
                notes: item.notes || '',
                allergyAlert: item.allergyAlert || menuItem.allergens?.[0] || null
            };
        }));

        // Calculate totals
        const subtotal = calculateSubtotal(enrichedItems);
        const taxRate = req.tenant.settings.taxRate;
        const taxAmount = calculateTax(subtotal, taxRate);
        const total = calculateTotal(subtotal, taxAmount);

        const orderData = {
            tenantId: req.tenant.id,
            items: enrichedItems,
            orderType,
            tableNumber,
            customerName,
            deliveryPlatform,
            notes: notes || '',
            deliveryAddress: deliveryAddress || null,
            deliveryPhone: deliveryPhone || null,
            subtotal,
            taxRate,
            taxAmount,
            total
        };

        const order = await Order.create(orderData);

        // Notify kitchen clients
        broadcastToKitchen(req.tenant.id, {
            type: 'NEW_ORDER',
            order: formatOrderForKitchen(order)
        });

        res.status(201).json({
            success: true,
            data: order
        });
    } catch (error) {
        next(error);
    }
};

// Get order by ID
const getOrder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);

        if (!order || order.tenantId !== req.tenant.id) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        next(error);
    }
};

// Get order for customer tracking
const trackOrder = async (req, res, next) => {
    try {
        const { orderNumber } = req.params;
        const order = await Order.findByOrderNumber(req.tenant.id, orderNumber);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        res.json({
            success: true,
            data: formatOrderForTracking(order)
        });
    } catch (error) {
        next(error);
    }
};

// Get all orders (admin)
const getOrders = async (req, res, next) => {
    try {
        const { status, limit } = req.query;
        const options = {};
        if (status) options.status = status;
        if (limit) options.limit = parseInt(limit);

        const orders = await Order.findByTenant(req.tenant.id, options);

        res.json({
            success: true,
            data: orders
        });
    } catch (error) {
        next(error);
    }
};

// Get kitchen board (admin)
const getKitchenBoard = async (req, res, next) => {
    try {
        const kitchenData = await Order.getKitchenBoard(req.tenant.id);

        // Format orders for kitchen display
        const formattedOrders = {
            [ORDER_STATUS.NEW]: kitchenData.orders[ORDER_STATUS.NEW].map(formatOrderForKitchen),
            [ORDER_STATUS.PREP]: kitchenData.orders[ORDER_STATUS.PREP].map(formatOrderForKitchen),
            [ORDER_STATUS.READY]: kitchenData.orders[ORDER_STATUS.READY].map(formatOrderForKitchen)
        };

        res.json({
            success: true,
            data: {
                counts: kitchenData.counts,
                avgPrepTime: kitchenData.avgPrepTime,
                orders: formattedOrders
            }
        });
    } catch (error) {
        next(error);
    }
};

// Update order status (admin)
const updateOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, note } = req.body;

        const order = await Order.findById(id);

        if (!order || order.tenantId !== req.tenant.id) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        // Validate status transition
        const allowedTransitions = STATUS_TRANSITIONS[order.status];
        if (!allowedTransitions.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Cannot transition from ${order.status} to ${status}`
            });
        }

        const updatedOrder = await Order.updateStatus(id, status, note);

        // Broadcast to kitchen
        broadcastToKitchen(req.tenant.id, {
            type: 'ORDER_STATUS_CHANGED',
            order: formatOrderForKitchen(updatedOrder)
        });

        // Broadcast to order tracking clients
        broadcastToOrder(id, {
            type: 'STATUS_UPDATE',
            data: formatOrderForTracking(updatedOrder)
        });

        res.json({
            success: true,
            data: updatedOrder
        });
    } catch (error) {
        next(error);
    }
};

// ================== SSE HELPERS ==================

const broadcastToKitchen = (tenantId, data) => {
    const clients = kitchenClients.get(tenantId);
    if (clients) {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        clients.forEach(client => {
            client.write(message);
        });
    }
};

const broadcastToOrder = (orderId, data) => {
    const clients = orderClients.get(orderId);
    if (clients) {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        clients.forEach(client => {
            client.write(message);
        });
    }
};

// Register SSE client for kitchen
const registerKitchenClient = (tenantId, res) => {
    if (!kitchenClients.has(tenantId)) {
        kitchenClients.set(tenantId, new Set());
    }
    kitchenClients.get(tenantId).add(res);
};

// Unregister SSE client for kitchen
const unregisterKitchenClient = (tenantId, res) => {
    const clients = kitchenClients.get(tenantId);
    if (clients) {
        clients.delete(res);
    }
};

// Register SSE client for order tracking
const registerOrderClient = (orderId, res) => {
    if (!orderClients.has(orderId)) {
        orderClients.set(orderId, new Set());
    }
    orderClients.get(orderId).add(res);
};

// Unregister SSE client for order tracking
const unregisterOrderClient = (orderId, res) => {
    const clients = orderClients.get(orderId);
    if (clients) {
        clients.delete(res);
    }
};

module.exports = {
    createOrder,
    getOrder,
    trackOrder,
    getOrders,
    getKitchenBoard,
    updateOrderStatus,
    registerKitchenClient,
    unregisterKitchenClient,
    registerOrderClient,
    unregisterOrderClient
};
