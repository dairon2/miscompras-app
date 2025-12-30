import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';
import { generateAdjustmentPDF } from '../services/pdfService';
import { sendAdjustmentNotificationEmail, notifyDirectors } from '../services/emailService';

// ==================== CREATE ADJUSTMENT REQUEST ====================

export const createAdjustment = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const {
            budgetId,
            type,  // 'INCREASE' or 'TRANSFER'
            requestedAmount,
            reason,
            sources  // For TRANSFER: [{ budgetId, amount }]
        } = req.body;

        if (!budgetId || !type || !requestedAmount || !reason) {
            return res.status(400).json({
                error: 'Presupuesto destino, tipo, monto y motivo son requeridos'
            });
        }

        // Validate budget exists
        const targetBudget = await prisma.budget.findUnique({
            where: { id: budgetId },
            include: { project: true, category: true }
        });
        if (!targetBudget) {
            return res.status(404).json({ error: 'Presupuesto destino no encontrado' });
        }

        // For TRANSFER, validate sources
        if (type === 'TRANSFER') {
            if (!sources || sources.length === 0) {
                return res.status(400).json({
                    error: 'Para movimientos, debe especificar los presupuestos de origen'
                });
            }

            // Validate sum of sources equals requested amount
            const sourceTotal = sources.reduce((sum: number, s: any) => sum + parseFloat(s.amount), 0);
            if (Math.abs(sourceTotal - parseFloat(requestedAmount)) > 0.01) {
                return res.status(400).json({
                    error: `La suma de los descuentos ($${sourceTotal.toLocaleString()}) debe ser igual al monto solicitado ($${parseFloat(requestedAmount).toLocaleString()})`
                });
            }

            // Validate each source budget has sufficient available
            for (const source of sources) {
                const sourceBudget = await prisma.budget.findUnique({
                    where: { id: source.budgetId }
                });
                if (!sourceBudget) {
                    return res.status(404).json({
                        error: `Presupuesto origen (${source.budgetId}) no encontrado`
                    });
                }
                if (parseFloat(sourceBudget.available.toString()) < parseFloat(source.amount)) {
                    return res.status(400).json({
                        error: `El presupuesto ${sourceBudget.title} no tiene suficiente disponible ($${sourceBudget.available} < $${source.amount})`
                    });
                }
            }
        }

        // Generate code
        const count = await prisma.budgetAdjustment.count();
        const code = `ADJ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

        // Create adjustment
        const adjustment = await prisma.budgetAdjustment.create({
            data: {
                code,
                type,
                budgetId,
                requestedAmount: parseFloat(requestedAmount),
                reason,
                requestedById: userId!,
                status: 'PENDING',
                sources: type === 'TRANSFER' ? {
                    create: sources.map((s: any) => ({
                        budgetId: s.budgetId,
                        amount: parseFloat(s.amount)
                    }))
                } : undefined
            },
            include: {
                budget: { include: { project: true, area: true, category: true } },
                requestedBy: { select: { id: true, name: true, email: true } },
                sources: {
                    include: { budget: { select: { id: true, title: true, available: true, category: true } } }
                }
            }
        });

        // Generate PDF
        try {
            const pdfUrl = await generateAdjustmentPDF({
                code: adjustment.code || undefined,
                type: adjustment.type as 'INCREASE' | 'TRANSFER',
                requestedAmount: Number(adjustment.requestedAmount),
                reason: adjustment.reason,
                status: adjustment.status,
                budget: {
                    title: adjustment.budget.title,
                    code: adjustment.budget.code || undefined,
                    project: { name: adjustment.budget.project.name },
                    area: { name: adjustment.budget.area.name },
                    category: adjustment.budget.category ? { name: adjustment.budget.category.name, code: adjustment.budget.category.code } : undefined
                },
                sources: adjustment.sources?.map(s => ({
                    budget: { title: s.budget.title, category: s.budget.category ? { name: s.budget.category.name, code: s.budget.category.code } : undefined },
                    amount: Number(s.amount)
                })),
                requestedBy: { name: adjustment.requestedBy.name || '' },
                requestedAt: adjustment.requestedAt
            });

            await prisma.budgetAdjustment.update({
                where: { id: adjustment.id },
                data: { documentUrl: pdfUrl }
            });

            // Notify directors
            const typeLabel = type === 'INCREASE' ? 'Aumento' : 'Movimiento';
            await notifyDirectors(
                `Nueva Solicitud de ${typeLabel}: ${code}`,
                `<p>Se ha creado una nueva solicitud de ajuste presupuestal:</p>
                <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Código:</strong> ${code}</p>
                    <p><strong>Tipo:</strong> ${typeLabel}</p>
                    <p><strong>Presupuesto:</strong> ${targetBudget.title}</p>
                    <p><strong>Monto:</strong> $${Number(requestedAmount).toLocaleString()}</p>
                    <p><strong>Solicitado por:</strong> ${adjustment.requestedBy.name}</p>
                </div>`
            );
        } catch (pdfError) {
            console.error('Error generating PDF or sending email:', pdfError);
        }

        res.status(201).json(adjustment);
    } catch (error: any) {
        console.error('Error creating adjustment:', error);
        res.status(500).json({ error: 'Error al crear solicitud' });
    }
};

// ==================== GET MY ADJUSTMENTS ====================

export const getMyAdjustments = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        const adjustments = await prisma.budgetAdjustment.findMany({
            where: { requestedById: userId },
            orderBy: { requestedAt: 'desc' },
            include: {
                budget: {
                    include: {
                        project: { select: { name: true } },
                        category: { select: { name: true, code: true } }
                    }
                },
                requestedBy: { select: { name: true } },
                reviewedBy: { select: { name: true } },
                sources: {
                    include: { budget: { select: { title: true } } }
                }
            }
        });

        res.json(adjustments);
    } catch (error: any) {
        console.error('Error fetching adjustments:', error);
        res.status(500).json({ error: 'Error al obtener solicitudes' });
    }
};

// ==================== GET PENDING ADJUSTMENTS (DIRECTOR only) ====================

export const getPendingAdjustments = async (req: AuthRequest, res: Response) => {
    try {
        const userRole = req.user?.role;

        // Only DIRECTOR can see pending adjustments
        if (userRole !== 'DIRECTOR') {
            return res.status(403).json({ error: 'Solo el DIRECTOR puede ver solicitudes pendientes' });
        }

        const adjustments = await prisma.budgetAdjustment.findMany({
            where: { status: 'PENDING' },
            orderBy: { requestedAt: 'asc' },
            include: {
                budget: {
                    include: {
                        project: { select: { name: true } },
                        area: { select: { name: true } },
                        category: { select: { name: true, code: true } }
                    }
                },
                requestedBy: { select: { id: true, name: true, email: true } },
                sources: {
                    include: { budget: { select: { id: true, title: true, available: true } } }
                }
            }
        });

        res.json(adjustments);
    } catch (error: any) {
        console.error('Error fetching pending adjustments:', error);
        res.status(500).json({ error: 'Error al obtener solicitudes pendientes' });
    }
};

// ==================== GET ALL ADJUSTMENTS (for history) ====================

export const getAllAdjustments = async (req: AuthRequest, res: Response) => {
    try {
        const { status, year } = req.query;

        const where: any = {};
        if (status) where.status = status;
        if (year) {
            const yearNum = parseInt(year as string);
            where.requestedAt = {
                gte: new Date(`${yearNum}-01-01`),
                lt: new Date(`${yearNum + 1}-01-01`)
            };
        }

        const adjustments = await prisma.budgetAdjustment.findMany({
            where,
            orderBy: { requestedAt: 'desc' },
            include: {
                budget: {
                    include: {
                        project: { select: { name: true } },
                        category: { select: { name: true, code: true } }
                    }
                },
                requestedBy: { select: { name: true } },
                reviewedBy: { select: { name: true } },
                sources: {
                    include: { budget: { select: { title: true } } }
                }
            }
        });

        res.json(adjustments);
    } catch (error: any) {
        console.error('Error fetching adjustments:', error);
        res.status(500).json({ error: 'Error al obtener solicitudes' });
    }
};

// ==================== APPROVE ADJUSTMENT (DIRECTOR only) ====================

export const approveAdjustment = async (req: AuthRequest, res: Response) => {
    try {
        const userRole = req.user?.role;
        const userId = req.user?.id;
        const { id } = req.params;

        // Only DIRECTOR can approve
        if (userRole !== 'DIRECTOR') {
            return res.status(403).json({ error: 'Solo el DIRECTOR puede aprobar solicitudes' });
        }

        const adjustment = await prisma.budgetAdjustment.findUnique({
            where: { id },
            include: {
                sources: { include: { budget: { include: { category: true } } } },
                budget: { include: { project: true, area: true, category: true } },
                requestedBy: { select: { name: true, email: true } }
            }
        });

        if (!adjustment) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        if (adjustment.status !== 'PENDING') {
            return res.status(400).json({ error: 'Esta solicitud ya fue procesada' });
        }

        // ============ APPLY BUDGET CHANGES AUTOMATICALLY ============

        // 1. If TRANSFER, reduce available and total amount from source budgets
        if (adjustment.type === 'TRANSFER') {
            for (const source of adjustment.sources) {
                await prisma.budget.update({
                    where: { id: source.budgetId },
                    data: {
                        amount: {
                            decrement: parseFloat(source.amount.toString())
                        },
                        available: {
                            decrement: parseFloat(source.amount.toString())
                        },
                        version: { increment: 1 }
                    }
                });
            }
        }

        // 2. Increase available and amount on target budget
        await prisma.budget.update({
            where: { id: adjustment.budgetId },
            data: {
                amount: { increment: parseFloat(adjustment.requestedAmount.toString()) },
                available: { increment: parseFloat(adjustment.requestedAmount.toString()) },
                version: { increment: 1 }
            }
        });

        // Get approver name
        const approver = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

        // 3. Update adjustment status with director info
        const updated = await prisma.budgetAdjustment.update({
            where: { id },
            data: {
                status: 'APPROVED',
                reviewedById: userId,
                reviewedAt: new Date()
            },
            include: {
                budget: { include: { project: true, area: true, category: true } },
                requestedBy: { select: { name: true, email: true } },
                reviewedBy: { select: { name: true } },
                sources: { include: { budget: { select: { title: true, category: true } } } }
            }
        });

        // Generate updated PDF with approval stamp
        try {
            const pdfUrl = await generateAdjustmentPDF({
                code: updated.code || undefined,
                type: updated.type as 'INCREASE' | 'TRANSFER',
                requestedAmount: Number(updated.requestedAmount),
                reason: updated.reason,
                status: 'APPROVED',
                budget: {
                    title: updated.budget.title,
                    code: updated.budget.code || undefined,
                    project: { name: updated.budget.project.name },
                    area: { name: updated.budget.area.name },
                    category: updated.budget.category ? { name: updated.budget.category.name, code: updated.budget.category.code } : undefined
                },
                sources: updated.sources?.map(s => ({
                    budget: { title: s.budget.title, category: s.budget.category ? { name: s.budget.category.name, code: s.budget.category.code } : undefined },
                    amount: Number(s.amount)
                })),
                requestedBy: { name: updated.requestedBy.name || '' },
                reviewedBy: updated.reviewedBy ? { name: updated.reviewedBy.name || '' } : undefined,
                requestedAt: updated.requestedAt,
                reviewedAt: updated.reviewedAt || undefined
            });

            await prisma.budgetAdjustment.update({
                where: { id },
                data: { documentUrl: pdfUrl }
            });

            // Notify requester
            if (updated.requestedBy.email) {
                await sendAdjustmentNotificationEmail({
                    to: updated.requestedBy.email,
                    type: 'ADJUSTMENT_APPROVED',
                    adjustmentCode: updated.code || undefined,
                    adjustmentType: updated.type as 'INCREASE' | 'TRANSFER',
                    amount: Number(updated.requestedAmount),
                    budgetTitle: updated.budget.title,
                    approverName: approver?.name || 'Director'
                });
            }
        } catch (pdfError) {
            console.error('Error generating approval PDF or sending email:', pdfError);
        }

        res.json(updated);
    } catch (error: any) {
        console.error('Error approving adjustment:', error);
        res.status(500).json({ error: 'Error al aprobar solicitud' });
    }
};

// ==================== REJECT ADJUSTMENT (DIRECTOR only) ====================

export const rejectAdjustment = async (req: AuthRequest, res: Response) => {
    try {
        const userRole = req.user?.role;
        const userId = req.user?.id;
        const { id } = req.params;
        const { comment } = req.body;

        // Only DIRECTOR can reject
        if (userRole !== 'DIRECTOR') {
            return res.status(403).json({ error: 'Solo el DIRECTOR puede rechazar solicitudes' });
        }

        const adjustment = await prisma.budgetAdjustment.findUnique({
            where: { id },
            include: {
                budget: true,
                requestedBy: { select: { name: true, email: true } }
            }
        });

        if (!adjustment) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        if (adjustment.status !== 'PENDING') {
            return res.status(400).json({ error: 'Esta solicitud ya fue procesada' });
        }

        const updated = await prisma.budgetAdjustment.update({
            where: { id },
            data: {
                status: 'REJECTED',
                reviewedById: userId,
                reviewedAt: new Date(),
                reviewComment: comment || 'Rechazado sin comentarios'
            }
        });

        // Notify requester
        try {
            if (adjustment.requestedBy.email) {
                await sendAdjustmentNotificationEmail({
                    to: adjustment.requestedBy.email,
                    type: 'ADJUSTMENT_REJECTED',
                    adjustmentCode: adjustment.code || undefined,
                    adjustmentType: adjustment.type as 'INCREASE' | 'TRANSFER',
                    amount: Number(adjustment.requestedAmount),
                    budgetTitle: adjustment.budget.title,
                    comment: comment || 'Rechazado sin comentarios'
                });
            }
        } catch (emailError) {
            console.error('Error sending rejection email:', emailError);
        }

        res.json(updated);
    } catch (error: any) {
        console.error('Error rejecting adjustment:', error);
        res.status(500).json({ error: 'Error al rechazar solicitud' });
    }
};

// ==================== GET ADJUSTMENT BY ID ====================

export const getAdjustmentById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const adjustment = await prisma.budgetAdjustment.findUnique({
            where: { id },
            include: {
                budget: {
                    include: {
                        project: true,
                        area: true,
                        category: true,
                        manager: { select: { name: true } }
                    }
                },
                requestedBy: { select: { id: true, name: true, email: true } },
                reviewedBy: { select: { id: true, name: true } },
                sources: {
                    include: {
                        budget: {
                            select: { id: true, title: true, amount: true, available: true, category: true }
                        }
                    }
                }
            }
        });

        if (!adjustment) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }

        res.json(adjustment);
    } catch (error: any) {
        console.error('Error fetching adjustment:', error);
        res.status(500).json({ error: 'Error al obtener solicitud' });
    }
};
