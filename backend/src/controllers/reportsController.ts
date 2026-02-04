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
            // Expanded logic: USER can see budgets where:
            // 1. They are the manager
            // 2. They are a sub-leader
            // 3. They are the project leader or sub-leader
            budgetWhere.OR = [
                { managerId: filterUserId },
                { subLeaders: { some: { userId: filterUserId } } },
                { project: { OR: [{ leaderId: filterUserId }, { subLeaderId: filterUserId }] } }
            ];
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
            // Expanded logic: USER can see requirements where:
            // 1. They created it
            // 2. They have access to the budget (manager, sub-leader, or project leader/sub-leader)
            reqWhere.OR = [
                { createdById: filterUserId },
                {
                    budget: {
                        OR: [
                            { managerId: filterUserId },
                            { subLeaders: { some: { userId: filterUserId } } },
                            { project: { OR: [{ leaderId: filterUserId }, { subLeaderId: filterUserId }] } }
                        ]
                    }
                }
            ];
        }

        const [totalRequirements, pendienteProcurement, enTramiteProcurement, entregadoProcurement, finalizadoProcurement] = await Promise.all([
            prisma.requirement.count({ where: reqWhere }),
            prisma.requirement.count({ where: { ...reqWhere, procurementStatus: 'PENDIENTE' } }),
            prisma.requirement.count({ where: { ...reqWhere, procurementStatus: 'EN_TRAMITE' } }),
            prisma.requirement.count({ where: { ...reqWhere, procurementStatus: 'ENTREGADO' } }),
            prisma.requirement.count({ where: { ...reqWhere, procurementStatus: 'FINALIZADO' } })
        ]);

        // Get invoices summary
        const invoiceWhere: any = {};
        if (projectId) invoiceWhere.requirement = { projectId };

        // Apply scope-based filtering for invoices
        if (dataScope === 'AREA' && directedAreaIds && directedAreaIds.length > 0) {
            invoiceWhere.requirement = { ...invoiceWhere.requirement, areaId: { in: directedAreaIds } };
        } else if (dataScope === 'USER' && filterUserId) {
            // Apply similar logic for invoices
            invoiceWhere.requirement = {
                ...invoiceWhere.requirement,
                OR: [
                    { createdById: filterUserId },
                    {
                        budget: {
                            OR: [
                                { managerId: filterUserId },
                                { subLeaders: { some: { userId: filterUserId } } },
                                { project: { OR: [{ leaderId: filterUserId }, { subLeaderId: filterUserId }] } }
                            ]
                        }
                    }
                ]
            };
        }

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
    } catch (error: any) {
        console.error('Error fetching executive summary:', error);
        res.status(500).json({ error: 'Failed to fetch executive summary', details: error.message });
    }
};

