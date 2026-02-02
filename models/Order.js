/**
 * QORTA Backend - Order Model
 * Orders scoped to each tenant with status tracking
 * Simplified queries to avoid Firestore composite index requirements
 */

const { getDb, COLLECTIONS } = require('../config/firebase');
const { ORDER_STATUS, ORDER_TYPE, PAYMENT_STATUS } = require('../config/constants');

class Order {
    constructor(data) {
        this.id = data.id;
        this.tenantId = data.tenantId;
        this.orderNumber = data.orderNumber;              // #101, #102
        this.status = data.status ?? ORDER_STATUS.NEW;
        this.orderType = data.orderType ?? ORDER_TYPE.DINE_IN;
        this.tableNumber = data.tableNumber ?? null;      // Table 12 (null if not provided)
        this.deliveryPlatform = data.deliveryPlatform ?? null;  // "UberEats" (null if not provided)
        this.customerName = data.customerName ?? '';
        this.notes = data.notes ?? '';                    // Special instructions / allergies
        this.deliveryAddress = data.deliveryAddress ?? null;  // Delivery address
        this.deliveryPhone = data.deliveryPhone ?? null;      // Customer phone for delivery
        this.items = data.items ?? [];                    // Array of order items
        this.subtotal = data.subtotal ?? 0;
        this.taxRate = data.taxRate ?? 0.08;
        this.taxAmount = data.taxAmount ?? 0;
        this.total = data.total ?? 0;
        this.payment = data.payment ?? {
            status: PAYMENT_STATUS.PENDING,
            method: null,
            lastFour: null
        };
        this.estimatedPrepTime = data.estimatedPrepTime ?? 5;
        this.timeline = data.timeline ?? [];
        this.pickupLocation = data.pickupLocation ?? '';
        this.createdAt = data.createdAt ?? new Date();
        this.updatedAt = data.updatedAt ?? new Date();
    }

