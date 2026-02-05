/**
 * QORTA Backend - Tenant Routes
 * Routes for tenant management (platform admin)
 */

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const {
    createTenant,
    getAllTenants,
    getTenantBySlug
} = require('../controllers/tenantController');

// Get all tenants (requires auth — controller scopes result to req.user.tenantId)
router.get('/', auth, getAllTenants);

// Get tenant by slug
router.get('/:slug', getTenantBySlug);

// Create new tenant (requires auth — any authenticated Firebase user may create)
router.post('/', auth, validateRequest(['slug', 'name']), createTenant);

module.exports = router;