// ==================== BUDGET EXECUTION BY PROJECT ====================
export const getBudgetExecutionByProject = async (req: AuthRequest, res: Response) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Data scope from middleware
    const dataScope = (req as any).dataScope as string;
    const directedAreaIds = (req as any).directedAreaIds as string[] | undefined;
    const filterUserId = (req as any).filterUserId as string | undefined;

    try {
        const projectWhere: any = {};

        // Scope-based filtering: we only show projects that have budgets the user can see
        if (dataScope === 'AREA' && directedAreaIds && directedAreaIds.length > 0) {
            projectWhere.budgets = { some: { areaId: { in: directedAreaIds }, year } };
        } else if (dataScope === 'USER' && filterUserId) {
            // Show projects where user handles at least one budget OR is project leader/sub-leader
            projectWhere.OR = [
                { leaderId: filterUserId },
                { subLeaderId: filterUserId },
                {
                    budgets: {
                        some: {
                            year,
                            OR: [
                                { managerId: filterUserId },
                                { subLeaders: { some: { userId: filterUserId } } }
                            ]
                        }
                    }
                }
            ];
        }

        const projects = await prisma.project.findMany({
            where: projectWhere,
            include: {
                budgets: {
                    where: {
                        year,
                        ...(dataScope === 'AREA' && directedAreaIds ? { areaId: { in: directedAreaIds } } : {}),
                        ...(dataScope === 'USER' && filterUserId ? { managerId: filterUserId } : {})
                    },
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

    // Data scope from middleware
    const dataScope = (req as any).dataScope as string;
    const directedAreaIds = (req as any).directedAreaIds as string[] | undefined;
    const filterUserId = (req as any).filterUserId as string | undefined;

    try {
        const where: any = { year };
        if (projectId) where.projectId = projectId;

        // Apply scope-based filtering for requirements
        if (dataScope === 'AREA' && directedAreaIds && directedAreaIds.length > 0) {
            where.areaId = { in: directedAreaIds };
        } else if (dataScope === 'USER' && filterUserId) {
            where.OR = [
                { createdById: filterUserId },
                {
                    budget: {
                        OR: [
                            { managerId: filterUserId },
                            { subLeaders: { some: { userId: filterUserId } } },
                            { project: { OR: [{ leaderId: filterUserId }, { subLeaderId: filterUserId }] } }
                        ]
                    }
                }
            ];
        }

        const statuses = await prisma.requirement.groupBy({
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
    } catch (error: any) {
        console.error('Error fetching requirements by status:', error);
        res.status(500).json({ error: 'Failed to fetch requirements by status', details: error.message });
    }
};

const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
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
export const getTopSuppliers = async (req: AuthRequest, res: Response) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const limit = parseInt(req.query.limit as string) || 10;

    // Data scope from middleware
    const dataScope = (req as any).dataScope as string;
    const directedAreaIds = (req as any).directedAreaIds as string[] | undefined;
    const filterUserId = (req as any).filterUserId as string | undefined;

    try {
        const reqWhere: any = {
            year,
            status: 'APPROVED'
        };

        // Apply scope for requirements linked to suppliers
        if (dataScope === 'AREA' && directedAreaIds && directedAreaIds.length > 0) {
            reqWhere.areaId = { in: directedAreaIds };
        } else if (dataScope === 'USER' && filterUserId) {
            reqWhere.OR = [
                { createdById: filterUserId },
                {
                    budget: {
                        OR: [
                            { managerId: filterUserId },
                            { subLeaders: { some: { userId: filterUserId } } },
                            { project: { OR: [{ leaderId: filterUserId }, { subLeaderId: filterUserId }] } }
                        ]
                    }
                }
            ];
        }

        const suppliers = await prisma.supplier.findMany({
            include: {
                requirements: {
                    where: reqWhere,
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

    // Data scope from middleware
    const dataScope = (req as any).dataScope as string;
    const directedAreaIds = (req as any).directedAreaIds as string[] | undefined;
    const filterUserId = (req as any).filterUserId as string | undefined;

    try {
        const where: any = {
            year,
            status: 'APPROVED'
        };
        if (projectId) where.projectId = projectId;

        // Apply scope-based filtering for requirements
        if (dataScope === 'AREA' && directedAreaIds && directedAreaIds.length > 0) {
            where.areaId = { in: directedAreaIds };
        } else if (dataScope === 'USER' && filterUserId) {
            where.OR = [
                { createdById: filterUserId },
                {
                    budget: {
                        OR: [
                            { managerId: filterUserId },
                            { subLeaders: { some: { userId: filterUserId } } },
                            { project: { OR: [{ leaderId: filterUserId }, { subLeaderId: filterUserId }] } }
                        ]
                    }
                }
            ];
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

    // Data scope from middleware
    const dataScope = (req as any).dataScope as string;
    const directedAreaIds = (req as any).directedAreaIds as string[] | undefined;
    const filterUserId = (req as any).filterUserId as string | undefined;

    try {
        const areaWhere: any = {};

        // Scope-based filtering for areas
        if (dataScope === 'AREA' && directedAreaIds && directedAreaIds.length > 0) {
            areaWhere.id = { in: directedAreaIds };
        } else if (dataScope === 'USER' && filterUserId) {
            // If they are area director, AREA scope handle it. If just USER, filter by budgets they manage or sub-lead or are project leaders
            areaWhere.budgets = {
                some: {
                    year,
                    OR: [
                        { managerId: filterUserId },
                        { subLeaders: { some: { userId: filterUserId } } },
                        { project: { OR: [{ leaderId: filterUserId }, { subLeaderId: filterUserId }] } }
                    ]
                }
            };
        }

        const areas = await prisma.area.findMany({
            where: areaWhere,
            include: {
                budgets: {
                    where: {
                        year,
                        ...(dataScope === 'USER' && filterUserId ? { managerId: filterUserId } : {})
                    },
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
    // Data scope from middleware
    const dataScope = (req as any).dataScope as string;
    const directedAreaIds = (req as any).directedAreaIds as string[] | undefined;
    const filterUserId = (req as any).filterUserId as string | undefined;

    try {
        const invoiceWhere: any = {
            status: { in: ['RECEIVED', 'VERIFIED', 'APPROVED'] }
        };

        // Apply scope-based filtering for invoices in calendar
        if (dataScope === 'AREA' && directedAreaIds && directedAreaIds.length > 0) {
            invoiceWhere.requirement = { areaId: { in: directedAreaIds } };
        } else if (dataScope === 'USER' && filterUserId) {
            invoiceWhere.requirement = {
                OR: [
                    { createdById: filterUserId },
                    {
                        budget: {
                            OR: [
                                { managerId: filterUserId },
                                { subLeaders: { some: { userId: filterUserId } } },
                                { project: { OR: [{ leaderId: filterUserId }, { subLeaderId: filterUserId }] } }
                            ]
                        }
                    }
                ]
            };
        }

        const invoices = await prisma.invoice.findMany({
            where: invoiceWhere,
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
