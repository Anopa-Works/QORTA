/**
 * QORTA Backend - Event Model
 * Events for seated/plated event ordering (separate from restaurant flow)
 *
 * Each event belongs to a tenant. Guests scan a QR code, enter a seat reference,
 * and place orders that flow into the tenant's kitchen board with an EVENT badge.
 */

const { getDb, COLLECTIONS } = require('../config/firebase');

const EVENT_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive'
};

class Event {
    constructor(data) {
        this.id = data.id;
        this.tenantId = data.tenantId;
        this.name = data.name;
        this.date = data.date ?? null;
        this.status = data.status ?? EVENT_STATUS.ACTIVE;
        this.slug = data.slug;
        this.qrUrl = data.qrUrl ?? null;
        this.createdAt = data.createdAt ?? new Date();
        this.updatedAt = data.updatedAt ?? new Date();
    }

    toFirestore() {
        return {
            tenantId: this.tenantId,
            name: this.name,
            date: this.date,
            status: this.status,
            slug: this.slug,
            qrUrl: this.qrUrl,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromFirestore(doc) {
        const data = doc.data();
        if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
        if (data.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate();
        return new Event({ id: doc.id, ...data });
    }

    static getCollection() {
        return getDb().collection(COLLECTIONS.EVENTS);
    }

    // Generate a URL-safe slug from name + a short random suffix to ensure uniqueness
    static buildSlug(name) {
        const base = String(name)
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40) || 'event';

        const suffix = Math.random().toString(36).slice(2, 8);
        return `${base}-${suffix}`;
    }

    static async create(data) {
        if (!data.tenantId) throw new Error('tenantId is required');
        if (!data.name || !data.name.trim()) throw new Error('name is required');

        // Generate a unique slug. The 6-char base36 suffix makes collisions
        // ~negligible, but check anyway and retry a few times to be safe.
        let slug = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            const candidate = Event.buildSlug(data.name);
            const existing = await Event.findBySlug(candidate);
            if (!existing) {
                slug = candidate;
                break;
            }
        }
        if (!slug) {
            throw new Error('Failed to generate unique event slug');
        }

        const event = new Event({
            tenantId: data.tenantId,
            name: data.name.trim(),
            date: data.date || null,
            status: EVENT_STATUS.ACTIVE,
            slug,
            qrUrl: null
        });

        const docRef = await Event.getCollection().add(event.toFirestore());
        event.id = docRef.id;
        return event;
    }

    static async findById(id) {
        const doc = await Event.getCollection().doc(id).get();
        if (!doc.exists) return null;
        return Event.fromFirestore(doc);
    }

    static async findBySlug(slug) {
        const snapshot = await Event.getCollection()
            .where('slug', '==', slug)
            .limit(1)
            .get();
        if (snapshot.empty) return null;
        return Event.fromFirestore(snapshot.docs[0]);
    }

    static async listAll() {
        const snapshot = await Event.getCollection().get();
        const events = snapshot.docs.map(doc => Event.fromFirestore(doc));
        events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return events;
    }

    static async update(id, patch) {
        patch.updatedAt = new Date();
        await Event.getCollection().doc(id).update(patch);
    }

    static async setStatus(id, status) {
        if (status !== EVENT_STATUS.ACTIVE && status !== EVENT_STATUS.INACTIVE) {
            throw new Error('Invalid status');
        }
        await Event.update(id, { status });
    }

    static async setQrUrl(id, qrUrl) {
        await Event.update(id, { qrUrl });
    }

    /**
     * Stable JSON shape for both admin list/detail and create responses.
     * Centralized so route handlers don't drift from each other.
     */
    toAdminJSON(extra = {}) {
        return {
            id: this.id,
            name: this.name,
            date: this.date,
            status: this.status,
            slug: this.slug,
            qrUrl: this.qrUrl,
            tenantId: this.tenantId,
            createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : this.createdAt,
            ...extra
        };
    }
}

module.exports = Event;
module.exports.EVENT_STATUS = EVENT_STATUS;
