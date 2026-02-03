/**
 * QORTA Backend - Authentication Middleware
 * Verifies Firebase ID tokens for protected routes
 */

const admin = require('firebase-admin');

/**
 * Auth middleware - Verifies Firebase ID token
 * Attach user info to req.user
 */
const auth = async (req, res, next) => {
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

        // Fetch Admin Profile (Tenant Mapping)
        // We do this lazily or here. Doing it here ensures security early.
        const db = admin.firestore();
        const adminDoc = await db.collection('admins').doc(decodedToken.uid).get();

        if (adminDoc.exists) {
            req.user.tenantId = adminDoc.data().tenantId;
            req.user.role = adminDoc.data().role;
        }

        // STRICT TENANT ISOLATION CHECK
        // If the route has already resolved a tenant (via tenantResolver),
        // we MUST check if this admin belongs to it.
        if (req.tenant && req.user.tenantId) {
            if (req.tenant.id !== req.user.tenantId) {
                console.warn(`Security Alert: Admin ${req.user.email} (Tenant: ${req.user.tenantId}) tried to access Tenant ${req.tenant.id}`);
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'You do not have access to this restaurant instance.'
                });
            }
        }

        // If user has no tenantId but is trying to access a tenant route
        if (req.tenant && !req.user.tenantId) {
            // Optional: Allow "Super Admins" here if you had them, but for now Strict.
            // OR: If it's a new signup flow? But we assume pre-seeded admins.
            return res.status(403).json({
                error: 'Forbidden',
                message: 'No restaurant associated with this account.'
            });
        }

        next();
    } catch (error) {
        console.error('Auth error:', error.message);

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
 * Optional auth middleware - Checks for auth but doesn't require it
 * Useful for routes that work differently for authenticated users
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(token);

            req.user = {
                uid: decodedToken.uid,
                email: decodedToken.email,
                emailVerified: decodedToken.email_verified
            };
        }

        next();
    } catch (error) {
        // Token invalid, but that's okay for optional auth
        next();
    }
};

module.exports = { auth, optionalAuth };
