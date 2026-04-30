/**
 * QORTA Backend - Platform/Super-Admin Routes
 * Super-admin endpoints for platform-level tenant management
 */

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const logger = require('../utils/logger');

/**
 * Super-admin authentication middleware
 * Verifies user has super-admin privileges (not tenant-scoped)
 */
const requireSuperAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'No auth token provided'
            });
        }

        const token = authHeader.split('Bearer ')[1];

        // Verify the token with Firebase
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Attach basic user info
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            emailVerified: decodedToken.email_verified
        };

        // Fetch Admin Profile
        const db = admin.firestore();
        const adminDoc = await db.collection('admins').doc(decodedToken.uid).get();

        if (!adminDoc.exists) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Not an admin account'
            });
        }

        const adminData = adminDoc.data();
        req.user.tenantId = adminData.tenantId;
        req.user.role = adminData.role;

        // Super-admin check: tenantId must be null AND role must be 'super-admin'
        if (adminData.tenantId !== null || adminData.role !== 'super-admin') {
            logger.security('Non-super-admin access attempt to platform endpoint', {
                requestId: req.requestId,
                userId: req.user.uid,
                meta: {
                    userEmail: req.user.email,
                    userRole: adminData.role,
                    userTenantId: adminData.tenantId
                }
            });

            return res.status(403).json({
                error: 'Forbidden',
                message: 'Super-admin access required'
            });
        }

        next();
    } catch (error) {
        logger.warn('Super-admin authentication failed', {
            requestId: req.requestId,
            meta: { code: error.code, message: error.message }
        });

        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({
                error: 'Token expired',
                message: 'Please login again'
            });
        }

        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid auth token'
        });
    }
};

/**
 * GET /platform/tenants
 * List all tenants (super-admin only)
 */
router.get('/tenants', requireSuperAdmin, async (req, res) => {
    try {
        const db = admin.firestore();
        const tenantsSnapshot = await db.collection('tenants')
            .orderBy('name', 'asc')
            .get();

        const tenants = tenantsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                slug: data.slug,
                name: data.name,
                isActive: data.isActive,
                serviceMode: {
                    enabled: data.settings?.serviceMode?.enabled || false,
                    tableCount: data.settings?.serviceMode?.tableCount || 10
                },
                createdAt: data.createdAt
            };
        });

        res.json({
            success: true,
            tenants
        });
    } catch (error) {
        logger.error('Error fetching tenants', {
            requestId: req.requestId,
            meta: { message: error.message }
        });

        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch tenants'
        });
    }
});

/**
 * PATCH /platform/tenants/:tenantId/service-mode
 * Toggle service mode for a tenant (super-admin only)
 */
router.patch('/tenants/:tenantId/service-mode', requireSuperAdmin, async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { enabled, tableCount } = req.body;

        // Validation
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                error: 'Validation error',
                message: 'enabled must be a boolean'
            });
        }

        if (tableCount !== undefined && (typeof tableCount !== 'number' || tableCount < 1 || tableCount > 100)) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'tableCount must be a number between 1 and 100'
            });
        }

        // Fetch tenant
        const db = admin.firestore();
        const tenantRef = db.collection('tenants').doc(tenantId);
        const tenantDoc = await tenantRef.get();

        if (!tenantDoc.exists) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Tenant not found'
            });
        }

        // Update service mode settings
        const updateData = {
            'settings.serviceMode.enabled': enabled,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (tableCount !== undefined) {
            updateData['settings.serviceMode.tableCount'] = tableCount;
        }

        await tenantRef.update(updateData);

        logger.info('Service mode updated by super-admin', {
            requestId: req.requestId,
            userId: req.user.uid,
            meta: {
                tenantId,
                enabled,
                tableCount,
                superAdminEmail: req.user.email
            }
        });

        res.json({
            success: true,
            message: 'Service mode updated',
            serviceMode: {
                enabled,
                tableCount: tableCount || tenantDoc.data().settings?.serviceMode?.tableCount || 10
            }
        });
    } catch (error) {
        logger.error('Error updating service mode', {
            requestId: req.requestId,
            userId: req.user.uid,
            meta: { message: error.message }
        });

        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to update service mode'
        });
    }
});

module.exports = router;
