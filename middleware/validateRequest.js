/**
 * QORTA Backend - Request Validation Middleware
 * Validates request body for required fields
 */

const validateRequest = (requiredFields) => {
    return (req, res, next) => {
        const errors = [];

        for (const field of requiredFields) {
            if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
                errors.push(`${field} is required`);
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }

        next();
    };
};

// Validate order creation
const validateOrder = (req, res, next) => {
    const { items, orderType } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Order must contain at least one item'
        });
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.menuItemId) {
            return res.status(400).json({
                success: false,
                error: `Item ${i + 1}: menuItemId is required`
            });
        }
        if (!item.quantity || item.quantity < 1) {
            return res.status(400).json({
                success: false,
                error: `Item ${i + 1}: quantity must be at least 1`
            });
        }
    }

    // Validate order type if provided
    const validTypes = ['DINE_IN', 'TAKEOUT', 'DELIVERY'];
    if (orderType && !validTypes.includes(orderType)) {
        return res.status(400).json({
            success: false,
            error: `Invalid orderType. Must be one of: ${validTypes.join(', ')}`
        });
    }

    next();
};

// Validate status update
const validateStatusUpdate = (req, res, next) => {
    const { status } = req.body;
    const validStatuses = ['NEW', 'PREP', 'READY', 'COMPLETE'];

    if (!status) {
        return res.status(400).json({
            success: false,
            error: 'status is required'
        });
    }

    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
    }

    next();
};

module.exports = {
    validateRequest,
    validateOrder,
    validateStatusUpdate
};
