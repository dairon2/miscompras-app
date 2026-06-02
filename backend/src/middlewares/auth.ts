import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
        areaId?: string | null;
    };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    // Bypass only for local automated tests. Never allow this in deployed environments.
    if (process.env.NODE_ENV === 'test' && token === 'mock-token') {
        req.user = { id: 'mock-admin-id', email: 'daironmoreno24@gmail.com', role: 'ADMIN' };
        return next();
    }

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('[AUTH ERROR] JWT_SECRET is not configured');
            return res.status(500).json({ error: 'Authentication is not configured' });
        }

        const decoded = jwt.verify(token, secret) as any;
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

export const fileAuthMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const bearerToken = req.headers.authorization?.split(' ')[1];
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    const token = bearerToken || queryToken;

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('[AUTH ERROR] JWT_SECRET is not configured');
            return res.status(500).json({ error: 'Authentication is not configured' });
        }

        const decoded = jwt.verify(token, secret) as any;
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

export const roleCheck = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            console.log(`[RoleCheck] Access Denied. User Role: '${req.user?.role}'. Required: ${JSON.stringify(roles)}`);
            return res.status(403).json({ error: `Acceso no autorizado. Tu rol es: '${req.user?.role || 'Ninguno'}'. Roles requeridos: ${roles.join(', ')}` });
        }
        next();
    };
};
