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
        const db = getDb();
        const settingsRef = db.collection('tenantSettings').doc(req.tenant.id);

        const doc = await settingsRef.get();
        const currentTableCount = doc.exists ? doc.data().serviceMode?.tableCount : 10;

        await settingsRef.set({
            serviceMode: {
                enabled,
                tableCount: (tableCount && typeof tableCount === 'number') ? tableCount : (currentTableCount || 10)
            }
        }, { merge: true });

        const { logger } = require('../utils/logger');
        logger.info('Service mode toggled', {
            tenantId: req.tenant.id,
            meta: { enabled, tableCount, updatedBy: req.user.email }
        });

        res.json({
            success: true,
            data: { enabled, tableCount: tableCount || currentTableCount || 10 }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update service mode' });
    }
});

module.exports = router;
