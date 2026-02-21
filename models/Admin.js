/**
 * QORTA Backend - Admin Model
 * Handles admin user mapping to tenants
 */

const { getDb } = require('../config/firebase');

class Admin {
    constructor(data) {
        this.uid = data.uid;          // Firebase Auth UID
        this.email = data.email;
        this.tenantId = data.tenantId; // The single tenant this admin manages
        this.role = data.role ?? 'owner'; // owner, manager, staff
        this.assignedTables = data.assignedTables ?? null; // null = all tables, [] = none, [1,2,3] = specific
        this.createdAt = data.createdAt ?? new Date();
        this.updatedAt = data.updatedAt ?? new Date();
    }

    toFirestore() {
        return {
            email: this.email,
            tenantId: this.tenantId,
            role: this.role,
            assignedTables: this.assignedTables,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromFirestore(doc) {
        const data = doc.data();
        if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
        if (data.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate();
        return new Admin({ uid: doc.id, ...data });
    }

    // Find admin by UID
    static async findByUid(uid) {
        const db = getDb();
        const doc = await db.collection('admins').doc(uid).get();
        if (!doc.exists) return null;
        return Admin.fromFirestore(doc);
    }

    // Create or update admin mapping
    // This serves as the "invite" or "assignment" mechanism
    static async assignTenant(uid, email, tenantId, role = 'owner') {
        const db = getDb();
        const adminData = {
            email,
            tenantId,
            role,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.collection('admins').doc(uid).set(adminData, { merge: true });
        return new Admin({ uid, ...adminData });
    }

    // Validate table assignment
    static validateTableAssignment(tables, maxTableCount) {
        if (tables === null || tables === undefined) return true;  // null/undefined = all tables
        if (!Array.isArray(tables)) return false;
        if (tables.length === 0) return true;  // empty = no access
        return tables.every(t => Number.isInteger(t) && t >= 1 && t <= maxTableCount);
    }
}

module.exports = Admin;
