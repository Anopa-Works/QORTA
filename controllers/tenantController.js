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

// Get all tenants
const getAllTenants = async (req, res, next) => {
    try {
        const tenants = await Tenant.findAll();

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
