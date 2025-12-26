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

dotenv.config();

const app = express();
const demoNotifications: any[] = [];
const demoRequirements: any[] = [
    {
        id: 'req-1',
        title: 'Insumos de Oficina - Área de Curaduría',
        description: 'Papelería, carpetas y marcadores para el archivo.',
        totalAmount: 0,
        actualAmount: 1500000,
        status: 'APPROVED',
        procurementStatus: 'ENTREGADO',
        createdById: 'mock-admin-id',
        createdAt: new Date(),
        project: { name: 'Exposición Botero' },
        area: { name: 'Curaduría' },
        supplier: { id: 'supp-1', name: 'Papelería El Cid' },
        budgetId: 'bud-1',
        attachments: [],
        purchaseOrderNumber: 'OC-101',
        invoiceNumber: 'FAC-505',
        logs: [{ id: 'log-1', action: 'CREATED', details: 'Requirement created by admin@museodeantioquia.co', createdAt: new Date() }]
    },
    {
        id: 'req-2',
        title: 'Equipos de Computo - IT',
        description: '2 Laptops para nuevos ingresos.',
        totalAmount: 0,
        actualAmount: 9000000,
        status: 'APPROVED',
        procurementStatus: 'FINALIZADO',
        createdById: 'mock-admin-id',
        createdAt: new Date(),
        project: { name: 'Modernización IT' },
        area: { name: 'Tecnología' },
        supplier: { id: 'supp-2', name: 'CompuCenter' },
        budgetId: 'bud-2',
        attachments: [],
        purchaseOrderNumber: 'OC-202',
        invoiceNumber: 'FAC-606',
        logs: [{ id: 'log-2', action: 'CREATED', details: 'Requirement created by admin@museodeantioquia.co', createdAt: new Date() }]
    }
];

const demoCategories = [
    { id: 'cat-1', code: '1.1', name: 'Refrigerios' },
    { id: 'cat-2', code: '1.2', name: 'Transporte' },
    { id: 'cat-3', code: '2.1', name: 'Insumos de Oficina' },
    { id: 'cat-4', code: '2.2', name: 'Equipos de Computo' },
    { id: 'cat-5', code: '3.1', name: 'Honorarios' }
];

const demoProjects = [
    { id: 'proj-1', name: 'Exposición Botero' },
    { id: 'proj-2', name: 'Modernización IT' },
    { id: 'proj-3', name: 'Proyecto Educación' }
];

const demoAreas = [
    { id: 'area-1', name: 'Curaduría' },
    { id: 'area-2', name: 'Tecnología' },
    { id: 'area-3', name: 'Administración' },
    { id: 'area-4', name: 'Educación' },
    { id: 'area-5', name: 'Comunicaciones' }
];

const demoSuppliers = [
    { id: 'supp-1', name: 'Papelería El Cid', taxId: '900123456-1', contactEmail: 'ventas@elcid.com', contactPhone: '604 1234567' },
    { id: 'supp-2', name: 'CompuCenter', taxId: '890987654-2', contactEmail: 'soporte@compucenter.co', contactPhone: '604 7654321' },
    { id: 'supp-3', name: 'Aseo y Punto', taxId: '800456123-5', contactEmail: 'info@aseoypunto.com', contactPhone: '300 1234567' }
];

const demoBudgets = [
    {
        id: 'bud-1',
        amount: 150000000,
        available: 37500000,
        projectId: 'proj-1',
        project: { id: 'proj-1', name: 'Exposición Botero' },
        areaId: 'area-1',
        area: { id: 'area-1', name: 'Curaduría' },
        categoryId: 'cat-1',
        category: { id: 'cat-1', code: '1.1', name: 'Refrigerios' },
        managerId: 'mock-admin-id',
        manager: { id: 'mock-admin-id', name: 'Dairon Moreno (Admin)', email: 'daironmoreno24@gmail.com' },
        executionDate: '2025-12-31'
    },
    {
        id: 'bud-2',
        amount: 80000000,
        available: 15000000,
        projectId: 'proj-2',
        project: { id: 'proj-2', name: 'Modernización IT' },
        areaId: 'area-2',
        area: { id: 'area-2', name: 'Tecnología' },
        categoryId: 'cat-4',
        category: { id: 'cat-4', code: '2.2', name: 'Equipos de Computo' },
        managerId: 'mock-user-id',
        manager: { id: 'mock-user-id', name: 'Usuario de Prueba', email: 'testuser@museodeantioquia.co' },
        executionDate: '2025-12-31'
    }
];

