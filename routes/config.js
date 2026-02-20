/**
 * QORTA Backend - Config Routes
 * Public endpoint for frontend to get restaurant configuration
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const tenantResolver = require('../middleware/tenantResolver');

// Apply tenant resolver to all routes
router.use(tenantResolver);

// Get restaurant configuration (public endpoint)
router.get('/', (req, res) => {
    try {
        const config = {
            mode: req.tenant.settings.serviceMode?.enabled ? 'service' : 'ordering',
            name: req.tenant.name,
            taxRate: req.tenant.settings.taxRate,
            serviceMode: req.tenant.settings.serviceMode || { enabled: false, tableCount: 10 }
        };

        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to load configuration'
        });
    }
});

module.exports = router;
