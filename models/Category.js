/**
 * QORTA Backend - Category Model
 * Menu categories scoped to each tenant
 */

const { getDb, COLLECTIONS } = require('../config/firebase');

class Category {
    constructor(data) {
        this.id = data.id;
        this.tenantId = data.tenantId;
        this.name = data.name;                    // "Burgers", "Sides", "Drinks"
        this.slug = data.slug || this.generateSlug(data.name);  // Auto-generate if not provided
        this.order = data.order ?? 0;             // Display order
        this.isActive = data.isActive ?? true;
        this.createdAt = data.createdAt ?? new Date();
    }

    generateSlug(name) {
        if (!name) return '';
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    toFirestore() {
        return {
            tenantId: this.tenantId,
            name: this.name,
            slug: this.slug,
            order: this.order,
            isActive: this.isActive,
            createdAt: this.createdAt
        };
    }

    static fromFirestore(doc) {
        const data = doc.data();
        return new Category({ id: doc.id, ...data });
    }

    // Get categories for a tenant
    static async findByTenant(tenantId) {
        const db = getDb();
        const snapshot = await db.collection(COLLECTIONS.CATEGORIES)
            .where('tenantId', '==', tenantId)
            .where('isActive', '==', true)
            .get();

        // Sort in memory to avoid index requirement
        const categories = snapshot.docs.map(doc => Category.fromFirestore(doc));
        return categories.sort((a, b) => a.order - b.order);
    }

    // Create new category
    static async create(data) {
        const db = getDb();
        const category = new Category(data);
        const docRef = await db.collection(COLLECTIONS.CATEGORIES).add(category.toFirestore());
        category.id = docRef.id;
        return category;
    }

    // Update category
    static async update(id, data) {
        const db = getDb();
        await db.collection(COLLECTIONS.CATEGORIES).doc(id).update(data);
        const doc = await db.collection(COLLECTIONS.CATEGORIES).doc(id).get();
        return Category.fromFirestore(doc);
    }

    // Delete category (soft delete)
    static async delete(id) {
        const db = getDb();
        await db.collection(COLLECTIONS.CATEGORIES).doc(id).update({ isActive: false });
    }
}

module.exports = Category;
