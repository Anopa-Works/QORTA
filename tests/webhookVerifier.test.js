/**
 * Webhook Verifier Middleware Tests
 */

const crypto = require('crypto');
const {
    createWebhookVerifier,
    generateWebhookSignature
} = require('../middleware/webhookVerifier');

// Mock logger
jest.mock('../utils/logger', () => ({
    logger: {
        security: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    }
}));

describe('Webhook Verifier Middleware', () => {
    const TEST_SECRET = 'test-webhook-secret-key';
    let mockReq;
    let mockRes;
    let nextFn;
    let originalEnv;

    beforeEach(() => {
        // Save and set environment
        originalEnv = process.env.WEBHOOK_SECRET;
        process.env.WEBHOOK_SECRET = TEST_SECRET;

        mockReq = {
            requestId: 'test-123',
            path: '/webhook',
            body: { event: 'order.created', orderId: '123' },
            get: jest.fn()
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        nextFn = jest.fn();
    });

    afterEach(() => {
        // Restore environment
        process.env.WEBHOOK_SECRET = originalEnv;
    });

    describe('generateWebhookSignature', () => {
        test('should generate valid HMAC-SHA256 signature', () => {
            const payload = JSON.stringify({ test: 'data' });
            const timestamp = 1234567890;

            const result = generateWebhookSignature(payload, TEST_SECRET, timestamp);

            expect(result.timestamp).toBe(timestamp);
            expect(result.signature).toBeDefined();
            expect(result.signature).toHaveLength(64); // SHA256 hex = 64 chars
        });

        test('should generate different signatures for different payloads', () => {
            const timestamp = Date.now();
            const sig1 = generateWebhookSignature('payload1', TEST_SECRET, timestamp);
            const sig2 = generateWebhookSignature('payload2', TEST_SECRET, timestamp);

            expect(sig1.signature).not.toBe(sig2.signature);
        });

        test('should generate different signatures for different timestamps', () => {
            const payload = 'same-payload';
            const sig1 = generateWebhookSignature(payload, TEST_SECRET, 1000);
            const sig2 = generateWebhookSignature(payload, TEST_SECRET, 2000);

            expect(sig1.signature).not.toBe(sig2.signature);
        });
    });

    describe('createWebhookVerifier', () => {
        test('should reject requests without signature', () => {
            const verifier = createWebhookVerifier();
            mockReq.get.mockReturnValue(undefined);

            verifier(mockReq, mockRes, nextFn);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: 'Missing webhook signature'
                })
            );
            expect(nextFn).not.toHaveBeenCalled();
        });

        test('should reject requests with invalid signature', () => {
            const verifier = createWebhookVerifier();
            const timestamp = Math.floor(Date.now() / 1000);

            mockReq.get.mockImplementation((header) => {
                if (header === 'x-webhook-signature') return 'invalid-signature'.padEnd(64, '0');
                if (header === 'x-webhook-timestamp') return timestamp.toString();
                return undefined;
            });

            verifier(mockReq, mockRes, nextFn);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Invalid webhook signature'
                })
            );
            expect(nextFn).not.toHaveBeenCalled();
        });

        test('should accept requests with valid signature', () => {
            const verifier = createWebhookVerifier();
            const payload = JSON.stringify(mockReq.body);
            const { signature, timestamp } = generateWebhookSignature(payload, TEST_SECRET);

            mockReq.get.mockImplementation((header) => {
                if (header === 'x-webhook-signature') return signature;
                if (header === 'x-webhook-timestamp') return timestamp.toString();
                return undefined;
            });

            verifier(mockReq, mockRes, nextFn);

            expect(nextFn).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        test('should reject requests with expired timestamp', () => {
            const verifier = createWebhookVerifier({ timestampTolerance: 300 });
            const expiredTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
            const payload = JSON.stringify(mockReq.body);
            const { signature } = generateWebhookSignature(payload, TEST_SECRET, expiredTimestamp);

            mockReq.get.mockImplementation((header) => {
                if (header === 'x-webhook-signature') return signature;
                if (header === 'x-webhook-timestamp') return expiredTimestamp.toString();
                return undefined;
            });

            verifier(mockReq, mockRes, nextFn);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Webhook timestamp expired'
                })
            );
        });

        test('should reject future timestamps', () => {
            const verifier = createWebhookVerifier();
            const futureTimestamp = Math.floor(Date.now() / 1000) + 120; // 2 minutes in future
            const payload = JSON.stringify(mockReq.body);
            const { signature } = generateWebhookSignature(payload, TEST_SECRET, futureTimestamp);

            mockReq.get.mockImplementation((header) => {
                if (header === 'x-webhook-signature') return signature;
                if (header === 'x-webhook-timestamp') return futureTimestamp.toString();
                return undefined;
            });

            verifier(mockReq, mockRes, nextFn);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        test('should detect replay attacks', () => {
            const verifier = createWebhookVerifier();
            const payload = JSON.stringify(mockReq.body);
            const { signature, timestamp } = generateWebhookSignature(payload, TEST_SECRET);
            const webhookId = 'unique-webhook-id-123';

            mockReq.get.mockImplementation((header) => {
                if (header === 'x-webhook-signature') return signature;
                if (header === 'x-webhook-timestamp') return timestamp.toString();
                if (header === 'x-webhook-id') return webhookId;
                return undefined;
            });

            // First request should succeed
            verifier(mockReq, mockRes, nextFn);
            expect(nextFn).toHaveBeenCalledTimes(1);

            // Second request with same ID should be rejected
            verifier(mockReq, mockRes, nextFn);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Webhook already processed'
                })
            );
        });

        test('should skip verification when no secret configured', () => {
            delete process.env.WEBHOOK_SECRET;
            const verifier = createWebhookVerifier();

            verifier(mockReq, mockRes, nextFn);

            expect(nextFn).toHaveBeenCalled();
        });

        test('should use custom headers', () => {
            const verifier = createWebhookVerifier({
                signatureHeader: 'x-custom-sig',
                timestampHeader: 'x-custom-ts'
            });
            const payload = JSON.stringify(mockReq.body);
            const { signature, timestamp } = generateWebhookSignature(payload, TEST_SECRET);

            mockReq.get.mockImplementation((header) => {
                if (header === 'x-custom-sig') return signature;
                if (header === 'x-custom-ts') return timestamp.toString();
                return undefined;
            });

            verifier(mockReq, mockRes, nextFn);

            expect(nextFn).toHaveBeenCalled();
        });
    });
});
