/**
 * Super Admin Auth Middleware Tests
 */

const { superAdminAuth } = require('../middleware/superAdminAuth');

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

// Mock firebase-admin
const mockVerifyIdToken = jest.fn();

jest.mock('firebase-admin', () => ({
    auth: () => ({
        verifyIdToken: mockVerifyIdToken
    })
}));

describe('Super Admin Auth Middleware', () => {
    let mockReq;
    let mockRes;
    let nextFn;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            headers: {},
            requestId: 'test-123'
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        nextFn = jest.fn();
    });

    test('should reject request without authorization header', async () => {
        await superAdminAuth(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Unauthorized',
                message: 'No auth token provided'
            })
        );
        expect(nextFn).not.toHaveBeenCalled();
    });

    test('should reject request without Bearer prefix', async () => {
        mockReq.headers.authorization = 'Basic some-token';

        await superAdminAuth(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Unauthorized',
                message: 'No auth token provided'
            })
        );
    });

    test('should reject invalid token', async () => {
        mockReq.headers.authorization = 'Bearer invalid-token';
        mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

        await superAdminAuth(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Unauthorized',
                message: 'Invalid auth token'
            })
        );
    });

    test('should handle expired token', async () => {
        mockReq.headers.authorization = 'Bearer expired-token';
        const expiredError = new Error('Token expired');
        expiredError.code = 'auth/id-token-expired';
        mockVerifyIdToken.mockRejectedValue(expiredError);

        await superAdminAuth(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Token expired',
                message: 'Please login again'
            })
        );
    });

    test('should reject user without SUPER_ADMIN role', async () => {
        mockReq.headers.authorization = 'Bearer valid-token';
        mockVerifyIdToken.mockResolvedValue({
            uid: 'admin-123',
            email: 'admin@example.com',
            role: 'ADMIN' // Not SUPER_ADMIN
        });

        await superAdminAuth(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Forbidden',
                message: 'Super admin access required'
            })
        );
        expect(nextFn).not.toHaveBeenCalled();
    });

    test('should reject user with no role', async () => {
        mockReq.headers.authorization = 'Bearer valid-token';
        mockVerifyIdToken.mockResolvedValue({
            uid: 'user-123',
            email: 'user@example.com'
            // No role in claims
        });

        await superAdminAuth(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Forbidden',
                message: 'Super admin access required'
            })
        );
    });

    test('should reject regular USER role', async () => {
        mockReq.headers.authorization = 'Bearer valid-token';
        mockVerifyIdToken.mockResolvedValue({
            uid: 'user-123',
            email: 'user@example.com',
            role: 'USER'
        });

        await superAdminAuth(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(nextFn).not.toHaveBeenCalled();
    });

    test('should allow SUPER_ADMIN user', async () => {
        mockReq.headers.authorization = 'Bearer valid-token';
        mockVerifyIdToken.mockResolvedValue({
            uid: 'superadmin-123',
            email: 'superadmin@example.com',
            role: 'SUPER_ADMIN'
        });

        await superAdminAuth(mockReq, mockRes, nextFn);

        expect(mockReq.user).toEqual({
            uid: 'superadmin-123',
            email: 'superadmin@example.com',
            role: 'SUPER_ADMIN'
        });
        expect(nextFn).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should log security event for non-super-admin access attempt', async () => {
        const { logger } = require('../utils/logger');

        mockReq.headers.authorization = 'Bearer valid-token';
        mockVerifyIdToken.mockResolvedValue({
            uid: 'admin-123',
            email: 'admin@example.com',
            role: 'ADMIN'
        });

        await superAdminAuth(mockReq, mockRes, nextFn);

        expect(logger.security).toHaveBeenCalledWith(
            'Non-super-admin access attempt to platform route',
            expect.objectContaining({
                userId: 'admin-123',
                meta: expect.objectContaining({
                    email: 'admin@example.com',
                    role: 'ADMIN'
                })
            })
        );
    });
});
