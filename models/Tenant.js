/**
 * QORTA Backend - Tenant Model
 * Represents a restaurant/business using the platform
 */

const { getDb, COLLECTIONS } = require('../config/firebase');

class Tenant {
    constructor(data) {
        this.id = data.id;
        this.slug = data.slug;                    // Unique URL identifier
        this.name = data.name;                    // Display name
        this.settings = {
            taxRate: data.settings?.taxRate ?? 0.08,
            currency: data.settings?.currency ?? 'USD',
            timezone: data.settings?.timezone ?? 'UTC'
        };
        this.isActive = data.isActive ?? true;
        this.createdAt = data.createdAt ?? new Date();
        this.updatedAt = data.updatedAt ?? new Date();
    }

    toFirestore() {
        return {
            slug: this.slug,
            name: this.name,
            settings: this.settings,
            isActive: this.isActive,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromFirestore(doc) {
        const data = doc.data();
        return new Tenant({ id: doc.id, ...data });
    }

    // Find tenant by slug
    static async findBySlug(slug) {
        const db = getDb();
        const snapshot = await db.collection(COLLECTIONS.TENANTS)
            .where('slug', '==', slug)
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        return Tenant.fromFirestore(snapshot.docs[0]);
    }

    // Create new tenant
    static async create(data) {
        const db = getDb();
        const tenant = new Tenant(data);
        const docRef = await db.collection(COLLECTIONS.TENANTS).add(tenant.toFirestore());
        tenant.id = docRef.id;
        return tenant;
    }

    // Get all tenants
    static async findAll() {
        const db = getDb();
        const snapshot = await db.collection(COLLECTIONS.TENANTS)
            .where('isActive', '==', true)
            .get();

        return snapshot.docs.map(doc => Tenant.fromFirestore(doc));
    }
}

module.exports = Tenant;
