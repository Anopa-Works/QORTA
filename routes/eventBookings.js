/**
 * QORTA Backend - Event Bookings (Public Guest API)
 *
 * Naming note: this file is NOT to be confused with routes/events.js,
 * which handles SSE streams for kitchen/waiter/order updates. These two
 * concerns share the word "events" but are unrelated.
 *
 * Endpoints (mounted at /api/events):
 *   GET  /:slug           - Fetch event metadata for guest landing
 *   GET  /:slug/menu      - Fetch menu items for the event's tenant
 *   POST /:slug/orders    - Place an event order (no auth, no cart)
 */

const express = require('express');
const router = express.Router();

const Event = require('../models/Event');
const { EVENT_STATUS } = Event;
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const { getDb, COLLECTIONS } = require('../config/firebase');
const { ORDER_TYPE, ORDER_CATEGORY } = require('../config/constants');
const { calculateSubtotal, calculateTax, calculateTotal, formatOrderForKitchen } = require('../utils/orderUtils');
const { broadcastToKitchen } = require('../controllers/orderController');
const { orderLimiter } = require('../middleware/rateLimiter');
const { logger } = require('../utils/logger');

const SEAT_REFERENCE_REGEX = /^[1-9][0-9]{0,2}-[A-Z]$/;

/**
 * Resolves :slug → active Event, writing the appropriate response and
 * returning null if the event is missing or inactive. Centralizes the
 * lookup-then-validate pattern shared by all three handlers.
 */
async function loadActiveEvent(req, res) {
    const event = await Event.findBySlug(req.params.slug);
    if (!event) {
        res.status(404).json({ success: false, error: 'Event not found' });
        return null;
    }
    if (event.status !== EVENT_STATUS.ACTIVE) {
        res.status(403).json({ success: false, error: 'Event is no longer active' });
        return null;
    }
    return event;
}

router.get('/:slug', async (req, res) => {
    try {
        const event = await Event.findBySlug(req.params.slug);
        if (!event) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        // Inactive events return 200 so the guest UI can render the
        // "no longer active" state with the event name; the discriminator
        // is `data.inactive: true`. Active events never carry that flag.
        if (event.status !== EVENT_STATUS.ACTIVE) {
            return res.json({
                success: true,
                data: { name: event.name, status: event.status, inactive: true }
            });
        }

        res.json({
            success: true,
            data: {
                id: event.id,
                name: event.name,
                date: event.date,
                slug: event.slug,
                status: event.status
            }
        });
    } catch (error) {
        logger.error('Failed to fetch event by slug', {
            requestId: req.requestId,
            meta: { slug: req.params.slug, error: error.message }
        });
        res.status(500).json({ success: false, error: 'Failed to fetch event' });
    }
});

router.get('/:slug/menu', async (req, res) => {
    try {
        const event = await loadActiveEvent(req, res);
        if (!event) return;

        const items = await MenuItem.findByTenant(event.tenantId);
        const sanitized = items.map(item => ({
            id: item.id,
            name: item.name,
            description: item.description,
            category: item.category,
            imageUrl: item.imageUrl
        }));

        res.json({ success: true, data: sanitized });
    } catch (error) {
        logger.error('Failed to fetch event menu', {
            requestId: req.requestId,
            meta: { slug: req.params.slug, error: error.message }
        });
        res.status(500).json({ success: false, error: 'Failed to fetch menu' });
    }
});

router.post('/:slug/orders', orderLimiter, async (req, res) => {
    try {
        const { itemId, seatReference } = req.body || {};

        if (!itemId || typeof itemId !== 'string') {
            return res.status(400).json({ success: false, error: 'itemId is required' });
        }
        if (!seatReference || typeof seatReference !== 'string' || !SEAT_REFERENCE_REGEX.test(seatReference)) {
            return res.status(400).json({ success: false, error: 'Invalid seat reference (expected format: number-letter, e.g. 1-A)' });
        }

        const event = await loadActiveEvent(req, res);
        if (!event) return;

        // Tenant-doc and menu-item lookups are independent of each other
        // — fetch in parallel to shave a Firestore round-trip on every order.
        const [tenantDoc, menuItem] = await Promise.all([
            getDb().collection(COLLECTIONS.TENANTS).doc(event.tenantId).get(),
            MenuItem.findById(itemId)
        ]);

        if (!tenantDoc.exists) {
            return res.status(500).json({ success: false, error: 'Event tenant misconfigured' });
        }
        const tenantData = tenantDoc.data();
        if (tenantData.isActive === false) {
            return res.status(403).json({ success: false, error: 'Event tenant is unavailable' });
        }

        if (!menuItem || menuItem.tenantId !== event.tenantId) {
            return res.status(404).json({ success: false, error: 'Menu item not found' });
        }

        const enrichedItem = {
            menuItemId: menuItem.id,
            name: menuItem.name,
            quantity: 1,
            unitPrice: menuItem.price,
            modifiers: [],
            modifierPrices: [],
            notes: '',
            allergyAlert: menuItem.allergens?.[0] || null
        };

        const subtotal = calculateSubtotal([enrichedItem]);
        const taxRate = tenantData.settings?.taxRate ?? 0.08;
        const taxAmount = calculateTax(subtotal, taxRate);
        const total = calculateTotal(subtotal, taxAmount);

        const order = await Order.create({
            tenantId: event.tenantId,
            items: [enrichedItem],
            orderType: ORDER_TYPE.DINE_IN,
            orderCategory: ORDER_CATEGORY.EVENT,
            eventId: event.id,
            seatReference,
            tableNumber: null,
            customerName: '',
            notes: '',
            subtotal,
            taxRate,
            taxAmount,
            total,
            source: ORDER_CATEGORY.EVENT,
            waiterId: null,
            waiterName: null
        });

        broadcastToKitchen(event.tenantId, {
            type: 'NEW_ORDER',
            order: formatOrderForKitchen(order)
        });

        logger.info('Event order created', {
            requestId: req.requestId,
            tenantId: event.tenantId,
            meta: {
                eventId: event.id,
                orderId: order.id,
                seatReference,
                itemId
            }
        });

        res.status(201).json({
            success: true,
            data: {
                id: order.id,
                orderNumber: order.orderNumber,
                seatReference
            }
        });
    } catch (error) {
        logger.error('Failed to create event order', {
            requestId: req.requestId,
            meta: { slug: req.params.slug, error: error.message }
        });
        res.status(500).json({ success: false, error: 'Failed to place order' });
    }
});

module.exports = router;
