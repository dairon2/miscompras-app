"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const auth_1 = require("./middlewares/auth");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const requirementRoutes_1 = __importDefault(require("./routes/requirementRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const reportRoutes_1 = __importDefault(require("./routes/reportRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const budgetRoutes_1 = __importDefault(require("./routes/budgetRoutes"));
const adjustmentRoutes_1 = __importDefault(require("./routes/adjustmentRoutes"));
const invoiceRoutes_1 = __importDefault(require("./routes/invoiceRoutes"));
dotenv_1.default.config();
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
const app = (0, express_1.default)();
// Import demo data from separate file (only used when DATABASE_URL is not configured)
const demoData_1 = require("./demoData");
// Database Initialization
let prisma;
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
    console.log('--- PRODUCTION MODE: Connecting to Database ---');
    exports.prisma = prisma = new client_1.PrismaClient({
        log: ['error', 'warn'],
    });
    // Test connection
    prisma.$connect()
        .then(() => console.log('Successfully connected to Azure PostgreSQL'))
        .catch((e) => {
        console.error('DATABASE CONNECTION ERROR:', e.message);
        console.error('Check your DATABASE_URL and Azure Firewall rules.');
    });
}
else {
    console.log('--- DEMO MODE: Database disabled (using prismaMock) ---');
    exports.prisma = prisma = demoData_1.prismaMock;
}
const PORT = process.env.PORT || 4000;
// Middlewares
const allowedOrigins = [
    process.env.CORS_ORIGIN,
    'https://miscompras-front-prod-g4akhtbsagfpefbk.canadacentral-01.azurewebsites.net',
    'https://miscompras-api-prod.azurewebsites.net',
    'http://localhost:3000'
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)());
app.use(express_1.default.json());
app.use('/uploads', express_1.default.static('uploads'));
app.use('/api/uploads', express_1.default.static('uploads'));
// Public Routes (No auth needed)
app.use('/api/auth', authRoutes_1.default);
// Catalog Routes (Public for registration) - Real DB queries
app.get('/api/areas', async (req, res) => {
    try {
        const areas = await prisma.area.findMany({ orderBy: { name: 'asc' } });
        res.json(areas);
    }
    catch (e) {
        console.error('Error fetching areas:', e);
        res.status(500).json({ error: 'Error fetching areas' });
    }
});
app.get('/api/projects', auth_1.authMiddleware, async (req, res) => {
    try {
        const projects = await prisma.project.findMany({ orderBy: { name: 'asc' } });
        res.json(projects);
    }
    catch (e) {
        console.error('Error fetching projects:', e);
        res.status(500).json({ error: 'Error fetching projects' });
    }
});
app.get('/api/categories', auth_1.authMiddleware, async (req, res) => {
    try {
        const categories = await prisma.category.findMany({ orderBy: { code: 'asc' } });
        res.json(categories);
    }
    catch (e) {
        console.error('Error fetching categories:', e);
        res.status(500).json({ error: 'Error fetching categories' });
    }
});
// Suppliers route (real DB)
app.get('/api/suppliers', auth_1.authMiddleware, async (req, res) => {
    try {
        const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
        res.json(suppliers);
    }
    catch (e) {
        console.error('Error fetching suppliers:', e);
        res.status(500).json({ error: 'Error fetching suppliers' });
    }
});
// Protected Routes
app.use('/api/requirements', auth_1.authMiddleware, requirementRoutes_1.default);
app.use('/api/notifications', auth_1.authMiddleware, notificationRoutes_1.default);
app.use('/api/reports', auth_1.authMiddleware, reportRoutes_1.default);
app.use('/api/payments', auth_1.authMiddleware, paymentRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/budgets', budgetRoutes_1.default);
app.use('/api/adjustments', adjustmentRoutes_1.default);
app.use('/api/invoices', invoiceRoutes_1.default);
// NOTE: Budget CRUD is handled by budgetRoutes mounted at /api/budgets
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'API Miscompras en ejecución' });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Error Interno del Servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
