import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, roleCheck } from './middlewares/auth';

import authRoutes from './routes/authRoutes';
import requirementRoutes from './routes/requirementRoutes';
import notificationRoutes from './routes/notificationRoutes';
import reportRoutes from './routes/reportRoutes';
import paymentRoutes from './routes/paymentRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import budgetRoutes from './routes/budgetRoutes';
import adjustmentRoutes from './routes/adjustmentRoutes';
import invoiceRoutes from './routes/invoiceRoutes';

dotenv.config();

// Validate critical environment variables
const validateEnv = () => {
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error(`[CONFIG ERROR] Missing required environment variables: ${missing.join(', ')}`);
        console.error('[CONFIG ERROR] The application may not function correctly.');
    }

    // Warn about default JWT secret
    if (process.env.JWT_SECRET === 'fallback_secret' || !process.env.JWT_SECRET) {
        console.warn('[SECURITY WARNING] Using default JWT_SECRET. Set a strong secret in production!');
    }
};

validateEnv();

const app = express();

// Import demo data from separate file (only used when DATABASE_URL is not configured)
import { prismaMock } from './demoData';

// Database Initialization
let prisma: PrismaClient;

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
    console.log('--- PRODUCTION MODE: Connecting to Database ---');
    prisma = new PrismaClient({
        log: ['error', 'warn'],
    });
    // Test connection
    prisma.$connect()
        .then(() => console.log('Successfully connected to Azure PostgreSQL'))
        .catch((e) => {
            console.error('DATABASE CONNECTION ERROR:', e.message);
            console.error('Check your DATABASE_URL and Azure Firewall rules.');
        });
} else {
    console.log('--- DEMO MODE: Database disabled (using prismaMock) ---');
    prisma = prismaMock as any;
}

const PORT = process.env.PORT || 4000;

// Middlewares
const allowedOrigins = [
    process.env.CORS_ORIGIN,
    'https://miscompras-front-prod-g4akhtbsagfpefbk.canadacentral-01.azurewebsites.net',
    'https://miscompras-api-prod.azurewebsites.net',
    'http://localhost:3000'
].filter(Boolean) as string[];

app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

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
        const projects = await prisma.project.findMany({ orderBy: { name: 'asc' } });
        res.json(projects);
    } catch (e) {
        console.error('Error fetching projects:', e);
        res.status(500).json({ error: 'Error fetching projects' });
    }
});

app.get('/api/categories', authMiddleware, async (req, res) => {
    try {
        const categories = await prisma.category.findMany({ orderBy: { code: 'asc' } });
        res.json(categories);
    } catch (e) {
        console.error('Error fetching categories:', e);
        res.status(500).json({ error: 'Error fetching categories' });
    }
});

// Suppliers route (real DB)
app.get('/api/suppliers', authMiddleware, async (req, res) => {
    try {
        const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
        res.json(suppliers);
    } catch (e) {
        console.error('Error fetching suppliers:', e);
        res.status(500).json({ error: 'Error fetching suppliers' });
    }
});


// Protected Routes
app.use('/api/requirements', authMiddleware, requirementRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/payments', authMiddleware, paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/adjustments', adjustmentRoutes);
app.use('/api/invoices', invoiceRoutes);


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
