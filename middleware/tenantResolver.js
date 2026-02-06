/**
 * QORTA Backend - Tenant Resolver Middleware
 * Resolves tenant slug from URL and attaches tenant to request
 */

const Tenant = require('../models/Tenant');
const { logger } = require('../utils/logger');

const tenantResolver = async (req, res, next) => {
    try {
        const { slug } = req.params;

        if (!slug) {
            return res.status(400).json({
                success: false,
                error: 'Tenant slug is required'
            });
        }

        const tenant = await Tenant.findBySlug(slug);

        if (!tenant) {
            return res.status(404).json({
                success: false,
                error: 'Restaurant not found'
            });
        }

        if (!tenant.isActive) {
            return res.status(403).json({
                success: false,
                error: 'This restaurant is currently unavailable'
            });
        }

        // Attach tenant to request for use in controllers
        req.tenant = tenant;
        next();
    } catch (error) {
        logger.error('Tenant resolution failed', {
            requestId: req.requestId,
            tenantId: req.params.slug,
            meta: { error: error.message }
        });
        res.status(500).json({
            success: false,
            error: 'Failed to resolve restaurant'
        });
    }
};

module.exports = tenantResolver;
