"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getManagerOptions = exports.getBudgetYears = exports.approveBudget = exports.deleteBudget = exports.updateBudget = exports.createBudget = exports.getPendingBudgetsForManager = exports.getBudgetById = exports.getBudgets = void 0;
const index_1 = require("../index");
const pdfService_1 = require("../services/pdfService");
const emailService_1 = require("../services/emailService");
// ==================== GET BUDGETS (with role-based filtering) ====================
const getBudgets = async (req, res) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const { year, projectId, areaId, status } = req.query;
        // Default year to current
        const filterYear = year ? parseInt(year) : new Date().getFullYear();
        // Base where clause
        const where = { year: filterYear };
        if (projectId)
            where.projectId = projectId;
        if (areaId)
            where.areaId = areaId;
        if (status)
            where.status = status;
        // Role-based access: USER only sees budgets where they are leader or subleader
        if (userRole === 'USER') {
            where.OR = [
                { managerId: userId },
                { subLeaders: { some: { userId } } }
            ];
            // Also filter only approved budgets for regular users
            where.status = 'APPROVED';
        }
        // ADMIN, DIRECTOR and LEADER can see all budgets by default
        const budgets = await index_1.prisma.budget.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }],
            include: {
                project: { select: { id: true, name: true, code: true } },
                area: { select: { id: true, name: true } },
                category: { select: { id: true, name: true, code: true } },
                manager: { select: { id: true, name: true, email: true } },
                createdBy: { select: { id: true, name: true } },
                approvedBy: { select: { id: true, name: true } },
                subLeaders: {
                    include: { user: { select: { id: true, name: true, email: true } } }
                },
                _count: { select: { requirements: true, adjustments: true } }
            }
        });
        res.json(budgets);
    }
    catch (error) {
        console.error('Error fetching budgets:', error);
        res.status(500).json({ error: 'Error al obtener presupuestos' });
    }
};
exports.getBudgets = getBudgets;
// ==================== GET BUDGET BY ID ====================
const getBudgetById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const budget = await index_1.prisma.budget.findUnique({
            where: { id },
            include: {
                project: true,
                area: true,
                category: true,
                manager: { select: { id: true, name: true, email: true, phone: true } },
                createdBy: { select: { id: true, name: true } },
                approvedBy: { select: { id: true, name: true } },
                subLeaders: {
                    include: { user: { select: { id: true, name: true, email: true } } }
                },
                requirements: {
                    take: 20,
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, title: true, status: true, totalAmount: true, createdAt: true }
                },
                adjustments: {
                    orderBy: { requestedAt: 'desc' },
                    include: {
                        requestedBy: { select: { id: true, name: true } },
                        reviewedBy: { select: { id: true, name: true } },
                        sources: true
                    }
                }
            }
        });
        if (!budget) {
            return res.status(404).json({ error: 'Presupuesto no encontrado' });
        }
        // Access check for USER role
        if (userRole === 'USER') {
            const isManager = budget.managerId === userId;
            const isSubLeader = budget.subLeaders.some(sl => sl.userId === userId);
            if (!isManager && !isSubLeader) {
                return res.status(403).json({ error: 'No tiene acceso a este presupuesto' });
            }
        }
        res.json(budget);
    }
    catch (error) {
        console.error('Error fetching budget:', error);
        res.status(500).json({ error: 'Error al obtener presupuesto' });
    }
};
exports.getBudgetById = getBudgetById;
// ==================== GET PENDING BUDGETS FOR MANAGER ====================
const getPendingBudgetsForManager = async (req, res) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        // Build where clause based on role
        const where = {
            status: 'PENDING'
        };
        // For LEADER and USER, only show budgets where they are the manager
        if (userRole === 'LEADER' || userRole === 'USER') {
            where.managerId = userId;
        }
        // ADMIN and DIRECTOR can see all pending budgets
        const pendingBudgets = await index_1.prisma.budget.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                project: { select: { id: true, name: true, code: true } },
                area: { select: { id: true, name: true } },
                category: { select: { id: true, name: true, code: true } },
                manager: { select: { id: true, name: true, email: true } },
                createdBy: { select: { id: true, name: true, email: true } }
            }
        });
        res.json(pendingBudgets);
    }
    catch (error) {
        console.error('Error fetching pending budgets:', error);
        res.status(500).json({ error: 'Error al obtener presupuestos pendientes' });
    }
};
exports.getPendingBudgetsForManager = getPendingBudgetsForManager;
// ==================== CREATE BUDGET (DIRECTOR only) ====================
const createBudget = async (req, res) => {
    try {
        const userRole = req.user?.role;
        const userId = req.user?.id;
        // Only DIRECTOR can create budgets
        if (userRole !== 'DIRECTOR') {
            return res.status(403).json({ error: 'Solo el DIRECTOR puede crear presupuestos' });
        }
        const { title, description, code, amount, projectId, areaId, categoryId, managerId, subLeaders, year, expirationDate } = req.body;
        if (!title || !amount || !projectId || !areaId) {
            return res.status(400).json({ error: 'Título, monto, proyecto y área son requeridos' });
        }
        // Generate or validate unique code
        let budgetCode = code;
        if (budgetCode) {
            // Check if code already exists
            const existingBudget = await index_1.prisma.budget.findUnique({ where: { code: budgetCode } });
            if (existingBudget) {
                // Append a unique suffix to make it unique
                const timestamp = Date.now().toString(36).slice(-4);
                budgetCode = `${budgetCode}-${timestamp}`;
            }
        }
        else {
            // Generate automatic code: PRJ-CAT-YYYY-NNN
            const budgetCount = await index_1.prisma.budget.count({
                where: { year: year || new Date().getFullYear() }
            });
            const sequenceNum = (budgetCount + 1).toString().padStart(3, '0');
            budgetCode = `BUD-${year || new Date().getFullYear()}-${sequenceNum}`;
            // Ensure uniqueness
            const existingAuto = await index_1.prisma.budget.findUnique({ where: { code: budgetCode } });
            if (existingAuto) {
                budgetCode = `BUD-${year || new Date().getFullYear()}-${Date.now().toString(36).slice(-6)}`;
            }
        }
        // Create budget with PENDING status
        const budget = await index_1.prisma.budget.create({
            data: {
                title,
                description,
                code: budgetCode,
                amount: parseFloat(amount),
                available: parseFloat(amount),
                year: year || new Date().getFullYear(),
                expirationDate: expirationDate ? new Date(expirationDate) : null,
                status: 'PENDING',
                projectId,
                areaId,
                categoryId: categoryId || null,
                managerId: managerId || null,
                createdById: userId,
                subLeaders: subLeaders?.length > 0 ? {
                    create: subLeaders.map((id) => ({ userId: id }))
                } : undefined
            },
            include: {
                project: true,
                area: true,
                category: true,
                manager: true,
                createdBy: { select: { name: true } }
            }
        });
        // Generate PDF (optional, don't fail if error)
        try {
            const pdfUrl = await (0, pdfService_1.generateBudgetPDF)({
                code: budget.code || undefined,
                title: budget.title,
                description: budget.description || undefined,
                amount: Number(budget.amount),
                available: Number(budget.available),
                year: budget.year,
                version: budget.version,
                project: { name: budget.project.name, code: budget.project.code },
                area: { name: budget.area.name },
                category: budget.category ? { name: budget.category.name, code: budget.category.code } : undefined,
                manager: budget.manager ? { name: budget.manager.name || '' } : undefined,
                createdBy: budget.createdBy ? { name: budget.createdBy.name || '' } : undefined,
                createdAt: budget.createdAt
            });
            // Update budget with PDF URL
            await index_1.prisma.budget.update({
                where: { id: budget.id },
                data: { documentUrl: pdfUrl }
            });
        }
        catch (pdfError) {
            console.error('Error generating PDF:', pdfError);
            // Don't fail the request, PDF is optional
        }
        // Create notification for the assigned manager (ALWAYS, separate from PDF)
        if (budget.managerId) {
            try {
                await index_1.prisma.notification.create({
                    data: {
                        title: 'Nuevo Presupuesto Asignado',
                        message: `Se te ha asignado el presupuesto "${budget.title}" por ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(budget.amount))} para el proyecto ${budget.project.name}. Revísalo y apruébalo.`,
                        type: 'INFO',
                        userId: budget.managerId,
                        requirementId: null
                    }
                });
                console.log(`Notification created for manager ${budget.managerId}`);
            }
            catch (notifError) {
                console.error('Error creating notification:', notifError);
            }
        }
        // Send email to manager if assigned (separate try/catch)
        if (budget.manager?.email) {
            try {
                await (0, emailService_1.sendBudgetNotificationEmail)({
                    to: budget.manager.email,
                    type: 'BUDGET_CREATED',
                    budgetTitle: budget.title,
                    budgetCode: budget.code || undefined,
                    amount: Number(budget.amount),
                    projectName: budget.project.name
                });
            }
            catch (emailError) {
                console.error('Error sending email:', emailError);
            }
        }
        res.status(201).json(budget);
    }
    catch (error) {
        console.error('Error creating budget:', error);
        res.status(500).json({ error: 'Error al crear presupuesto' });
    }
};
exports.createBudget = createBudget;
// ==================== UPDATE BUDGET (DIRECTOR only) ====================
const updateBudget = async (req, res) => {
    try {
        const userRole = req.user?.role;
        const { id } = req.params;
        // Only DIRECTOR can update budgets
        if (userRole !== 'DIRECTOR') {
            return res.status(403).json({ error: 'Solo el DIRECTOR puede editar presupuestos' });
        }
        const { title, description, code, amount, projectId, areaId, categoryId, managerId, subLeaders } = req.body;
        // Get current budget
        const currentBudget = await index_1.prisma.budget.findUnique({ where: { id } });
        if (!currentBudget) {
            return res.status(404).json({ error: 'Presupuesto no encontrado' });
        }
        // Calculate new available if amount changed
        const amountDiff = amount ? parseFloat(amount) - parseFloat(currentBudget.amount.toString()) : 0;
        const newAvailable = parseFloat(currentBudget.available.toString()) + amountDiff;
        // Update budget
        const budget = await index_1.prisma.budget.update({
            where: { id },
            data: {
                title,
                description,
                code,
                amount: amount ? parseFloat(amount) : undefined,
                available: amount ? newAvailable : undefined,
                projectId,
                areaId,
                categoryId: categoryId || null,
                managerId: managerId || null,
                version: { increment: 1 }
            }
        });
        // Update sublíders 
        if (subLeaders) {
            // Remove existing and add new
            await index_1.prisma.budgetSubLeader.deleteMany({ where: { budgetId: id } });
            if (subLeaders.length > 0) {
                await index_1.prisma.budgetSubLeader.createMany({
                    data: subLeaders.map((userId) => ({ budgetId: id, userId }))
                });
            }
        }
        res.json(budget);
    }
    catch (error) {
        console.error('Error updating budget:', error);
        res.status(500).json({ error: 'Error al actualizar presupuesto' });
    }
};
exports.updateBudget = updateBudget;
// ==================== DELETE BUDGET (DIRECTOR only) ====================
const deleteBudget = async (req, res) => {
    try {
        const userRole = req.user?.role;
        const { id } = req.params;
        // Only DIRECTOR can delete budgets
        if (userRole !== 'DIRECTOR') {
            return res.status(403).json({ error: 'Solo el DIRECTOR puede eliminar presupuestos' });
        }
        // Check if budget has requirements
        const reqCount = await index_1.prisma.requirement.count({ where: { budgetId: id } });
        if (reqCount > 0) {
            return res.status(400).json({
                error: `No se puede eliminar, hay ${reqCount} requerimiento(s) asociado(s)`
            });
        }
        await index_1.prisma.budget.delete({ where: { id } });
        res.json({ message: 'Presupuesto eliminado exitosamente' });
    }
    catch (error) {
        console.error('Error deleting budget:', error);
        res.status(500).json({ error: 'Error al eliminar presupuesto' });
    }
};
exports.deleteBudget = deleteBudget;
// ==================== APPROVE BUDGET (Manager/Leader assigned) ====================
const approveBudget = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;
        const { approve } = req.body; // true = approve, false = reject
        const budget = await index_1.prisma.budget.findUnique({
            where: { id },
            include: {
                project: true,
                area: true,
                category: true,
                manager: true,
                createdBy: { select: { name: true, email: true } },
                approvedBy: { select: { name: true } }
            }
        });
        if (!budget) {
            return res.status(404).json({ error: 'Presupuesto no encontrado' });
        }
        // Only the assigned manager can approve/reject
        if (budget.managerId !== userId) {
            return res.status(403).json({ error: 'Solo el líder asignado puede aprobar este presupuesto' });
        }
        if (budget.status !== 'PENDING') {
            return res.status(400).json({ error: 'Este presupuesto ya fue procesado' });
        }
        // Get approving user's name
        const approver = await index_1.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const updated = await index_1.prisma.budget.update({
            where: { id },
            data: {
                status: approve ? 'APPROVED' : 'REJECTED',
                approvedAt: new Date(),
                approvedById: userId
            },
            include: {
                project: true,
                area: true,
                category: true,
                manager: true,
                createdBy: { select: { name: true } },
                approvedBy: { select: { name: true } }
            }
        });
        // Generate updated PDF with approval stamp
        try {
            const pdfUrl = await (0, pdfService_1.generateBudgetPDF)({
                code: updated.code || undefined,
                title: updated.title,
                description: updated.description || undefined,
                amount: Number(updated.amount),
                available: Number(updated.available),
                year: updated.year,
                version: updated.version,
                project: { name: updated.project.name, code: updated.project.code },
                area: { name: updated.area.name },
                category: updated.category ? { name: updated.category.name, code: updated.category.code } : undefined,
                manager: updated.manager ? { name: updated.manager.name || '' } : undefined,
                createdBy: updated.createdBy ? { name: updated.createdBy.name || '' } : undefined,
                approvedBy: updated.approvedBy ? { name: updated.approvedBy.name || '' } : undefined,
                approvedAt: updated.approvedAt || undefined,
                createdAt: updated.createdAt
            });
            await index_1.prisma.budget.update({
                where: { id },
                data: { documentUrl: pdfUrl }
            });
        }
        catch (pdfError) {
            console.error('Error generating approval PDF:', pdfError);
        }
        res.json(updated);
    }
    catch (error) {
        console.error('Error approving budget:', error);
        res.status(500).json({ error: 'Error al procesar aprobación' });
    }
};
exports.approveBudget = approveBudget;
// ==================== GET AVAILABLE YEARS ====================
const getBudgetYears = async (req, res) => {
    try {
        const years = await index_1.prisma.budget.findMany({
            select: { year: true },
            distinct: ['year'],
            orderBy: { year: 'desc' }
        });
        res.json(years.map(y => y.year));
    }
    catch (error) {
        console.error('Error fetching budget years:', error);
        res.status(500).json({ error: 'Error al obtener años' });
    }
};
exports.getBudgetYears = getBudgetYears;
// ==================== GET USERS FOR MANAGER SELECT ====================
const getManagerOptions = async (req, res) => {
    try {
        // First try to get active users
        let users = await index_1.prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true, email: true, role: true, area: { select: { name: true } } },
            orderBy: { name: 'asc' }
        });
        // If no active users, get all users as fallback
        if (users.length === 0) {
            users = await index_1.prisma.user.findMany({
                select: { id: true, name: true, email: true, role: true, area: { select: { name: true } } },
                orderBy: { name: 'asc' }
            });
        }
        console.log(`Manager options: Found ${users.length} users`);
        res.json(users);
    }
    catch (error) {
        console.error('Error fetching users for manager options:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};
exports.getManagerOptions = getManagerOptions;
