/**
 * Auth Middleware Tests
 */

const { auth, optionalAuth } = require('../middleware/auth');

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
const mockGet = jest.fn();

jest.mock('firebase-admin', () => ({
    auth: () => ({
        verifyIdToken: mockVerifyIdToken
    }),
    firestore: () => ({
        collection: () => ({
            doc: () => ({
                get: mockGet
            })
        })
    })
}));

describe('Auth Middleware', () => {
    let mockReq;
    let mockRes;
    let nextFn;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            headers: {},
            requestId: 'test-123',
            tenant: null
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        nextFn = jest.fn();
    });

    describe('auth middleware', () => {
        test('should reject request without authorization header', async () => {
            await auth(mockReq, mockRes, nextFn);

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

            await auth(mockReq, mockRes, nextFn);

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

            await auth(mockReq, mockRes, nextFn);

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

            await auth(mockReq, mockRes, nextFn);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Token expired',
                    message: 'Please login again'
                })
            );
        });

        test('should reject non-admin users', async () => {
            mockReq.headers.authorization = 'Bearer valid-token';
            mockVerifyIdToken.mockResolvedValue({
                uid: 'user-123',
                email: 'user@example.com',
                email_verified: true
            });
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    tenantId: 'tenant-123',
                    role: 'USER' // Not ADMIN
                })
            });

            await auth(mockReq, mockRes, nextFn);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Forbidden',
                    message: 'Admin access required.'
                })
            );
        });

        test('should reject users without role', async () => {
            mockReq.headers.authorization = 'Bearer valid-token';
            mockVerifyIdToken.mockResolvedValue({
                uid: 'user-123',
                email: 'user@example.com',
                email_verified: true
            });
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    tenantId: 'tenant-123'
                    // No role
                })
            });

            await auth(mockReq, mockRes, nextFn);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Admin access required.'
                })
            );
        });

        test('should allow valid admin user', async () => {
            mockReq.headers.authorization = 'Bearer valid-token';
            mockVerifyIdToken.mockResolvedValue({
                uid: 'admin-123',
                email: 'admin@example.com',
                email_verified: true
            });
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    tenantId: 'tenant-123',
                    role: 'ADMIN'
                })
            });

            await auth(mockReq, mockRes, nextFn);

            expect(mockReq.user).toEqual(
                expect.objectContaining({
                    uid: 'admin-123',
                    email: 'admin@example.com',
                    role: 'ADMIN',
                    tenantId: 'tenant-123'
                })
            );
            expect(nextFn).toHaveBeenCalled();
        });

        test('should block cross-tenant access', async () => {
            mockReq.headers.authorization = 'Bearer valid-token';
            mockReq.tenant = { id: 'tenant-A' }; // Request is for tenant A

            mockVerifyIdToken.mockResolvedValue({
                uid: 'admin-123',
                email: 'admin@example.com',
                email_verified: true
            });
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    tenantId: 'tenant-B', // User belongs to tenant B
                    role: 'ADMIN'
                })
            });

            await auth(mockReq, mockRes, nextFn);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Forbidden',
                    message: 'You do not have access to this restaurant instance.'
                })
            );
            expect(nextFn).not.toHaveBeenCalled();
        });

        test('should block user with no tenant accessing tenant route', async () => {
            mockReq.headers.authorization = 'Bearer valid-token';
            mockReq.tenant = { id: 'tenant-123' };

            mockVerifyIdToken.mockResolvedValue({
                uid: 'user-123',
                email: 'user@example.com',
                email_verified: true
            });
            mockGet.mockResolvedValue({
                exists: false // User has no admin profile
            });

            await auth(mockReq, mockRes, nextFn);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'No restaurant associated with this account.'
                })
            );
        });
    });

    describe('optionalAuth middleware', () => {
        test('should continue without auth header', async () => {
            await optionalAuth(mockReq, mockRes, nextFn);

            expect(mockReq.user).toBeUndefined();
            expect(nextFn).toHaveBeenCalled();
        });

        test('should attach user if valid token provided', async () => {
            mockReq.headers.authorization = 'Bearer valid-token';
            mockVerifyIdToken.mockResolvedValue({
                uid: 'user-123',
                email: 'user@example.com',
                email_verified: true
            });

            await optionalAuth(mockReq, mockRes, nextFn);

            expect(mockReq.user).toEqual(
                expect.objectContaining({
                    uid: 'user-123',
                    email: 'user@example.com'
                })
            );
            expect(nextFn).toHaveBeenCalled();
        });

        test('should continue without error for invalid token', async () => {
            mockReq.headers.authorization = 'Bearer invalid-token';
            mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

            await optionalAuth(mockReq, mockRes, nextFn);

            expect(mockReq.user).toBeUndefined();
            expect(nextFn).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });
    });
});