const prismaMock: any = {
    user: {
        findUnique: async (args: any) => {
            if (args.where.email === 'daironmoreno24@gmail.com' || args.where.email === 'admin@museodeantioquia.co') {
                return { id: 'mock-admin-id', email: args.where.email, role: 'ADMIN', name: 'Dairon Moreno (Admin)', areaId: 'area-3' };
            }
            if (args.where.email === 'testuser@museodeantioquia.co') {
                return { id: 'mock-user-id', email: 'testuser@museodeantioquia.co', role: 'USER', name: 'Usuario de Prueba', areaId: 'area-1' };
            }
            return null;
        },
        findMany: async (args?: any) => {
            const users = [
                { id: 'mock-admin-id', email: 'daironmoreno24@gmail.com', role: 'ADMIN', name: 'Dairon Moreno' },
                { id: 'mock-user-id', email: 'testuser@museodeantioquia.co', role: 'USER', name: 'Usuario de Prueba' },
                { id: 'mock-leader-id', email: 'leader@museodeantioquia.co', role: 'LEADER', name: 'Líder Curaduría' },
                { id: 'mock-admin-2', email: 'admin@museodeantioquia.co', role: 'ADMIN', name: 'Admin Demo' }
            ];
            if (args?.where?.role) {
                if (typeof args.where.role === 'string') {
                    return users.filter(u => u.role === args.where.role);
                }
                if (args.where.role.in) {
                    return users.filter(u => args.where.role.in.includes(u.role));
                }
            }
            return users;
        },
        create: async () => ({})
    },
    requirement: {
        findMany: async (args?: any) => {
            let filtered = [...demoRequirements];
            if (args?.where?.createdById) {
                filtered = filtered.filter(r => r.createdById === args.where.createdById);
            }
            if (args?.where?.budgetId) {
                filtered = filtered.filter(r => r.budgetId === args.where.budgetId);
            }
            if (args?.where?.supplierId) {
                filtered = filtered.filter(r => r.supplierId === args.where.supplierId);
            }
            return filtered.map(r => ({
                ...r,
                project: r.project || { name: 'Demo Project' },
                area: r.area || { name: 'Demo Area' },
                supplier: r.supplier || { name: 'Demo Supplier' }
            }));
        },
        findUnique: async (args: any) => {
            const req = demoRequirements.find(r => r.id === args.where.id);
            if (req) return {
                ...req,
                project: req.project || { name: 'Demo Project' },
                area: req.area || { name: 'Demo Area' },
                supplier: req.supplier || { name: 'Demo Supplier' },
                createdBy: req.createdBy || { name: 'Admin Demo', email: 'admin@demo.co' }
            };
            return null;
        },
        create: async (args: any) => {
            const newReq = {
                id: `req-${Date.now()}`,
                ...args.data,
                status: args.data.status || 'PENDING_COORDINATION',
                createdAt: new Date(),
                project: demoProjects.find(p => p.id === args.data.projectId) || { name: 'Demo Project' },
                area: demoAreas.find(a => a.id === args.data.areaId) || { name: 'Demo Area' },
                supplier: args.data.supplierId ? demoSuppliers.find(s => s.id === args.data.supplierId) : null,
                manualSupplierName: args.data.manualSupplierName || null,
                attachments: [],
                purchaseOrderNumber: null,
                invoiceNumber: null,
                logs: []
            };
            demoRequirements.push(newReq);
            return newReq;
        },
        update: async (args: any) => {
            const index = demoRequirements.findIndex(r => r.id === args.where.id);
            if (index !== -1) {
                demoRequirements[index] = { ...demoRequirements[index], ...args.data };
                return demoRequirements[index];
            }
            return null;
        }
    },
    attachment: { create: async () => ({}) },
    notification: {
        findMany: async (args: any) => {
            const userId = args?.where?.userId;
            return demoNotifications.filter(n => n.userId === userId).sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
        },
        create: async (args: any) => {
            const newNotif = { id: `notif-${Date.now()}`, ...args.data, isRead: false, createdAt: new Date() };
            demoNotifications.push(newNotif);
            return newNotif;
        },
        update: async (args: any) => {
            const index = demoNotifications.findIndex(n => n.id === args.where.id);
            if (index !== -1) {
                demoNotifications[index] = { ...demoNotifications[index], ...args.data };
                return demoNotifications[index];
            }
            return null;
        },
        updateMany: async (args: any) => {
            const userId = args?.where?.userId;
            demoNotifications.forEach(n => {
                if (n.userId === userId) n.isRead = true;
            });
            return { count: demoNotifications.filter(n => n.userId === userId).length };
        }
    },
    historyLog: {
        create: async (args: any) => {
            const req = demoRequirements.find(r => r.id === args.data.requirementId);
            if (req) {
                if (!req.logs) req.logs = [];
                req.logs.push({ id: `log-${Date.now()}`, ...args.data, createdAt: new Date() });
            }
            return args.data;
        }
    },
    project: { findMany: async () => [{ id: 'proj-1', name: 'Exposición Botero' }, { id: 'proj-2', name: 'Modernización IT' }, { id: 'proj-3', name: 'Proyecto Educación' }] },
    area: {
        findMany: async () => [
            { id: 'area-1', name: 'Curaduría' },
            { id: 'area-2', name: 'Tecnología' },
            { id: 'area-3', name: 'Administración' },
            { id: 'area-4', name: 'Educación' },
            { id: 'area-5', name: 'Comunicaciones' }
        ]
    },
    supplier: {
        findMany: async (args?: any) => {
            return demoSuppliers;
        }
    },
    budget: {
        findMany: async (args: any) => {
            let filtered = [...demoBudgets];
            if (args?.where?.areaId) {
                filtered = filtered.filter(b => b.areaId === args.where.areaId);
            }
            return filtered;
        },
        findUnique: async (args: any) => {
            return demoBudgets.find(b => b.id === args.where.id) || null;
        },
        update: async (args: any) => {
            const index = demoBudgets.findIndex(b => b.id === args.where.id);
            if (index !== -1) {
                const data = args.data;
                if (data.available && data.available.decrement) {
                    demoBudgets[index].available -= data.available.decrement;
                } else if (data.available && typeof data.available === 'number') {
                    demoBudgets[index].available = data.available;
                }
                demoBudgets[index] = { ...demoBudgets[index], ...data };
                return demoBudgets[index];
            }
            return null;
        }
    }
};

