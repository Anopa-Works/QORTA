/**
 * QORTA Backend - Error Handler Middleware
 * Centralized error handling with consistent response format
 */

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error response
    const response = {
        success: false,
        error: err.message || 'Internal server error'
    };

    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            ...response,
            error: err.message
        });
    }

    if (err.code === 'PERMISSION_DENIED') {
        return res.status(403).json({
            ...response,
            error: 'Permission denied'
        });
    }

    if (err.code === 'NOT_FOUND') {
        return res.status(404).json({
            ...response,
            error: err.message || 'Resource not found'
        });
    }

    // Default to 500 — never send raw error messages to client
    const status = err.status || 500;
    res.status(status).json({
        success: false,
        error: status === 500 ? 'Internal server error' : (err.message || 'Internal server error')
    });
};

// Not found handler for undefined routes
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.originalUrl} not found`
    });
};

module.exports = {
    errorHandler,
    notFoundHandler
};
