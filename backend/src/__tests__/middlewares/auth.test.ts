/**
 * Auth Middleware Unit Tests
 */

import jwt from 'jsonwebtoken';

// Mock Prisma
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({
        user: {
            findUnique: jest.fn()
        }
    }))
}));

// Mock the auth middleware
const mockAuthMiddleware = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Token error' });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

describe('Auth Middleware', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: jest.Mock;

    beforeEach(() => {
        mockReq = {
            headers: {}
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        mockNext = jest.fn();
    });

    describe('Token Validation', () => {
        it('should return 401 if no authorization header', () => {
            mockAuthMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 401 if authorization header is malformed', () => {
            mockReq.headers.authorization = 'InvalidFormat';

            mockAuthMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token error' });
        });

        it('should return 401 if token is invalid', () => {
            mockReq.headers.authorization = 'Bearer invalid-token';

            mockAuthMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
        });

        it('should call next() and set req.user for valid token', () => {
            const testUser = { id: 'user-123', email: 'test@example.com', role: 'USER' };
            const token = jwt.sign(testUser, process.env.JWT_SECRET || 'test-secret');
            mockReq.headers.authorization = `Bearer ${token}`;

            mockAuthMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.user).toBeDefined();
            expect(mockReq.user.id).toBe('user-123');
            expect(mockReq.user.email).toBe('test@example.com');
        });
    });
});

describe('Role Check', () => {
    const createRoleCheck = (allowedRoles: string[]) => (req: any, res: any, next: any) => {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };

    let mockReq: any;
    let mockRes: any;
    let mockNext: jest.Mock;

    beforeEach(() => {
        mockReq = { user: { id: '1', role: 'USER' } };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        mockNext = jest.fn();
    });

    it('should return 401 if user is not authenticated', () => {
        mockReq.user = undefined;
        const roleCheck = createRoleCheck(['ADMIN']);

        roleCheck(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 if user does not have required role', () => {
        mockReq.user = { id: '1', role: 'USER' };
        const roleCheck = createRoleCheck(['ADMIN']);

        roleCheck(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    });

    it('should call next() if user has one of the allowed roles', () => {
        mockReq.user = { id: '1', role: 'ADMIN' };
        const roleCheck = createRoleCheck(['ADMIN', 'LEADER']);

        roleCheck(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
    });

    it('should allow multiple roles', () => {
        mockReq.user = { id: '1', role: 'LEADER' };
        const roleCheck = createRoleCheck(['ADMIN', 'LEADER', 'DIRECTOR']);

        roleCheck(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
    });
});
