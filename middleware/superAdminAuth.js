/**
 * QORTA Backend - Super Admin Authentication Middleware
 * Verifies Firebase ID tokens and checks for SUPER_ADMIN role
 */

const { admin, initializeFirebase } = require('../config/firebase');
const { logger } = require('../utils/logger');

/**
 * Super Admin auth middleware
 * Rejects if:
 * - User not authenticated
 * - role !== SUPER_ADMIN (checked via custom claims)
 */
const superAdminAuth = async (req, res, next) => {
    try {
        // Ensure Firebase is initialized
        initializeFirebase();

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

        // Check for SUPER_ADMIN role in custom claims
        if (decodedToken.role !== 'SUPER_ADMIN') {
            logger.security('Non-super-admin access attempt to platform route', {
                requestId: req.requestId,
                userId: decodedToken.uid,
                meta: {
                    email: decodedToken.email,
                    role: decodedToken.role || 'none'
                }
            });
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Super admin access required'
            });
        }

        // Attach user info
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            role: 'SUPER_ADMIN'
        };

        next();
    } catch (error) {
        logger.warn('Super admin authentication failed', {
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

module.exports = { superAdminAuth };
