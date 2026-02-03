/**
 * QORTA Backend - Tenant Controller
 * Handles tenant CRUD operations
 */

const Tenant = require('../models/Tenant');

// Create a new tenant
const createTenant = async (req, res, next) => {
    try {
        const { slug, name, settings } = req.body;

        // Check if slug already exists
        const existing = await Tenant.findBySlug(slug);
        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'A restaurant with this slug already exists'
            });
        }

        const tenant = await Tenant.create({ slug, name, settings });

        res.status(201).json({
            success: true,
            data: tenant
        });
    } catch (error) {
        next(error);
    }
};

// Get all tenants (Scoped to Admin)
const getAllTenants = async (req, res, next) => {
    try {
        // If user is not authenticated or has no tenantId, return empty
        if (!req.user || !req.user.tenantId) {
            return res.json({ success: true, data: [] });
        }

        // Ideally, we fetch only the tenant this admin belongs to
        // Since we are moving to single-tenant admin, this list will only ever have 1 item
        const Tenant = require('../models/Tenant'); // Ensure import
        const { getDb, COLLECTIONS } = require('../config/firebase'); // Need direct access if model doesn't support getById

        // Since Tenant model doesn't have findById exposed easily as static, let's use the DB or helper
        const db = getDb();
        const doc = await db.collection(COLLECTIONS.TENANTS).doc(req.user.tenantId).get();

        let tenants = [];
        if (doc.exists && doc.data().isActive) {
            tenants.push(Tenant.fromFirestore(doc));
        }

        res.json({
            success: true,
            data: tenants
        });
    } catch (error) {
        next(error);
    }
};

// Get tenant by slug
const getTenantBySlug = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const tenant = await Tenant.findBySlug(slug);

        if (!tenant) {
            return res.status(404).json({
                success: false,
                error: 'Restaurant not found'
            });
        }

        res.json({
            success: true,
            data: tenant
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createTenant,
    getAllTenants,
    getTenantBySlug
};