    toFirestore() {
        return {
            tenantId: this.tenantId,
            orderNumber: this.orderNumber,
            status: this.status,
            orderType: this.orderType,
            tableNumber: this.tableNumber,
            deliveryPlatform: this.deliveryPlatform,
            customerName: this.customerName,
            notes: this.notes,
            deliveryAddress: this.deliveryAddress,
            deliveryPhone: this.deliveryPhone,
            items: this.items,
            subtotal: this.subtotal,
            taxRate: this.taxRate,
            taxAmount: this.taxAmount,
            total: this.total,
            payment: this.payment,
            estimatedPrepTime: this.estimatedPrepTime,
            timeline: this.timeline,
            pickupLocation: this.pickupLocation,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromFirestore(doc) {
        const data = doc.data();
        // Convert Firestore timestamps
        if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
        if (data.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate();
        if (data.timeline) {
            data.timeline = data.timeline.map(t => ({
                ...t,
                timestamp: t.timestamp?.toDate ? t.timestamp.toDate() : t.timestamp
            }));
        }
        return new Order({ id: doc.id, ...data });
    }

    // Get next order number for tenant (resets daily)
    static async getNextOrderNumber(tenantId) {
        const db = getDb();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Simple query - only filter by tenantId
        const snapshot = await db.collection(COLLECTIONS.ORDERS)
            .where('tenantId', '==', tenantId)
            .get();

        // Filter and sort in memory
        const todaysOrders = snapshot.docs
            .map(doc => Order.fromFirestore(doc))
            .filter(order => new Date(order.createdAt) >= today)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (todaysOrders.length === 0) return 101;  // Start at 101 each day
        return todaysOrders[0].orderNumber + 1;
    }

    // Create new order
    static async create(data) {
        const db = getDb();

        // Generate order number
        data.orderNumber = await Order.getNextOrderNumber(data.tenantId);

        // Add initial timeline entry
        data.timeline = [{
            status: ORDER_STATUS.NEW,
            timestamp: new Date(),
            note: 'Order received'
        }];

        const order = new Order(data);
        const docRef = await db.collection(COLLECTIONS.ORDERS).add(order.toFirestore());
        order.id = docRef.id;
        return order;
    }

    // Find order by ID
    static async findById(id) {
        const db = getDb();
        const doc = await db.collection(COLLECTIONS.ORDERS).doc(id).get();
        if (!doc.exists) return null;
        return Order.fromFirestore(doc);
    }

    // Find order by order number for a tenant
    static async findByOrderNumber(tenantId, orderNumber) {
        const db = getDb();
        // Simple query - only filter by tenantId
        const snapshot = await db.collection(COLLECTIONS.ORDERS)
            .where('tenantId', '==', tenantId)
            .get();

        // Filter in memory
        const order = snapshot.docs
            .map(doc => Order.fromFirestore(doc))
            .find(o => o.orderNumber === parseInt(orderNumber));

        return order || null;
    }

    // Get orders by status
    static async findByStatus(tenantId, status) {
        const db = getDb();
        // Simple query - only filter by tenantId
        const snapshot = await db.collection(COLLECTIONS.ORDERS)
            .where('tenantId', '==', tenantId)
            .get();

        // Filter and sort in memory
        return snapshot.docs
            .map(doc => Order.fromFirestore(doc))
            .filter(order => order.status === status)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Get kitchen board data (grouped by status)
    static async getKitchenBoard(tenantId) {
        const db = getDb();
        const activeStatuses = [ORDER_STATUS.NEW, ORDER_STATUS.PREP, ORDER_STATUS.READY];

        // Simple query - only filter by tenantId
        const snapshot = await db.collection(COLLECTIONS.ORDERS)
            .where('tenantId', '==', tenantId)
            .get();

        // Filter and sort in memory
        const orders = snapshot.docs
            .map(doc => Order.fromFirestore(doc))
            .filter(order => activeStatuses.includes(order.status))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Group by status
        const grouped = {
            [ORDER_STATUS.NEW]: [],
            [ORDER_STATUS.PREP]: [],
            [ORDER_STATUS.READY]: []
        };

        orders.forEach(order => {
            if (grouped[order.status]) {
                grouped[order.status].push(order);
            }
        });

        // Calculate average prep time
        const completedToday = await Order.getCompletedToday(tenantId);
        const avgPrepTime = Order.calculateAveragePrepTime(completedToday);

        return {
            counts: {
                new: grouped[ORDER_STATUS.NEW].length,
                prep: grouped[ORDER_STATUS.PREP].length,
                ready: grouped[ORDER_STATUS.READY].length
            },
            avgPrepTime,
            orders: grouped
        };
    }

    // Get completed orders for today
    static async getCompletedToday(tenantId) {
        const db = getDb();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Simple query - only filter by tenantId
        const snapshot = await db.collection(COLLECTIONS.ORDERS)
            .where('tenantId', '==', tenantId)
            .get();

        // Filter in memory
        return snapshot.docs
            .map(doc => Order.fromFirestore(doc))
            .filter(order =>
                order.status === ORDER_STATUS.COMPLETE &&
                new Date(order.createdAt) >= today
            );
    }

    // Calculate average prep time from completed orders
    static calculateAveragePrepTime(orders) {
        if (orders.length === 0) return 0;

        const prepTimes = orders.map(order => {
            const created = new Date(order.createdAt);
            const ready = order.timeline.find(t => t.status === ORDER_STATUS.READY);
            if (!ready) return null;
            return (new Date(ready.timestamp) - created) / 1000 / 60; // minutes
        }).filter(t => t !== null);

        if (prepTimes.length === 0) return 0;
        return Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length);
    }

    // Update order status
    static async updateStatus(id, newStatus, note = '') {
        const db = getDb();
        const order = await Order.findById(id);
        if (!order) return null;

        // Add timeline entry
        const timelineEntry = {
            status: newStatus,
            timestamp: new Date(),
            note: note || Order.getStatusNote(newStatus)
        };

        await db.collection(COLLECTIONS.ORDERS).doc(id).update({
            status: newStatus,
            timeline: [...order.timeline, timelineEntry],
            updatedAt: new Date()
        });

        return Order.findById(id);
    }

    // Get default status note
    static getStatusNote(status) {
        const notes = {
            [ORDER_STATUS.NEW]: 'Order received',
            [ORDER_STATUS.PREP]: 'Kitchen is working hard',
            [ORDER_STATUS.READY]: 'Ready for pickup',
            [ORDER_STATUS.COMPLETE]: 'Order completed'
        };
        return notes[status] || '';
    }

    // Get all orders for tenant with optional filters
    static async findByTenant(tenantId, options = {}) {
        const db = getDb();

        // Simple query - only filter by tenantId
        const snapshot = await db.collection(COLLECTIONS.ORDERS)
            .where('tenantId', '==', tenantId)
            .get();

        // Filter and sort in memory
        let orders = snapshot.docs.map(doc => Order.fromFirestore(doc));

        if (options.status) {
            orders = orders.filter(order => order.status === options.status);
        }

        // Sort by createdAt descending
        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (options.limit) {
            orders = orders.slice(0, options.limit);
        }

        return orders;
    }
}

module.exports = Order;
