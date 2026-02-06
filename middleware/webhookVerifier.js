/**
 * QORTA Backend - Webhook Signature Verification Middleware
 * Protects webhook endpoints from unauthorized requests
 *
 * SECURITY REQUIREMENTS:
 * - Verify webhook signatures using HMAC-SHA256
 * - Enforce timestamp tolerance to prevent replay attacks
 * - Reject requests with missing or invalid signatures
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');

// Replay protection: Track processed webhook IDs
const processedWebhooks = new Map();

// Clean up old entries every 10 minutes
setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    for (const [id, timestamp] of processedWebhooks.entries()) {
        if (timestamp < cutoff) {
            processedWebhooks.delete(id);
        }
    }
}, 10 * 60 * 1000);

/**
 * Create a webhook verification middleware
 * @param {Object} options
 * @param {string} options.secretEnvVar - Environment variable name containing webhook secret
 * @param {string} options.signatureHeader - Header name containing signature (default: 'x-webhook-signature')
 * @param {string} options.timestampHeader - Header name containing timestamp (default: 'x-webhook-timestamp')
 * @param {number} options.timestampTolerance - Max age of webhook in seconds (default: 300 = 5 minutes)
 * @param {string} options.idHeader - Header containing unique webhook ID for replay protection (optional)
 */
const createWebhookVerifier = (options = {}) => {
    const {
        secretEnvVar = 'WEBHOOK_SECRET',
        signatureHeader = 'x-webhook-signature',
        timestampHeader = 'x-webhook-timestamp',
        timestampTolerance = 300, // 5 minutes
        idHeader = 'x-webhook-id'
    } = options;

    return (req, res, next) => {
        const secret = process.env[secretEnvVar];

        // If no secret configured, skip verification (development mode)
        if (!secret) {
            logger.warn('Webhook verification skipped - no secret configured', {
                requestId: req.requestId,
                meta: { secretEnvVar }
            });
            return next();
        }

        const signature = req.get(signatureHeader);
        const timestamp = req.get(timestampHeader);
        const webhookId = req.get(idHeader);

        // Verify signature is present
        if (!signature) {
            logger.security('Webhook rejected - missing signature', {
                requestId: req.requestId,
                meta: { path: req.path }
            });
            return res.status(401).json({
                success: false,
                error: 'Missing webhook signature'
            });
        }

        // Verify timestamp is present and within tolerance
        if (timestamp) {
            const webhookTime = parseInt(timestamp, 10);
            const now = Math.floor(Date.now() / 1000);
            const age = now - webhookTime;

            if (isNaN(webhookTime) || age > timestampTolerance || age < -60) {
                logger.security('Webhook rejected - timestamp out of tolerance', {
                    requestId: req.requestId,
                    meta: { age, tolerance: timestampTolerance }
                });
                return res.status(401).json({
                    success: false,
                    error: 'Webhook timestamp expired'
                });
            }
        }

        // Replay protection - check if webhook ID was already processed
        if (webhookId) {
            if (processedWebhooks.has(webhookId)) {
                logger.security('Webhook rejected - replay detected', {
                    requestId: req.requestId,
                    meta: { webhookId }
                });
                return res.status(401).json({
                    success: false,
                    error: 'Webhook already processed'
                });
            }
        }

        // Compute expected signature
        // Standard format: HMAC-SHA256(timestamp.body)
        const rawBody = req.rawBody || JSON.stringify(req.body);
        const payload = timestamp ? `${timestamp}.${rawBody}` : rawBody;
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');

        // Compare signatures using timing-safe comparison
        const signatureBuffer = Buffer.from(signature, 'hex');
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');

        if (signatureBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
            logger.security('Webhook rejected - invalid signature', {
                requestId: req.requestId,
                meta: { path: req.path }
            });
            return res.status(401).json({
                success: false,
                error: 'Invalid webhook signature'
            });
        }

        // Mark webhook as processed (replay protection)
        if (webhookId) {
            processedWebhooks.set(webhookId, Date.now());
        }

        logger.debug('Webhook signature verified', {
            requestId: req.requestId,
            meta: { webhookId }
        });

        next();
    };
};

/**
 * Generate a webhook signature for testing
 * @param {string} payload - Request body as string
 * @param {string} secret - Webhook secret
 * @param {number} timestamp - Unix timestamp (optional)
 * @returns {Object} - { signature, timestamp }
 */
const generateWebhookSignature = (payload, secret, timestamp = null) => {
    const ts = timestamp || Math.floor(Date.now() / 1000);
    const signedPayload = `${ts}.${payload}`;
    const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

    return { signature, timestamp: ts };
};

// Pre-configured verifiers for common providers

// Generic webhook verifier
const webhookVerifier = createWebhookVerifier({
    secretEnvVar: 'WEBHOOK_SECRET'
});

// Stripe-style webhook verifier (different header names)
const stripeWebhookVerifier = createWebhookVerifier({
    secretEnvVar: 'STRIPE_WEBHOOK_SECRET',
    signatureHeader: 'stripe-signature',
    timestampHeader: null, // Stripe includes timestamp in signature
    idHeader: null
});

module.exports = {
    createWebhookVerifier,
    generateWebhookSignature,
    webhookVerifier,
    stripeWebhookVerifier
};
