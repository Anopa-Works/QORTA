/**
 * Rate Limiter Middleware Tests
 */

const { createRateLimiter, apiLimiter, authLimiter } = require('../middleware/rateLimiter');

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

describe('Rate Limiter Middleware', () => {
    let mockReq;
    let mockRes;
    let nextFn;
    let testId;

    beforeEach(() => {
        // Generate unique test ID to isolate rate limit counts between tests
        testId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Reset mocks with unique IP per test
        mockReq = {
            ip: testId,
            params: { slug: `tenant-${testId}` },
            connection: { remoteAddress: testId }
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            setHeader: jest.fn()
        };
        nextFn = jest.fn();
    });

    describe('createRateLimiter', () => {
        test('should allow requests under the limit', () => {
            const limiter = createRateLimiter({ max: 5, windowMs: 60000 });

            // Make 5 requests (at limit)
            for (let i = 0; i < 5; i++) {
                limiter(mockReq, mockRes, nextFn);
            }

            expect(nextFn).toHaveBeenCalledTimes(5);
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        test('should block requests over the limit', () => {
            const limiter = createRateLimiter({ max: 3, windowMs: 60000 });

            // Make 4 requests (over limit)
            for (let i = 0; i < 4; i++) {
                limiter(mockReq, mockRes, nextFn);
            }

            expect(nextFn).toHaveBeenCalledTimes(3);
            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    code: 'RATE_LIMITED'
                })
            );
        });

        test('should set rate limit headers', () => {
            const limiter = createRateLimiter({ max: 10, windowMs: 60000 });

            limiter(mockReq, mockRes, nextFn);

            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
            expect(mockRes.setHeader).toHaveBeenCalledWith(
                'X-RateLimit-Reset',
                expect.any(Number)
            );
        });

        test('should use custom key generator', () => {
            const uniqueKey = `custom-${testId}`;
            const keyGenerator = jest.fn().mockReturnValue(uniqueKey);
            const limiter = createRateLimiter({ max: 5, keyGenerator });

            limiter(mockReq, mockRes, nextFn);

            expect(keyGenerator).toHaveBeenCalledWith(mockReq);
        });

        test('should use custom error message', () => {
            const customMessage = 'Custom rate limit message';
            const limiter = createRateLimiter({ max: 1, message: customMessage });

            // First request OK
            limiter(mockReq, mockRes, nextFn);
            // Second request blocked
            limiter(mockReq, mockRes, nextFn);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: customMessage
                })
            );
        });

        test('should track different IPs separately', () => {
            const limiter = createRateLimiter({ max: 2, windowMs: 60000 });

            // IP 1 - 2 requests
            mockReq.ip = `ip1-${testId}`;
            limiter(mockReq, mockRes, nextFn);
            limiter(mockReq, mockRes, nextFn);

            // IP 2 - 2 requests (should not be blocked)
            mockReq.ip = `ip2-${testId}`;
            limiter(mockReq, mockRes, nextFn);
            limiter(mockReq, mockRes, nextFn);

            expect(nextFn).toHaveBeenCalledTimes(4);
            expect(mockRes.status).not.toHaveBeenCalledWith(429);
        });

        test('should set Retry-After header when rate limited', () => {
            const limiter = createRateLimiter({ max: 1, windowMs: 60000 });

            limiter(mockReq, mockRes, nextFn);
            limiter(mockReq, mockRes, nextFn);

            expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', 60);
        });
    });

    describe('authLimiter', () => {
        test('should use compound key with tenant and IP', () => {
            // Use unique identifiers for this test
            mockReq.params.slug = `restaurant-${testId}`;
            mockReq.ip = `auth-ip-${testId}`;

            // 10 requests should be allowed
            for (let i = 0; i < 10; i++) {
                authLimiter(mockReq, mockRes, nextFn);
            }

            expect(nextFn).toHaveBeenCalledTimes(10);

            // 11th request should be blocked
            authLimiter(mockReq, mockRes, nextFn);
            expect(mockRes.status).toHaveBeenCalledWith(429);
        });
    });

    describe('apiLimiter', () => {
        test('should allow 100 requests per minute', () => {
            // Use unique identifiers for this test
            mockReq.ip = `api-ip-${testId}`;
            mockReq.params.slug = `api-tenant-${testId}`;

            // Make 100 requests
            for (let i = 0; i < 100; i++) {
                apiLimiter(mockReq, mockRes, nextFn);
            }

            expect(nextFn).toHaveBeenCalledTimes(100);

            // 101st should be blocked
            apiLimiter(mockReq, mockRes, nextFn);
            expect(mockRes.status).toHaveBeenCalledWith(429);
        });
    });
});
