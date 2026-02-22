/**
 * QORTA Backend - Config Routes
 * Public endpoint for frontend to get restaurant configuration
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const tenantResolver = require('../middleware/tenantResolver');
const { optionalAuth, auth } = require('../middleware/auth');

// Apply tenant resolver to all routes
router.use(tenantResolver);

// Get restaurant configuration (public endpoint with optional auth)
router.get('/', optionalAuth, (req, res) => {
    try {
        const config = {
            mode: req.tenant.settings.serviceMode?.enabled ? 'service' : 'ordering',
            name: req.tenant.name,
            taxRate: req.tenant.settings.taxRate,
            serviceMode: req.tenant.settings.serviceMode || { enabled: false, tableCount: 10 }
        };

        // If authenticated, include assigned tables for waiter
        if (req.user && req.user.assignedTables !== undefined) {
            config.assignedTables = req.user.assignedTables;
        }

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

// Toggle service mode - restaurant admin only
router.patch('/service-mode', auth, async (req, res) => {
    try {
        const { enabled, tableCount } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
        }

        const { getDb } = require('../config/firebase');
        const { logger } = require('../utils/logger');
        const db = getDb();

        const finalTableCount = (tableCount && typeof tableCount === 'number')
            ? tableCount
            : (req.tenant.settings.serviceMode?.tableCount || 10);

        // Read the current tenant doc and write back the full settings object.
        // Using dotted-path update risks leaving a partial settings map when the
        // field doesn't yet exist (tenant created without settings). Writing the
        // full object is safe and explicit.
        const tenantRef = db.collection('tenants').doc(req.tenant.id);
        const tenantDoc = await tenantRef.get();

        if (!tenantDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        }

        const current = tenantDoc.data().settings || {};
        await tenantRef.update({
            settings: {
                taxRate:   current.taxRate   ?? 0.08,
                currency:  current.currency  ?? 'USD',
                timezone:  current.timezone  ?? 'UTC',
                serviceMode: { enabled, tableCount: finalTableCount }
            },
            updatedAt: new Date()
        });

        logger.info('Service mode toggled', {
            tenantId: req.tenant.id,
            meta: { enabled, tableCount: finalTableCount, updatedBy: req.user.email }
        });

        res.json({
            success: true,
            data: { enabled, tableCount: finalTableCount }
        });
    } catch (error) {
        const { logger } = require('../utils/logger');
        logger.error('Failed to toggle service mode', {
            tenantId: req.tenant?.id,
            meta: { error: error.message }
        });
        res.status(500).json({ success: false, error: 'Failed to update service mode' });
    }
});

module.exports = router;
