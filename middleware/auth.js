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

        // Attach user info to request
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            emailVerified: decodedToken.email_verified
        };

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
