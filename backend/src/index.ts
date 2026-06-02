import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { prisma } from './db';
import { authMiddleware, fileAuthMiddleware, roleCheck } from './middlewares/auth';

import authRoutes from './routes/authRoutes';
import requirementRoutes from './routes/requirementRoutes';
import notificationRoutes from './routes/notificationRoutes';
import reportsRoutes from './routes/reportsRoutes';
import paymentRoutes from './routes/paymentRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import budgetRoutes from './routes/budgetRoutes';
import adjustmentRoutes from './routes/adjustmentRoutes';
import invoiceRoutes from './routes/invoiceRoutes';
import submissionRulesRoutes from './routes/submissionRulesRoutes';
import aiRoutes from './routes/aiRoutes';

dotenv.config();

// Validate critical environment variables
const validateEnv = () => {
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error(`[CONFIG ERROR] Missing required environment variables: ${missing.join(', ')}`);
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
        console.error('[CONFIG ERROR] The application may not function correctly.');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret === 'fallback_secret' || !jwtSecret || jwtSecret.length < 32) {
        const message = '[SECURITY WARNING] JWT_SECRET must be a strong secret with at least 32 characters.';
        if (process.env.NODE_ENV === 'production') {
            console.error(message);
            process.exit(1);
        }
        console.warn(message);
    }
};

validateEnv();

const app = express();

// Database Initialization moved to ./db.ts

const PORT = process.env.PORT || 4000;

// Middlewares
const allowedOrigins = [
    process.env.CORS_ORIGIN,
    'https://miscompras-front-prod-g4akhtbsagfpefbk.canadacentral-01.azurewebsites.net',
    'https://miscompras-api-prod.azurewebsites.net',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001'
].filter(Boolean) as string[];

console.log('configured allowed origins:', allowedOrigins);

app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '10mb' }));
app.use('/uploads', express.static('uploads'));
app.use('/api/uploads', fileAuthMiddleware, express.static('uploads'));
app.use('/api/exports', fileAuthMiddleware, express.static('exports'));

// Public Routes (No auth needed)
app.use('/api/auth', authRoutes);

// Catalog Routes (Public for registration) - Real DB queries
app.get('/api/areas', async (req, res) => {
    try {
        const areas = await prisma.area.findMany({ orderBy: { name: 'asc' } });
        res.json(areas);
    } catch (e) {
        console.error('Error fetching areas:', e);
        res.status(500).json({ error: 'Error fetching areas' });
    }
});

app.get('/api/projects', authMiddleware, async (req, res) => {
    try {
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        // Build where clause based on role
        let where: any = {};

        // Only filter for USER role - DIRECTOR/ADMIN/COORDINATOR see all projects
        if (userRole === 'USER' && userId) {
            // USER can see projects where:
            // 1. They are project leader or sub-leader
            // 2. They have approved budgets where they are manager or sub-leader of the budget
            where = {
                OR: [
                    { leaderId: userId },
                    { subLeaderId: userId },
                    {
                        budgets: {
                            some: {
                                status: 'APPROVED',
                                OR: [
                                    { managerId: userId },
                                    { subLeaders: { some: { userId } } }
                                ]
                            }
                        }
                    }
                ]
            };
        }

        const projects = await prisma.project.findMany({
            where,
            orderBy: { name: 'asc' },
            include: {
                leader: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        areaId: true
                    }
                }
            }
        });
        res.json(projects);
    } catch (e) {
        console.error('Error fetching projects:', e);
        res.status(500).json({ error: 'Error fetching projects' });
    }
});

app.get('/api/categories', authMiddleware, async (req, res) => {
    try {
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        let where: any = {};

        // Only filter for USER role - DIRECTOR/ADMIN/COORDINATOR see all categories
        if (userRole === 'USER' && userId) {
            // USER can see categories from budgets where:
            // 1. They are manager or sub-leader of the budget
            // 2. They are leader or sub-leader of the project that owns the budget
            where = {
                budgets: {
                    some: {
                        status: 'APPROVED',
                        OR: [
                            { managerId: userId },
                            { subLeaders: { some: { userId } } },
                            { project: { OR: [{ leaderId: userId }, { subLeaderId: userId }] } }
                        ]
                    }
                }
            };
        }

        const categories = await prisma.category.findMany({
            where,
            orderBy: { code: 'asc' }
        });
        res.json(categories);
    } catch (e) {
        console.error('Error fetching categories:', e);
        res.status(500).json({ error: 'Error fetching categories' });
    }
});

