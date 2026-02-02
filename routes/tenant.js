/**
 * QORTA Backend - Tenant Routes
 * Routes for tenant management (platform admin)
 */

const express = require('express');
const router = express.Router();
const { validateRequest } = require('../middleware/validateRequest');
const {
    createTenant,
    getAllTenants,
    getTenantBySlug
} = require('../controllers/tenantController');

// Get all tenants
router.get('/', getAllTenants);

// Get tenant by slug
router.get('/:slug', getTenantBySlug);

// Create new tenant
router.post('/', validateRequest(['slug', 'name']), createTenant);

module.exports = router;
