import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';

// ==================== EXECUTIVE SUMMARY ====================
export const getExecutiveSummary = async (req: AuthRequest, res: Response) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const projectId = req.query.projectId as string;
    const areaId = req.query.areaId as string;

    // Data scope from middleware
    const dataScope = (req as any).dataScope as string;
    const directedAreaIds = (req as any).directedAreaIds as string[] | undefined;
    const filterUserId = (req as any).filterUserId as string | undefined;

    try {
        // Build filter
        const budgetWhere: any = { year };
        if (projectId) budgetWhere.projectId = projectId;
        if (areaId) budgetWhere.areaId = areaId;

        // Apply scope-based filtering
        if (dataScope === 'AREA' && directedAreaIds && directedAreaIds.length > 0) {
            budgetWhere.areaId = { in: directedAreaIds };
        } else if (dataScope === 'USER' && filterUserId) {
            budgetWhere.managerId = filterUserId;
        }

        // Get all budgets
        const budgets = await prisma.budget.findMany({
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
        const reqWhere: any = { year };
        if (projectId) reqWhere.projectId = projectId;
        if (areaId) reqWhere.areaId = areaId;

        // Apply scope-based filtering for requirements
        if (dataScope === 'AREA' && directedAreaIds && directedAreaIds.length > 0) {
            reqWhere.areaId = { in: directedAreaIds };
        } else if (dataScope === 'USER' && filterUserId) {
            reqWhere.createdById = filterUserId;
        }

        const [totalRequirements, pendingProcurement, inProgressProcurement, completedProcurement] = await Promise.all([
            prisma.requirement.count({ where: reqWhere }),
            prisma.requirement.count({ where: { ...reqWhere, procurementStatus: 'PENDING' } }),
            prisma.requirement.count({ where: { ...reqWhere, procurementStatus: 'IN_PROGRESS' } }),
            prisma.requirement.count({ where: { ...reqWhere, procurementStatus: 'COMPLETED' } })
        ]);

        // Get invoices summary
        const invoiceWhere: any = {};
        if (projectId) invoiceWhere.requirement = { projectId };

        const invoices = await prisma.invoice.findMany({
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
                pending: pendingProcurement,
                inProgress: inProgressProcurement,
                completed: completedProcurement
            },
            invoices: {
                total: invoices.length,
                totalAmount: totalInvoiced,
                paid: paidInvoices,
                pending: pendingInvoices
            },
            year
        });
    } catch (error: any) {
        console.error('Error fetching executive summary:', error);
        res.status(500).json({ error: 'Failed to fetch executive summary', details: error.message });
    }
};

// ==================== BUDGET EXECUTION BY PROJECT ====================
export const getBudgetExecutionByProject = async (req: AuthRequest, res: Response) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    try {
        const projects = await prisma.project.findMany({
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
    } catch (error: any) {
        console.error('Error fetching budget execution by project:', error);
        res.status(500).json({ error: 'Failed to fetch budget execution', details: error.message });
    }
};

// ==================== REQUIREMENTS BY STATUS ====================
export const getRequirementsByStatus = async (req: AuthRequest, res: Response) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const projectId = req.query.projectId as string;

    // For area directors (USER role), filter by their directed areas
    const directedAreaIds = (req as any).directedAreaIds as string[] | undefined;

    try {
        const where: any = { year };
        if (projectId) where.projectId = projectId;

        // Apply area filter for area directors
        if (directedAreaIds && directedAreaIds.length > 0) {
            where.areaId = { in: directedAreaIds };
        }

        const statuses = await prisma.requirement.groupBy({
            by: ['status'],
            where,
            _count: { status: true }
        });

        const data = statuses.map(s => ({
            status: s.status,
            count: s._count.status,
            label: getStatusLabel(s.status)
        }));

        res.json(data);
    } catch (error: any) {
        console.error('Error fetching requirements by status:', error);
        res.status(500).json({ error: 'Failed to fetch requirements by status', details: error.message });
    }
};

const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
        'PENDING_APPROVAL': 'Pendiente',
        'APPROVED': 'Aprobado',
        'REJECTED': 'Rechazado'
    };
    return labels[status] || status;
};

// ==================== TOP SUPPLIERS ====================
export const getTopSuppliers = async (req: AuthRequest, res: Response) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const limit = parseInt(req.query.limit as string) || 10;

    try {
        const suppliers = await prisma.supplier.findMany({
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
            const totalAmount = supplier.requirements.reduce(
                (sum, req) => sum + (Number(req.actualAmount) || 0),
                0
            );
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
    } catch (error: any) {
        console.error('Error fetching top suppliers:', error);
        res.status(500).json({ error: 'Failed to fetch top suppliers', details: error.message });
    }
};

// ==================== MONTHLY TREND ====================
export const getMonthlyTrend = async (req: AuthRequest, res: Response) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const projectId = req.query.projectId as string;

    // For area directors (USER role), filter by their directed areas
    const directedAreaIds = (req as any).directedAreaIds as string[] | undefined;

    try {
        const where: any = {
            year,
            status: 'APPROVED'
        };
        if (projectId) where.projectId = projectId;

        // Apply area filter for area directors
        if (directedAreaIds && directedAreaIds.length > 0) {
            where.areaId = { in: directedAreaIds };
        }

        const requirements = await prisma.requirement.findMany({
            where,
            select: {
                createdAt: true,
                actualAmount: true
            }
        });

        // Group by month
        const monthlyData: Record<number, { count: number; amount: number }> = {};
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
    } catch (error: any) {
        console.error('Error fetching monthly trend:', error);
        res.status(500).json({ error: 'Failed to fetch monthly trend', details: error.message });
    }
};

// ==================== BUDGET EXECUTION BY AREA ====================
export const getBudgetExecutionByArea = async (req: AuthRequest, res: Response) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    try {
        const areas = await prisma.area.findMany({
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
    } catch (error: any) {
        console.error('Error fetching budget execution by area:', error);
        res.status(500).json({ error: 'Failed to fetch budget execution by area', details: error.message });
    }
};

// ==================== PAYMENTS CALENDAR ====================
export const getPaymentsCalendar = async (req: AuthRequest, res: Response) => {
    try {
        const invoices = await prisma.invoice.findMany({
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
    } catch (error: any) {
        console.error('Error fetching payments calendar:', error);
        res.status(500).json({ error: 'Failed to fetch payments calendar', details: error.message });
    }
};