// Suppliers route (real DB)
app.get('/api/suppliers', authMiddleware, async (req, res) => {
    try {
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        let whereClause: any = {};

        // If USER role, filter suppliers by visibility (only those linked to visible requirements)
        if (userRole === 'USER' && userId) {
            whereClause = {
                requirements: {
                    some: {
                        OR: [
                            { createdById: userId },
                            {
                                budget: {
                                    OR: [
                                        { managerId: userId },
                                        { subLeaders: { some: { userId: userId } } }
                                    ]
                                }
                            }
                        ]
                    }
                }
            };
        }

        const suppliers = await prisma.supplier.findMany({
            where: whereClause,
            orderBy: { name: 'asc' },
            include: {
                ratings: {
                    select: { overallRating: true }
                },
                _count: {
                    select: { requirements: true }
                }
            }
        });

        // Calculate average rating for each supplier
        const suppliersWithRatings = suppliers.map(supplier => {
            const ratingsCount = supplier.ratings.length;
            const avgRating = ratingsCount > 0
                ? Math.round((supplier.ratings.reduce((sum, r) => sum + r.overallRating, 0) / ratingsCount) * 10) / 10
                : 0;

            return {
                ...supplier,
                ratings: undefined, // Remove detailed ratings from list
                avgRating,
                ratingsCount
            };
        });

        res.json(suppliersWithRatings);
    } catch (e) {
        console.error('Error fetching suppliers:', e);
        res.status(500).json({ error: 'Error fetching suppliers' });
    }
});

// Supplier detail route
app.get('/api/suppliers/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const supplier = await prisma.supplier.findUnique({
            where: { id },
            include: {
                requirements: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        area: true,
                        project: true,
                        budget: { include: { category: true } }
                    }
                },
                invoices: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        requirement: true
                    }
                },
                ratings: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        requirement: {
                            select: { id: true, title: true }
                        }
                    }
                }
            }
        });

        if (!supplier) {
            return res.status(404).json({ error: 'Supplier not found' });
        }

        // Calculate totals
        const totalRequirements = supplier.requirements.length;
        const totalInvoices = supplier.invoices.length;
        const totalAmount = supplier.requirements.reduce((sum, req) => {
            return sum + (Number(req.actualAmount) || Number(req.totalAmount) || 0);
        }, 0);
        const approvedRequirements = supplier.requirements.filter(r => r.status === 'APPROVED').length;
        const pendingRequirements = supplier.requirements.filter(r => r.status === 'PENDING_APPROVAL').length;

        // Calculate rating averages
        const ratingsCount = supplier.ratings.length;
        let avgOverall = 0, avgDelivery = 0, avgQuality = 0, avgPrice = 0;

        if (ratingsCount > 0) {
            avgOverall = supplier.ratings.reduce((sum, r) => sum + r.overallRating, 0) / ratingsCount;
            avgDelivery = supplier.ratings.reduce((sum, r) => sum + r.deliveryRating, 0) / ratingsCount;
            avgQuality = supplier.ratings.reduce((sum, r) => sum + r.qualityRating, 0) / ratingsCount;
            avgPrice = supplier.ratings.reduce((sum, r) => sum + r.priceRating, 0) / ratingsCount;
        }

        res.json({
            ...supplier,
            stats: {
                totalRequirements,
                totalInvoices,
                totalAmount,
                approvedRequirements,
                pendingRequirements
            },
            ratingStats: {
                count: ratingsCount,
                avgOverall: Math.round(avgOverall * 10) / 10,
                avgDelivery: Math.round(avgDelivery * 10) / 10,
                avgQuality: Math.round(avgQuality * 10) / 10,
                avgPrice: Math.round(avgPrice * 10) / 10
            }
        });
    } catch (e) {
        console.error('Error fetching supplier detail:', e);
        res.status(500).json({ error: 'Error fetching supplier detail' });
    }
});


// Protected Routes
app.use('/api/requirements', authMiddleware, requirementRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/reports', authMiddleware, reportsRoutes);
app.use('/api/payments', authMiddleware, paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/adjustments', adjustmentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/submission-rules', submissionRulesRoutes);
app.use('/api/ai', aiRoutes);


// NOTE: Budget CRUD is handled by budgetRoutes mounted at /api/budgets

app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', message: 'API Miscompras en ejecución' });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Error Interno del Servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

export { prisma };
