/**
 * QORTA Backend - Order Model
 * Orders scoped to each tenant with status tracking
 * Simplified queries to avoid Firestore composite index requirements
 */

const { getDb } = require('../config/firebase'); // COLLECTIONS removed, we use dynamic paths
const { ORDER_STATUS, ORDER_TYPE, PAYMENT_STATUS } = require('../config/constants');

class Order {
    constructor(data) {
        this.id = data.id;
        this.tenantId = data.tenantId;
        this.orderNumber = data.orderNumber;
        this.status = data.status ?? ORDER_STATUS.NEW;
        this.orderType = data.orderType ?? ORDER_TYPE.DINE_IN;
        this.tableNumber = data.tableNumber ?? null;
        this.deliveryPlatform = data.deliveryPlatform ?? null;
        this.customerName = data.customerName ?? '';
        this.notes = data.notes ?? '';
        this.deliveryAddress = data.deliveryAddress ?? null;
        this.deliveryPhone = data.deliveryPhone ?? null;
        this.items = data.items ?? [];
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
        this.source = data.source ?? 'customer'; // 'customer' | 'waiter'
        this.waiterId = data.waiterId ?? null;
        this.waiterName = data.waiterName ?? null;
        this.createdAt = data.createdAt ?? new Date();
        this.updatedAt = data.updatedAt ?? new Date();
    }

    toFirestore() {
        return {
            tenantId: this.tenantId, // Redundant in nested, but good for data export/backup
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
            source: this.source,
            waiterId: this.waiterId,
            waiterName: this.waiterName,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromFirestore(doc) {
        const data = doc.data();
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

    // Helper to get collection ref
    static getCollection(tenantId) {
        if (!tenantId) throw new Error('Tenant ID is required for Order operations');
        return getDb().collection('tenants').doc(tenantId).collection('orders');
    }

    // Get next order number for tenant (resets daily)
    static async getNextOrderNumber(tenantId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Query the specific tenant's orders directly
        const snapshot = await Order.getCollection(tenantId)
            .orderBy('createdAt', 'desc') // Optimization: Query most recent
            .limit(50) // Look at last 50 orders
            .get();

        const todaysOrders = snapshot.docs
            .map(doc => Order.fromFirestore(doc))
            .filter(order => new Date(order.createdAt) >= today);

        if (todaysOrders.length === 0) return 101;
        return todaysOrders[0].orderNumber + 1;
    }

    // Create new order
    static async create(data) {
        if (!data.tenantId) throw new Error('Tenant ID missing for creating order');

        data.orderNumber = await Order.getNextOrderNumber(data.tenantId);

        data.timeline = [{
            status: ORDER_STATUS.NEW,
            timestamp: new Date(),
            note: 'Order received'
        }];

        const order = new Order(data);
        const docRef = await Order.getCollection(data.tenantId).add(order.toFirestore());
        order.id = docRef.id;
        return order;
    }

    // Find order by ID - REQUIRES TENANT ID
    static async findById(tenantId, id) {
        const doc = await Order.getCollection(tenantId).doc(id).get();
        if (!doc.exists) return null;
        return Order.fromFirestore(doc);
    }

    // Find order by order number for a tenant
    static async findByOrderNumber(tenantId, orderNumber) {
        const snapshot = await Order.getCollection(tenantId)
            .where('orderNumber', '==', parseInt(orderNumber))
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        return Order.fromFirestore(snapshot.docs[0]);
    }

    // Get orders by status
    static async findByStatus(tenantId, status) {
        const snapshot = await Order.getCollection(tenantId)
            .where('status', '==', status)
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map(doc => Order.fromFirestore(doc));
    }

    // Get kitchen board data (grouped by status)
    static async getKitchenBoard(tenantId) {
        const activeStatuses = [ORDER_STATUS.NEW, ORDER_STATUS.PREP, ORDER_STATUS.READY];

        // Query active orders from subcollection
        const snapshot = await Order.getCollection(tenantId)
            .where('status', 'in', activeStatuses)
            .get(); // We sort in memory since 'in' query limitations might apply or just sort client side

        const orders = snapshot.docs
            .map(doc => Order.fromFirestore(doc))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // Oldest first for kitchen

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
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const snapshot = await Order.getCollection(tenantId)
            .where('status', '==', ORDER_STATUS.COMPLETE)
            .where('createdAt', '>=', today)
            .get();

        return snapshot.docs.map(doc => Order.fromFirestore(doc));
    }

    static calculateAveragePrepTime(orders) {
        if (orders.length === 0) return 0;
        const prepTimes = orders.map(order => {
            const created = new Date(order.createdAt);
            const ready = order.timeline.find(t => t.status === ORDER_STATUS.READY);
            if (!ready) return null;
            return (new Date(ready.timestamp) - created) / 1000 / 60;
        }).filter(t => t !== null);

        if (prepTimes.length === 0) return 0;
        return Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length);
    }

    // Update order status - REQUIRES TENANT ID
    static async updateStatus(tenantId, id, newStatus, note = '') {
        const order = await Order.findById(tenantId, id);
        if (!order) return null;

        const timelineEntry = {
            status: newStatus,
            timestamp: new Date(),
            note: note || Order.getStatusNote(newStatus)
        };

        await Order.getCollection(tenantId).doc(id).update({
            status: newStatus,
            timeline: [...order.timeline, timelineEntry],
            updatedAt: new Date()
        });

        return Order.findById(tenantId, id);
    }

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
        let query = Order.getCollection(tenantId);

        if (options.status) {
            query = query.where('status', '==', options.status);
        }

        query = query.orderBy('createdAt', 'desc');

        if (options.limit) {
            query = query.limit(options.limit);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => Order.fromFirestore(doc));
    }
}

module.exports = Order;