let prisma = prismaMock;

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
    try {
        const { PrismaClient } = require('@prisma/client');
        prisma = new PrismaClient();
    } catch (e) {
        console.error('Prisma initialization failed. Using placeholder.');
    }
} else {
    console.log('--- DEMO MODE: Database disabled ---');
}

const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Public Routes (No auth needed)
app.use('/api/auth', authRoutes);

// Catalog Routes (Public)
app.get('/api/areas', async (req, res) => {
    try {
        const areas = await prisma.area.findMany();
        res.json(areas.length > 0 ? areas : [
            { id: 'area-1', name: 'Curaduría' },
            { id: 'area-2', name: 'Tecnología' },
            { id: 'area-3', name: 'Administración' }
        ]);
    } catch (e) {
        res.json([
            { id: 'area-1', name: 'Curaduría' },
            { id: 'area-2', name: 'Tecnología' },
            { id: 'area-3', name: 'Administración' }
        ]);
    }
});

app.get('/api/projects', async (req, res) => {
    try {
        const projects = await prisma.project.findMany();
        res.json(projects.length > 0 ? projects : [
            { id: 'proj-1', name: 'Exposición Botero' },
            { id: 'proj-2', name: 'Modernización IT' }
        ]);
    } catch (e) {
        res.json([
            { id: 'proj-1', name: 'Exposición Botero' },
            { id: 'proj-2', name: 'Modernización IT' }
        ]);
    }
});

// Protected Routes
app.use('/api/requirements', authMiddleware, requirementRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);

// Additional Public Routes
app.get('/api/categories', (req, res) => {
    res.json(demoCategories);
});

app.get('/api/suppliers', (req, res) => {
    res.json(demoSuppliers);
});

// Budgets CRUD
app.get('/api/budgets', authMiddleware, (req, res) => {
    res.json(demoBudgets);
});

app.post('/api/budgets', authMiddleware, roleCheck(['ADMIN', 'DIRECTOR']), (req, res) => {
    const { amount, projectId, areaId, managerId, categoryId, executionDate } = req.body;

    // Find relations
    const project = demoProjects.find(p => p.id === projectId);
    const area = demoAreas.find(a => a.id === areaId);
    // Mock user lookup 
    const manager = { id: managerId, name: 'Assigned Manager', email: 'manager@example.com' };
    const category = demoCategories.find(c => c.id === categoryId);

    const newBudget = {
        id: `bud-${Date.now()}`,
        amount,
        available: amount,
        projectId,
        project,
        areaId,
        area,
        managerId,
        manager,
        categoryId,
        category,
        executionDate // Add execution date
    };
    // @ts-ignore
    demoBudgets.push(newBudget);
    res.json(newBudget);
});

app.put('/api/budgets/:id', authMiddleware, roleCheck(['ADMIN', 'DIRECTOR']), (req, res) => {
    const { id } = req.params;
    const { amount, projectId, areaId, managerId, categoryId, executionDate } = req.body;

    const index = demoBudgets.findIndex(b => b.id === id);
    if (index !== -1) {
        const project = demoProjects.find(p => p.id === projectId);
        const area = demoAreas.find(a => a.id === areaId);
        // Mock user lookup
        const manager = { id: managerId, name: 'Updated Manager', email: 'manager@example.com' };
        const category = demoCategories.find(c => c.id === categoryId);

        demoBudgets[index] = {
            ...demoBudgets[index],
            amount,
            projectId,
            project: project || demoBudgets[index].project,
            areaId,
            area: area || demoBudgets[index].area,
            managerId,
            manager: manager || demoBudgets[index].manager,
            categoryId,
            category: category || (demoBudgets[index] as any).category,
            executionDate: executionDate || (demoBudgets[index] as any).executionDate
        };
        res.json(demoBudgets[index]);
    } else {
        res.status(404).json({ error: 'Presupuesto no encontrado' });
    }
});

app.delete('/api/budgets/:id', authMiddleware, roleCheck(['ADMIN', 'DIRECTOR']), (req, res) => {
    const { id } = req.params;
    const index = demoBudgets.findIndex(b => b.id === id);
    if (index !== -1) {
        const deleted = demoBudgets.splice(index, 1)[0];
        res.json(deleted);
    } else {
        res.status(404).json({ error: 'Presupuesto no encontrado' });
    }
});

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
