/**
 * QORTA Backend - MenuItem Model
 * Menu items scoped to each tenant
 */

const { getDb, COLLECTIONS } = require('../config/firebase');

class MenuItem {
    constructor(data) {
        this.id = data.id;
        this.tenantId = data.tenantId;
        this.name = data.name;                         // "Classic Burger"
        this.description = data.description ?? '';     // "Two smashed patties, truffle..."
        this.price = data.price;                       // 24.00
        this.category = data.category;                 // "burgers"
        this.imageUrl = data.imageUrl ?? '';
        this.modifiers = data.modifiers ?? [];         // [{ name: "Extra Cheese", price: 1.50 }]
        this.isFeatured = data.isFeatured ?? false;
        this.isBestseller = data.isBestseller ?? false;
        this.allergens = data.allergens ?? [];         // ["PEANUTS", "NUT"]
        this.available = data.available ?? true;
        this.createdAt = data.createdAt ?? new Date();
        this.updatedAt = data.updatedAt ?? new Date();
    }

    toFirestore() {
        return {
            tenantId: this.tenantId,
            name: this.name,
            description: this.description,
            price: this.price,
            category: this.category,
            imageUrl: this.imageUrl,
            modifiers: this.modifiers,
            isFeatured: this.isFeatured,
            isBestseller: this.isBestseller,
            allergens: this.allergens,
            available: this.available,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromFirestore(doc) {
        const data = doc.data();
        return new MenuItem({ id: doc.id, ...data });
    }

    // Get all menu items for a tenant
    static async findByTenant(tenantId, options = {}) {
        const db = getDb();
        // Simple query with only tenantId to avoid composite index requirement
        const snapshot = await db.collection(COLLECTIONS.MENU_ITEMS)
            .where('tenantId', '==', tenantId)
            .get();

        // Filter in memory
        let items = snapshot.docs
            .map(doc => MenuItem.fromFirestore(doc));

        if (!options.includeUnavailable) {
            items = items.filter(item => item.available);
        }

        if (options.category) {
            items = items.filter(item => item.category === options.category);
        }

        return items;
    }

    // Get featured items for a tenant
    static async findFeatured(tenantId) {
        const db = getDb();
        // Simple query with only tenantId to avoid composite index requirement
        const snapshot = await db.collection(COLLECTIONS.MENU_ITEMS)
            .where('tenantId', '==', tenantId)
            .get();

        // Filter in memory
        return snapshot.docs
            .map(doc => MenuItem.fromFirestore(doc))
            .filter(item => item.available && item.isFeatured);
    }

    // Get single menu item
    static async findById(id) {
        const db = getDb();
        const doc = await db.collection(COLLECTIONS.MENU_ITEMS).doc(id).get();
        if (!doc.exists) return null;
        return MenuItem.fromFirestore(doc);
    }

    // Create new menu item
    static async create(data) {
        const db = getDb();
        const menuItem = new MenuItem(data);
        const docRef = await db.collection(COLLECTIONS.MENU_ITEMS).add(menuItem.toFirestore());
        menuItem.id = docRef.id;
        return menuItem;
    }

    // Update menu item
    static async update(id, data) {
        const db = getDb();
        data.updatedAt = new Date();
        await db.collection(COLLECTIONS.MENU_ITEMS).doc(id).update(data);
        const doc = await db.collection(COLLECTIONS.MENU_ITEMS).doc(id).get();
        return MenuItem.fromFirestore(doc);
    }

    // Delete menu item (soft delete)
    static async delete(id) {
        const db = getDb();
        await db.collection(COLLECTIONS.MENU_ITEMS).doc(id).update({ available: false });
    }
}

module.exports = MenuItem;
