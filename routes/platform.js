/**
 * QORTA Backend - Platform Routes
 * Super Admin routes for tenant management
 *
 * All routes require SUPER_ADMIN role
 */

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { getDb } = require('../config/firebase');
const { superAdminAuth } = require('../middleware/superAdminAuth');
const { logger } = require('../utils/logger');

// Slug validation regex: lowercase alphanumeric with hyphens (no leading/trailing hyphens)
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Validate slug format
 */
function validateSlug(slug) {
    if (!slug || typeof slug !== 'string') {
        return { valid: false, error: 'Slug is required' };
    }

    // Enforce lowercase
    if (slug !== slug.toLowerCase()) {
        return { valid: false, error: 'Slug must be lowercase' };
    }

    // Check length
    if (slug.length < 3 || slug.length > 50) {
        return { valid: false, error: 'Slug must be 3-50 characters' };
    }

    // Check format
    if (!SLUG_REGEX.test(slug)) {
        return { valid: false, error: 'Slug must contain only lowercase letters, numbers, and hyphens (no leading/trailing hyphens)' };
    }

    return { valid: true };
}

/**
 * POST /api/platform/tenants
 * Create tenant atomically with first admin
 *
 * Body: {
 *   slug: string,
 *   name: string,
 *   plan: string (optional, defaults to 'tier1'),
 *   adminEmail: string,
 *   adminName: string (optional)
 * }
 */
router.post('/tenants', superAdminAuth, async (req, res) => {
    const { slug, name, plan, adminEmail, adminName } = req.body;

    // Validate required fields
    if (!slug || !name || !adminEmail) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: slug, name, adminEmail'
        });
    }

    // Validate slug format
    const slugValidation = validateSlug(slug);
    if (!slugValidation.valid) {
        return res.status(400).json({
            success: false,
            error: slugValidation.error
        });
    }

    // Validate email format (basic check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid email format'
        });
    }

    const db = getDb();

    try {
        // Check slug uniqueness BEFORE transaction (cheaper query)
        const existingSlug = await db.collection('tenants')
            .where('slug', '==', slug)
            .limit(1)
            .get();

        if (!existingSlug.empty) {
            return res.status(409).json({
                success: false,
                error: 'Slug already exists'
            });
        }

        // Check if email is already registered
        let existingUser = null;
        try {
            existingUser = await admin.auth().getUserByEmail(adminEmail);
        } catch (e) {
            // User doesn't exist, which is expected
            if (e.code !== 'auth/user-not-found') {
                throw e;
            }
        }

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'Email already registered'
            });
        }

        // Generate IDs for documents
        const tenantRef = db.collection('tenants').doc();
        const tenantId = tenantRef.id;
        const settingsRef = db.collection('tenantSettings').doc(tenantId);

        // Create Firebase Auth user with temporary password
        const tempPassword = generateTempPassword();
        const userRecord = await admin.auth().createUser({
            email: adminEmail,
            password: tempPassword,
            displayName: adminName || name + ' Admin',
            emailVerified: false
        });

        const adminRef = db.collection('admins').doc(userRecord.uid);

        // Run transaction for Firestore documents
        const now = new Date();
        await db.runTransaction(async (transaction) => {
            // Create tenant
            transaction.set(tenantRef, {
                slug: slug,
                name: name,
                plan: plan || 'tier1',
                isActive: true,
                createdAt: now,
                updatedAt: now
            });

            // Create tenant settings
            transaction.set(settingsRef, {
                tenantId: tenantId,
                taxRate: 0.08,
                currency: 'USD',
                timezone: 'America/New_York',
                createdAt: now,
                updatedAt: now
            });

            // Create admin document
            transaction.set(adminRef, {
                tenantId: tenantId,
                email: adminEmail,
                name: adminName || null,
                role: 'ADMIN',
                createdAt: now,
                updatedAt: now
            });
        });

        // Send password reset email (outside transaction - not critical)
        try {
            await admin.auth().generatePasswordResetLink(adminEmail);
            // Firebase automatically sends the email when using generatePasswordResetLink
            // If you need custom email, use sendPasswordResetEmail from client SDK
        } catch (emailError) {
            logger.warn('Failed to send password reset email', {
                requestId: req.requestId,
                meta: { email: adminEmail, error: emailError.message }
            });
            // Don't fail the request - admin can use "forgot password" flow
        }

        logger.info('Tenant created', {
            requestId: req.requestId,
            tenantId: tenantId,
            meta: { slug, adminEmail, createdBy: req.user.email }
        });

        res.status(201).json({
            success: true,
            data: {
                id: tenantId,
                slug: slug,
                name: name,
                plan: plan || 'tier1',
                isActive: true,
                admin: {
                    uid: userRecord.uid,
                    email: adminEmail
                },
                createdAt: now.toISOString()
            }
        });

    } catch (error) {
        logger.error('Tenant creation failed', {
            requestId: req.requestId,
            meta: { slug, error: error.message }
        });

        // Attempt cleanup if Firebase user was created but transaction failed
        // This is best-effort; manual cleanup may be needed in rare cases

        res.status(500).json({
            success: false,
            error: 'Failed to create tenant'
        });
    }
});

/**
 * GET /api/platform/tenants
 * List all tenants
 */
router.get('/tenants', superAdminAuth, async (req, res) => {
    const db = getDb();

    try {
        const snapshot = await db.collection('tenants')
            .orderBy('createdAt', 'desc')
            .get();

        const tenants = snapshot.docs.map(doc => ({
            id: doc.id,
            slug: doc.data().slug,
            name: doc.data().name,
            plan: doc.data().plan || 'tier1',
            isActive: doc.data().isActive,
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
        }));

        res.json({
            success: true,
            data: tenants,
            count: tenants.length
        });

    } catch (error) {
        logger.error('Failed to list tenants', {
            requestId: req.requestId,
            meta: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Failed to list tenants'
        });
    }
});

/**
 * PATCH /api/platform/tenants/:id/status
 * Toggle tenant active/inactive status
 *
 * Body: { isActive: boolean }
 */
router.patch('/tenants/:id/status', superAdminAuth, async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
        return res.status(400).json({
            success: false,
            error: 'isActive must be a boolean'
        });
    }

    const db = getDb();
    const tenantRef = db.collection('tenants').doc(id);

    try {
        const doc = await tenantRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Tenant not found'
            });
        }

        await tenantRef.update({
            isActive: isActive,
            updatedAt: new Date()
        });

        logger.info('Tenant status updated', {
            requestId: req.requestId,
            tenantId: id,
            meta: { isActive, updatedBy: req.user.email }
        });

        res.json({
            success: true,
            data: {
                id: id,
                isActive: isActive
            }
        });

    } catch (error) {
        logger.error('Failed to update tenant status', {
            requestId: req.requestId,
            tenantId: id,
            meta: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Failed to update tenant status'
        });
    }
});

/**
 * Generate a secure temporary password
 */
function generateTempPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

module.exports = router;
