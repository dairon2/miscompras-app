"use strict";
/**
 * Demo Data for Development Mode
 * This file contains mock data used when DATABASE_URL is not configured or contains "mock"
 * In production, this is only used as a fallback if the real database is unavailable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.prismaMock = exports.demoBudgets = exports.demoSuppliers = exports.demoAreas = exports.demoProjects = exports.demoCategories = exports.demoRequirements = exports.demoNotifications = void 0;
// Mutable arrays for demo state
exports.demoNotifications = [];
exports.demoRequirements = [
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
exports.demoCategories = [
    { id: 'cat-1', code: '1.1', name: 'Refrigerios' },
    { id: 'cat-2', code: '1.2', name: 'Transporte' },
    { id: 'cat-3', code: '2.1', name: 'Insumos de Oficina' },
    { id: 'cat-4', code: '2.2', name: 'Equipos de Computo' },
    { id: 'cat-5', code: '3.1', name: 'Honorarios' }
];
exports.demoProjects = [
    { id: 'proj-1', name: 'Exposición Botero' },
    { id: 'proj-2', name: 'Modernización IT' },
    { id: 'proj-3', name: 'Proyecto Educación' }
];
exports.demoAreas = [
    { id: 'area-1', name: 'Curaduría' },
    { id: 'area-2', name: 'Tecnología' },
    { id: 'area-3', name: 'Administración' },
    { id: 'area-4', name: 'Educación' },
    { id: 'area-5', name: 'Comunicaciones' }
];
exports.demoSuppliers = [
    { id: 'supp-1', name: 'Papelería El Cid', taxId: '900123456-1', contactEmail: 'ventas@elcid.com', contactPhone: '604 1234567' },
    { id: 'supp-2', name: 'CompuCenter', taxId: '890987654-2', contactEmail: 'soporte@compucenter.co', contactPhone: '604 7654321' },
    { id: 'supp-3', name: 'Aseo y Punto', taxId: '800456123-5', contactEmail: 'info@aseoypunto.com', contactPhone: '300 1234567' }
];
exports.demoBudgets = [
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
/**
 * Prisma Mock - Used when DATABASE_URL is not configured
 */
exports.prismaMock = {
    user: {
        findUnique: async (args) => {
            if (args.where.email === 'daironmoreno24@gmail.com' || args.where.email === 'admin@museodeantioquia.co') {
                return { id: 'mock-admin-id', email: args.where.email, role: 'ADMIN', name: 'Dairon Moreno (Admin)', areaId: 'area-3' };
            }
            if (args.where.email === 'testuser@museodeantioquia.co') {
                return { id: 'mock-user-id', email: 'testuser@museodeantioquia.co', role: 'USER', name: 'Usuario de Prueba', areaId: 'area-1' };
            }
            return null;
        },
        findMany: async (args) => {
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
        findMany: async (args) => {
            let filtered = [...exports.demoRequirements];
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
        findUnique: async (args) => {
            const req = exports.demoRequirements.find(r => r.id === args.where.id);
            if (req)
                return {
                    ...req,
                    project: req.project || { name: 'Demo Project' },
                    area: req.area || { name: 'Demo Area' },
                    supplier: req.supplier || { name: 'Demo Supplier' },
                    createdBy: req.createdBy || { name: 'Admin Demo', email: 'admin@demo.co' }
                };
            return null;
        },
        create: async (args) => {
            const newReq = {
                id: `req-${Date.now()}`,
                ...args.data,
                status: args.data.status || 'PENDING_COORDINATION',
                createdAt: new Date(),
                project: exports.demoProjects.find(p => p.id === args.data.projectId) || { name: 'Demo Project' },
                area: exports.demoAreas.find(a => a.id === args.data.areaId) || { name: 'Demo Area' },
                supplier: args.data.supplierId ? exports.demoSuppliers.find(s => s.id === args.data.supplierId) : null,
                manualSupplierName: args.data.manualSupplierName || null,
                attachments: [],
                purchaseOrderNumber: null,
                invoiceNumber: null,
                logs: []
            };
            exports.demoRequirements.push(newReq);
            return newReq;
        },
        update: async (args) => {
            const index = exports.demoRequirements.findIndex(r => r.id === args.where.id);
            if (index !== -1) {
                exports.demoRequirements[index] = { ...exports.demoRequirements[index], ...args.data };
                return exports.demoRequirements[index];
            }
            return null;
        }
    },
    attachment: { create: async () => ({}) },
    notification: {
        findMany: async (args) => {
            const userId = args?.where?.userId;
            return exports.demoNotifications.filter(n => n.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        },
        create: async (args) => {
            const newNotif = { id: `notif-${Date.now()}`, ...args.data, isRead: false, createdAt: new Date() };
            exports.demoNotifications.push(newNotif);
            return newNotif;
        },
        update: async (args) => {
            const index = exports.demoNotifications.findIndex(n => n.id === args.where.id);
            if (index !== -1) {
                exports.demoNotifications[index] = { ...exports.demoNotifications[index], ...args.data };
                return exports.demoNotifications[index];
            }
            return null;
        },
        updateMany: async (args) => {
            const userId = args?.where?.userId;
            exports.demoNotifications.forEach(n => {
                if (n.userId === userId)
                    n.isRead = true;
            });
            return { count: exports.demoNotifications.filter(n => n.userId === userId).length };
        }
    },
    historyLog: {
        create: async (args) => {
            const req = exports.demoRequirements.find(r => r.id === args.data.requirementId);
            if (req) {
                if (!req.logs)
                    req.logs = [];
                req.logs.push({ id: `log-${Date.now()}`, ...args.data, createdAt: new Date() });
            }
            return args.data;
        }
    },
    project: { findMany: async () => exports.demoProjects },
    area: { findMany: async () => exports.demoAreas },
    category: { findMany: async () => exports.demoCategories },
    supplier: { findMany: async () => exports.demoSuppliers },
    budget: {
        findMany: async (args) => {
            let filtered = [...exports.demoBudgets];
            if (args?.where?.areaId) {
                filtered = filtered.filter(b => b.areaId === args.where.areaId);
            }
            if (args?.distinct?.includes('year')) {
                const years = Array.from(new Set(exports.demoBudgets.map(b => b.executionDate ? new Date(b.executionDate).getFullYear() : 2025)));
                return years.map(y => ({ year: y }));
            }
            return filtered;
        },
        findUnique: async (args) => {
            return exports.demoBudgets.find(b => b.id === args.where.id) || null;
        },
        update: async (args) => {
            const index = exports.demoBudgets.findIndex(b => b.id === args.where.id);
            if (index !== -1) {
                const data = args.data;
                if (data.available && data.available.decrement) {
                    exports.demoBudgets[index].available -= data.available.decrement;
                }
                else if (data.available && typeof data.available === 'number') {
                    exports.demoBudgets[index].available = data.available;
                }
                exports.demoBudgets[index] = { ...exports.demoBudgets[index], ...data };
                return exports.demoBudgets[index];
            }
            return null;
        }
    },
    systemConfig: {
        findFirst: async () => ({ id: 'main', activeYear: 2025, appName: 'MisCompras', isRegistrationEnabled: true, maintenanceMode: false }),
        create: async (args) => ({ id: 'main', ...args.data }),
        update: async (args) => ({ id: 'main', ...args.data })
    }
};
