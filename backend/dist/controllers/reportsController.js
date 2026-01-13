"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentsCalendar = exports.getBudgetExecutionByArea = exports.getMonthlyTrend = exports.getTopSuppliers = exports.getRequirementsByStatus = exports.getBudgetExecutionByProject = exports.getExecutiveSummary = void 0;
const index_1 = require("../index");
// ==================== EXECUTIVE SUMMARY ====================
const getExecutiveSummary = async (req, res) => {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const projectId = req.query.projectId;
    const areaId = req.query.areaId;
    // Data scope from middleware
    const dataScope = req.dataScope;
    const directedAreaIds = req.directedAreaIds;
    const filterUserId = req.filterUserId;
    try {
        // Build filter
        const budgetWhere = { year };
        if (projectId)
            budgetWhere.projectId = projectId;
        if (areaId)
            budgetWhere.areaId = areaId;
        // Apply scope-based filtering
        if (dataScope === 'AREA' && directedAreaIds && directedAreaIds.length > 0) {
            budgetWhere.areaId = { in: directedAreaIds };
        }
        else if (dataScope === 'USER' && filterUserId) {
            budgetWhere.managerId = filterUserId;
        }
        // Get all budgets
        const budgets = await index_1.prisma.budget.findMany({
            where: budgetWhere,
            select: {
                amount: true,
                available: true
            }
        });
        const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
        const totalAvailable = budgets.reduce((sum, b) => sum + Number(b.available), 0);
        const totalExecuted = totalBudget - totalAvailable;
        const executionPercentage = totalBudget > 0 ? ((totalExecuted / totalBudget) * 100).toFixed(1) : '0';
        // Get requirements counts
        const reqWhere = { year };
        if (projectId)
            reqWhere.projectId = projectId;
        if (areaId)
            reqWhere.areaId = areaId;
        // Apply scope-based filtering for requirements
        if (dataScope === 'AREA' && directedAreaIds && directedAreaIds.length > 0) {
            reqWhere.areaId = { in: directedAreaIds };
        }
        else if (dataScope === 'USER' && filterUserId) {
            reqWhere.createdById = filterUserId;
        }
        const [totalRequirements, pendienteProcurement, enTramiteProcurement, entregadoProcurement, finalizadoProcurement] = await Promise.all([
            index_1.prisma.requirement.count({ where: reqWhere }),
            index_1.prisma.requirement.count({ where: { ...reqWhere, procurementStatus: 'PENDIENTE' } }),
            index_1.prisma.requirement.count({ where: { ...reqWhere, procurementStatus: 'EN_TRAMITE' } }),
            index_1.prisma.requirement.count({ where: { ...reqWhere, procurementStatus: 'ENTREGADO' } }),
            index_1.prisma.requirement.count({ where: { ...reqWhere, procurementStatus: 'FINALIZADO' } })
        ]);
        // Get invoices summary
        const invoiceWhere = {};
        if (projectId)
            invoiceWhere.requirement = { projectId };
        const invoices = await index_1.prisma.invoice.findMany({
            where: invoiceWhere,
            select: { amount: true, status: true }
        });
        const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
        const paidInvoices = invoices.filter(inv => inv.status === 'PAID').length;
        const pendingInvoices = invoices.filter(inv => inv.status === 'RECEIVED' || inv.status === 'VERIFIED').length;
        res.json({
            budget: {
                total: totalBudget,
                executed: totalExecuted,
                available: totalAvailable,
                executionPercentage: parseFloat(executionPercentage)
            },
            requirements: {
                total: totalRequirements,
                pendiente: pendienteProcurement,
                enTramite: enTramiteProcurement,
                entregado: entregadoProcurement,
                finalizado: finalizadoProcurement
            },
            invoices: {
                total: invoices.length,
                totalAmount: totalInvoiced,
                paid: paidInvoices,
                pending: pendingInvoices
            },
            year
        });
    }
    catch (error) {
        console.error('Error fetching executive summary:', error);
        res.status(500).json({ error: 'Failed to fetch executive summary', details: error.message });
    }
};
exports.getExecutiveSummary = getExecutiveSummary;
// ==================== BUDGET EXECUTION BY PROJECT ====================
const getBudgetExecutionByProject = async (req, res) => {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    try {
        const projects = await index_1.prisma.project.findMany({
            include: {
                budgets: {
                    where: { year },
                    select: { amount: true, available: true }
                }
            }
        });
        const data = projects.map(project => {
            const totalBudget = project.budgets.reduce((sum, b) => sum + Number(b.amount), 0);
            const totalAvailable = project.budgets.reduce((sum, b) => sum + Number(b.available), 0);
            const executed = totalBudget - totalAvailable;
            return {
                id: project.id,
                name: project.name,
                code: project.code,
                budgeted: totalBudget,
                executed: executed,
                available: totalAvailable,
                percentage: totalBudget > 0 ? ((executed / totalBudget) * 100).toFixed(1) : '0'
            };
        }).filter(p => p.budgeted > 0); // Only show projects with budget
        res.json(data);
    }
    catch (error) {
        console.error('Error fetching budget execution by project:', error);
        res.status(500).json({ error: 'Failed to fetch budget execution', details: error.message });
    }
};
exports.getBudgetExecutionByProject = getBudgetExecutionByProject;
// ==================== REQUIREMENTS BY STATUS ====================
const getRequirementsByStatus = async (req, res) => {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const projectId = req.query.projectId;
    // For area directors (USER role), filter by their directed areas
    const directedAreaIds = req.directedAreaIds;
    try {
        const where = { year };
        if (projectId)
            where.projectId = projectId;
        // Apply area filter for area directors
        if (directedAreaIds && directedAreaIds.length > 0) {
            where.areaId = { in: directedAreaIds };
        }
        const statuses = await index_1.prisma.requirement.groupBy({
            by: ['procurementStatus'],
            where,
            _count: { procurementStatus: true }
        });
        const data = statuses.map(s => {
            // Handle null procurementStatus as 'PENDIENTE'
            const status = s.procurementStatus || 'PENDIENTE';
            return {
                status: status,
                count: s._count.procurementStatus,
                label: getStatusLabel(status)
            };
        });
        res.json(data);
    }
    catch (error) {
        console.error('Error fetching requirements by status:', error);
        res.status(500).json({ error: 'Failed to fetch requirements by status', details: error.message });
    }
};
exports.getRequirementsByStatus = getRequirementsByStatus;
const getStatusLabel = (status) => {
    const labels = {
        'PENDIENTE': 'Pendiente',
        'EN_TRAMITE': 'En Trámite',
        'FINALIZADO': 'Finalizado',
        'ENTREGADO': 'Entregado',
        'ANULADO': 'Anulado',
        'POSTERGADO': 'Postergado',
        // Fallbacks for approval status in case they exist mixed in DB or logic changes
        'PENDING_APPROVAL': 'Por Aprobar',
        'APPROVED': 'Aprobado',
        'REJECTED': 'Rechazado'
    };
    return labels[status] || status;
};
// ==================== TOP SUPPLIERS ====================
const getTopSuppliers = async (req, res) => {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const limit = parseInt(req.query.limit) || 10;
    try {
        const suppliers = await index_1.prisma.supplier.findMany({
            include: {
                requirements: {
                    where: {
                        year,
                        status: 'APPROVED'
                    },
                    select: {
                        actualAmount: true
                    }
                }
            }
        });
        const data = suppliers.map(supplier => {
            const totalAmount = supplier.requirements.reduce((sum, req) => sum + (Number(req.actualAmount) || 0), 0);
            return {
                id: supplier.id,
                name: supplier.name,
                nit: supplier.nit,
                totalPurchases: totalAmount,
                orderCount: supplier.requirements.length
            };
        })
            .filter(s => s.totalPurchases > 0)
            .sort((a, b) => b.totalPurchases - a.totalPurchases)
            .slice(0, limit);
        res.json(data);
    }
    catch (error) {
        console.error('Error fetching top suppliers:', error);
        res.status(500).json({ error: 'Failed to fetch top suppliers', details: error.message });
    }
};
exports.getTopSuppliers = getTopSuppliers;
// ==================== MONTHLY TREND ====================
const getMonthlyTrend = async (req, res) => {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const projectId = req.query.projectId;
    // For area directors (USER role), filter by their directed areas
    const directedAreaIds = req.directedAreaIds;
    try {
        const where = {
            year,
            status: 'APPROVED'
        };
        if (projectId)
            where.projectId = projectId;
        // Apply area filter for area directors
        if (directedAreaIds && directedAreaIds.length > 0) {
            where.areaId = { in: directedAreaIds };
        }
        const requirements = await index_1.prisma.requirement.findMany({
            where,
            select: {
                createdAt: true,
                actualAmount: true
            }
        });
        // Group by month
        const monthlyData = {};
        for (let i = 0; i < 12; i++) {
            monthlyData[i] = { count: 0, amount: 0 };
        }
        requirements.forEach(req => {
            const month = new Date(req.createdAt).getMonth();
            monthlyData[month].count += 1;
            monthlyData[month].amount += Number(req.actualAmount) || 0;
        });
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const data = months.map((name, index) => ({
            month: name,
            monthIndex: index,
            count: monthlyData[index].count,
            amount: monthlyData[index].amount
        }));
        res.json(data);
    }
    catch (error) {
        console.error('Error fetching monthly trend:', error);
        res.status(500).json({ error: 'Failed to fetch monthly trend', details: error.message });
    }
};
exports.getMonthlyTrend = getMonthlyTrend;
// ==================== BUDGET EXECUTION BY AREA ====================
const getBudgetExecutionByArea = async (req, res) => {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    try {
        const areas = await index_1.prisma.area.findMany({
            include: {
                budgets: {
                    where: { year },
                    select: { amount: true, available: true }
                }
            }
        });
        const data = areas.map(area => {
            const totalBudget = area.budgets.reduce((sum, b) => sum + Number(b.amount), 0);
            const totalAvailable = area.budgets.reduce((sum, b) => sum + Number(b.available), 0);
            const executed = totalBudget - totalAvailable;
            return {
                id: area.id,
                name: area.name,
                budgeted: totalBudget,
                executed: executed,
                available: totalAvailable,
                percentage: totalBudget > 0 ? ((executed / totalBudget) * 100).toFixed(1) : '0'
            };
        }).filter(a => a.budgeted > 0);
        res.json(data);
    }
    catch (error) {
        console.error('Error fetching budget execution by area:', error);
        res.status(500).json({ error: 'Failed to fetch budget execution by area', details: error.message });
    }
};
exports.getBudgetExecutionByArea = getBudgetExecutionByArea;
// ==================== PAYMENTS CALENDAR ====================
const getPaymentsCalendar = async (req, res) => {
    try {
        const invoices = await index_1.prisma.invoice.findMany({
            where: {
                status: { in: ['RECEIVED', 'VERIFIED', 'APPROVED'] }
            },
            include: {
                requirement: {
                    select: {
                        title: true,
                        project: { select: { name: true } },
                        supplier: { select: { name: true } }
                    }
                }
            },
            orderBy: { dueDate: 'asc' }
        });
        const today = new Date();
        const data = invoices.map(inv => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            amount: Number(inv.amount),
            dueDate: inv.dueDate,
            isOverdue: inv.dueDate ? new Date(inv.dueDate) < today : false,
            daysUntilDue: inv.dueDate ? Math.ceil((new Date(inv.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null,
            requirement: inv.requirement?.title || 'N/A',
            project: inv.requirement?.project?.name || 'N/A',
            supplier: inv.requirement?.supplier?.name || 'N/A'
        }));
        res.json(data);
    }
    catch (error) {
        console.error('Error fetching payments calendar:', error);
        res.status(500).json({ error: 'Failed to fetch payments calendar', details: error.message });
    }
};
exports.getPaymentsCalendar = getPaymentsCalendar;
