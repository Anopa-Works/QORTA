/**
 * Tenant Resolver Middleware Tests
 */

const tenantResolver = require('../middleware/tenantResolver');

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

// Mock Tenant model
jest.mock('../models/Tenant', () => ({
    findBySlug: jest.fn()
}));

const Tenant = require('../models/Tenant');

describe('Tenant Resolver Middleware', () => {
    let mockReq;
    let mockRes;
    let nextFn;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            params: { slug: 'test-restaurant' },
            requestId: 'test-123'
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        nextFn = jest.fn();
    });

    test('should reject request without slug', async () => {
        mockReq.params.slug = undefined;

        await tenantResolver(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'Tenant slug is required'
            })
        );
        expect(nextFn).not.toHaveBeenCalled();
    });

    test('should reject request with empty slug', async () => {
        mockReq.params.slug = '';

        await tenantResolver(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(nextFn).not.toHaveBeenCalled();
    });

    test('should return 404 for non-existent tenant', async () => {
        Tenant.findBySlug.mockResolvedValue(null);

        await tenantResolver(mockReq, mockRes, nextFn);

        expect(Tenant.findBySlug).toHaveBeenCalledWith('test-restaurant');
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'Restaurant not found'
            })
        );
        expect(nextFn).not.toHaveBeenCalled();
    });

    test('should return 403 for inactive tenant', async () => {
        Tenant.findBySlug.mockResolvedValue({
            id: 'tenant-123',
            slug: 'test-restaurant',
            name: 'Test Restaurant',
            isActive: false
        });

        await tenantResolver(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'This restaurant is currently unavailable'
            })
        );
        expect(nextFn).not.toHaveBeenCalled();
    });

    test('should attach tenant to request for valid active tenant', async () => {
        const mockTenant = {
            id: 'tenant-123',
            slug: 'test-restaurant',
            name: 'Test Restaurant',
            isActive: true
        };
        Tenant.findBySlug.mockResolvedValue(mockTenant);

        await tenantResolver(mockReq, mockRes, nextFn);

        expect(mockReq.tenant).toEqual(mockTenant);
        expect(nextFn).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
        Tenant.findBySlug.mockRejectedValue(new Error('Database connection failed'));

        await tenantResolver(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'Failed to resolve restaurant'
            })
        );
        expect(nextFn).not.toHaveBeenCalled();
    });

    test('should handle various slug formats', async () => {
        const testCases = [
            'simple',
            'with-dashes',
            'with-numbers-123',
            'UPPERCASE'
        ];

        for (const slug of testCases) {
            mockReq.params.slug = slug;
            Tenant.findBySlug.mockResolvedValue({
                id: `tenant-${slug}`,
                slug: slug,
                isActive: true
            });

            await tenantResolver(mockReq, mockRes, nextFn);

            expect(Tenant.findBySlug).toHaveBeenCalledWith(slug);
        }
    });
});
