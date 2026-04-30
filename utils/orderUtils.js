/**
 * QORTA Backend - Order Utilities
 * Helper functions for order processing
 */

/**
 * Calculate subtotal from order items
 */
const calculateSubtotal = (items) => {
    return items.reduce((sum, item) => {
        const itemTotal = item.unitPrice * item.quantity;
        const modifiersTotal = (item.modifierPrices || []).reduce((m, p) => m + p, 0) * item.quantity;
        return sum + itemTotal + modifiersTotal;
    }, 0);
};

/**
 * Calculate tax amount
 */
const calculateTax = (subtotal, taxRate = 0.08) => {
    return Math.round(subtotal * taxRate * 100) / 100;
};

/**
 * Calculate total
 */
const calculateTotal = (subtotal, taxAmount) => {
    return Math.round((subtotal + taxAmount) * 100) / 100;
};

/**
 * Format price for display
 */
const formatPrice = (price, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
    }).format(price);
};

/**
 * Get relative time string (e.g., "Just now", "2m ago")
 */
const getRelativeTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1m ago';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1h ago';
    if (diffHours < 24) return `${diffHours}h ago`;

    return time.toLocaleDateString();
};

const { ORDER_CATEGORY } = require('../config/constants');

/**
 * Format order for kitchen board display
 */
const formatOrderForKitchen = (order) => {
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        orderType: order.orderType,
        orderCategory: order.orderCategory || ORDER_CATEGORY.RESTAURANT,
        eventId: order.eventId || null,
        seatReference: order.seatReference || null,
        tableNumber: order.tableNumber,
        deliveryPlatform: order.deliveryPlatform,
        customerName: order.customerName || '',
        waiterName: order.waiterName || null,
        notes: order.notes || '',
        deliveryAddress: order.deliveryAddress || null,
        deliveryPhone: order.deliveryPhone || null,
        items: order.items.map(item => ({
            quantity: item.quantity,
            name: item.name,
            modifiers: item.modifiers || [],
            allergyAlert: item.allergyAlert
        })),
        timeAgo: getRelativeTime(order.createdAt),
        createdAt: order.createdAt
    };
};

/**
 * Format order for customer tracking
 */
const formatOrderForTracking = (order) => {
    return {
        orderNumber: order.orderNumber,
        status: order.status,
        estimatedPrepTime: order.estimatedPrepTime,
        timeline: order.timeline.map(entry => ({
            status: entry.status,
            timestamp: entry.timestamp,
            note: entry.note,
            time: new Date(entry.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'Africa/Harare'
            })
        })),
        pickupLocation: order.pickupLocation,
        items: order.items.map(item => ({
            quantity: item.quantity,
            name: item.name,
            price: item.unitPrice * item.quantity
        })),
        total: order.total
    };
};

/**
 * Validate order items structure
 */
const validateOrderItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        return { valid: false, error: 'Order must have at least one item' };
    }

    for (const item of items) {
        if (!item.menuItemId || !item.name || !item.quantity || !item.unitPrice) {
            return { valid: false, error: 'Each item must have menuItemId, name, quantity, and unitPrice' };
        }
        if (item.quantity < 1) {
            return { valid: false, error: 'Item quantity must be at least 1' };
        }
    }

    return { valid: true };
};

module.exports = {
    calculateSubtotal,
    calculateTax,
    calculateTotal,
    formatPrice,
    getRelativeTime,
    formatOrderForKitchen,
    formatOrderForTracking,
    validateOrderItems
};
