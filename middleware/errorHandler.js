/**
 * QORTA Backend - Error Handler Middleware
 * Centralized error handling with consistent response format
 *
 * SECURITY RULES:
 * - Never expose stack traces to client
 * - Never expose internal error messages in production
 * - Always log errors server-side with context
 * - Include request ID for support reference
 */

const { logger, sanitizeErrorForClient } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    // Attach request ID to error for tracking
    err.requestId = req.requestId;

    // Log the full error server-side (with context)
    const logContext = {
        requestId: req.requestId,
        tenantId: req.tenant?.id,
        userId: req.user?.uid,
        meta: {
            method: req.method,
            path: req.path,
            stack: err.stack
        }
    };

    // Determine severity and log appropriately
    if (err.status >= 500 || !err.status) {
        logger.error(err.message || 'Internal server error', logContext);
    } else if (err.status >= 400) {
        logger.warn(err.message || 'Client error', logContext);
    }

    // Handle specific error types with appropriate status codes
    let status = err.status || 500;

    if (err.name === 'ValidationError') {
        status = 400;
    } else if (err.code === 'PERMISSION_DENIED') {
        status = 403;
    } else if (err.code === 'NOT_FOUND') {
        status = 404;
    } else if (err.code === 'auth/id-token-expired') {
        status = 401;
    } else if (err.code === 'RATE_LIMITED') {
        status = 429;
    }

    // CRITICAL: Never send raw error details to client in production
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction || status >= 500) {
        // Sanitized response for production / server errors
        return res.status(status).json({
            success: false,
            ...sanitizeErrorForClient(err)
        });
    }

    // In development, allow more detail for client errors (4xx)
    res.status(status).json({
        success: false,
        error: err.message || 'An error occurred',
        code: err.code,
        requestId: req.requestId
    });
};

// Not found handler for undefined routes
const notFoundHandler = (req, res) => {
    // Log 404s for monitoring (potential scanning/attacks)
    logger.debug(`404: ${req.method} ${req.originalUrl}`, {
        requestId: req.requestId,
        tenantId: req.tenant?.id
    });

    res.status(404).json({
        success: false,
        error: 'Resource not found',
        requestId: req.requestId
    });
};

module.exports = {
    errorHandler,
    notFoundHandler
};
