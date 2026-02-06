/**
 * QORTA Backend - Centralized Logger
 * Structured logging for production-ready error handling
 *
 * RULES:
 * - No raw console.log in production
 * - All logs include request context (tenantId, userId, requestId)
 * - Errors are sanitized before client response
 * - Stack traces NEVER sent to client
 */

const crypto = require('crypto');

// Log levels
const LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
};

// Check if we're in production
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Generate a unique request ID for tracking
 */
const generateRequestId = () => {
    return crypto.randomBytes(8).toString('hex');
};

/**
 * Format log entry with context
 */
const formatLogEntry = (level, message, context = {}) => {
    const timestamp = new Date().toISOString();
    const requestId = context.requestId || 'no-request';
    const tenantId = context.tenantId || 'no-tenant';
    const userId = context.userId || 'anonymous';

    if (isProduction) {
        // Structured JSON for production (easy to parse by log aggregators)
        return JSON.stringify({
            timestamp,
            level,
            requestId,
            tenantId,
            userId,
            message,
            ...(context.meta && { meta: context.meta })
        });
    } else {
        // Human-readable for development
        return `[${timestamp}] [${level.toUpperCase()}] [${requestId}] [tenant:${tenantId}] [user:${userId}] ${message}`;
    }
};

/**
 * Core logging function
 */
const log = (level, message, context = {}) => {
    const entry = formatLogEntry(level, message, context);

    switch (level) {
        case LOG_LEVELS.ERROR:
            console.error(entry);
            break;
        case LOG_LEVELS.WARN:
            console.warn(entry);
            break;
        case LOG_LEVELS.INFO:
            if (!isProduction) console.info(entry);
            break;
        case LOG_LEVELS.DEBUG:
            if (!isProduction) console.log(entry);
            break;
    }
};

/**
 * Logger methods
 */
const logger = {
    error: (message, context = {}) => log(LOG_LEVELS.ERROR, message, context),
    warn: (message, context = {}) => log(LOG_LEVELS.WARN, message, context),
    info: (message, context = {}) => log(LOG_LEVELS.INFO, message, context),
    debug: (message, context = {}) => log(LOG_LEVELS.DEBUG, message, context),

    /**
     * Log security-related events (always logged, even in production)
     */
    security: (message, context = {}) => {
        const entry = formatLogEntry('security', message, context);
        console.warn(entry);
    },

    /**
     * Create a child logger with preset context
     */
    child: (defaultContext) => ({
        error: (message, context = {}) => logger.error(message, { ...defaultContext, ...context }),
        warn: (message, context = {}) => logger.warn(message, { ...defaultContext, ...context }),
        info: (message, context = {}) => logger.info(message, { ...defaultContext, ...context }),
        debug: (message, context = {}) => logger.debug(message, { ...defaultContext, ...context }),
        security: (message, context = {}) => logger.security(message, { ...defaultContext, ...context })
    })
};

/**
 * Express middleware to attach request context to logger
 */
const requestLogger = (req, res, next) => {
    // Generate unique request ID
    req.requestId = generateRequestId();

    // Attach logger with request context
    req.log = logger.child({
        requestId: req.requestId,
        tenantId: req.tenant?.id,
        userId: req.user?.uid
    });

    // Log request (only in development)
    if (!isProduction) {
        logger.debug(`${req.method} ${req.path}`, {
            requestId: req.requestId,
            tenantId: req.tenant?.id
        });
    }

    // Add request ID to response headers for debugging
    res.setHeader('X-Request-ID', req.requestId);

    next();
};

/**
 * Sanitize error for client response
 * NEVER expose internal details
 */
const sanitizeErrorForClient = (error) => {
    // Map of known error codes to safe messages
    const safeMessages = {
        'auth/id-token-expired': 'Session expired. Please login again.',
        'PERMISSION_DENIED': 'You do not have permission to perform this action.',
        'NOT_FOUND': 'The requested resource was not found.',
        'VALIDATION_ERROR': 'Invalid request data.',
        'RATE_LIMITED': 'Too many requests. Please try again later.'
    };

    const code = error.code || error.name || 'INTERNAL_ERROR';
    const safeMessage = safeMessages[code] || 'An error occurred. Please try again.';

    return {
        error: safeMessage,
        code: code,
        requestId: error.requestId // Include for support reference
    };
};

module.exports = {
    logger,
    requestLogger,
    generateRequestId,
    sanitizeErrorForClient,
    LOG_LEVELS
};
