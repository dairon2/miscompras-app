"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdjustmentById = exports.rejectAdjustment = exports.approveAdjustment = exports.getAllAdjustments = exports.getPendingAdjustments = exports.getMyAdjustments = exports.createAdjustment = void 0;
const index_1 = require("../index");
const pdfService_1 = require("../services/pdfService");
const emailService_1 = require("../services/emailService");
// ==================== CREATE ADJUSTMENT REQUEST ====================
const createAdjustment = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { budgetId, type, // 'INCREASE' or 'TRANSFER'
        requestedAmount, reason, sources // For TRANSFER: [{ budgetId, amount }]
         } = req.body;
        if (!budgetId || !type || !requestedAmount || !reason) {
            return res.status(400).json({
                error: 'Presupuesto destino, tipo, monto y motivo son requeridos'
            });
        }
        // Validate budget exists
        const targetBudget = await index_1.prisma.budget.findUnique({
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
            const sourceTotal = sources.reduce((sum, s) => sum + parseFloat(s.amount), 0);
            if (Math.abs(sourceTotal - parseFloat(requestedAmount)) > 0.01) {
                return res.status(400).json({
                    error: `La suma de los descuentos ($${sourceTotal.toLocaleString()}) debe ser igual al monto solicitado ($${parseFloat(requestedAmount).toLocaleString()})`
                });
            }
            // Validate each source budget has sufficient available
            for (const source of sources) {
                const sourceBudget = await index_1.prisma.budget.findUnique({
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
        const count = await index_1.prisma.budgetAdjustment.count();
        const code = `ADJ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        // Create adjustment
        const adjustment = await index_1.prisma.budgetAdjustment.create({
            data: {
                code,
                type,
                budgetId,
                requestedAmount: parseFloat(requestedAmount),
                reason,
                requestedById: userId,
                status: 'PENDING',
                sources: type === 'TRANSFER' ? {
                    create: sources.map((s) => ({
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
            const pdfUrl = await (0, pdfService_1.generateAdjustmentPDF)({
                code: adjustment.code || undefined,
                type: adjustment.type,
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
            await index_1.prisma.budgetAdjustment.update({
                where: { id: adjustment.id },
                data: { documentUrl: pdfUrl }
            });
            // Notify directors
            const typeLabel = type === 'INCREASE' ? 'Aumento' : 'Movimiento';
            await (0, emailService_1.notifyDirectors)(`Nueva Solicitud de ${typeLabel}: ${code}`, `<p>Se ha creado una nueva solicitud de ajuste presupuestal:</p>
                <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Código:</strong> ${code}</p>
                    <p><strong>Tipo:</strong> ${typeLabel}</p>
                    <p><strong>Presupuesto:</strong> ${targetBudget.title}</p>
                    <p><strong>Monto:</strong> $${Number(requestedAmount).toLocaleString()}</p>
                    <p><strong>Solicitado por:</strong> ${adjustment.requestedBy.name}</p>
                </div>`);
        }
        catch (pdfError) {
            console.error('Error generating PDF or sending email:', pdfError);
        }
        res.status(201).json(adjustment);
    }
    catch (error) {
        console.error('Error creating adjustment:', error);
        res.status(500).json({ error: 'Error al crear solicitud' });
    }
};
exports.createAdjustment = createAdjustment;
// ==================== GET MY ADJUSTMENTS ====================
const getMyAdjustments = async (req, res) => {
    try {
        const userId = req.user?.id;
        const adjustments = await index_1.prisma.budgetAdjustment.findMany({
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
    }
    catch (error) {
        console.error('Error fetching adjustments:', error);
        res.status(500).json({ error: 'Error al obtener solicitudes' });
    }
};
exports.getMyAdjustments = getMyAdjustments;
// ==================== GET PENDING ADJUSTMENTS (DIRECTOR only) ====================
const getPendingAdjustments = async (req, res) => {
    try {
        const userRole = req.user?.role;
        // Allow DIRECTOR, ADMIN, and DEVELOPER to see pending adjustments
        if (!['DIRECTOR', 'ADMIN', 'DEVELOPER'].includes(userRole || '')) {
            return res.status(403).json({ error: 'Solo el DIRECTOR o ADMIN pueden ver solicitudes pendientes' });
        }
        const adjustments = await index_1.prisma.budgetAdjustment.findMany({
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
    }
    catch (error) {
        console.error('Error fetching pending adjustments:', error);
        res.status(500).json({ error: 'Error al obtener solicitudes pendientes' });
    }
};
exports.getPendingAdjustments = getPendingAdjustments;
// ==================== GET ALL ADJUSTMENTS (for history) ====================
const getAllAdjustments = async (req, res) => {
    try {
        const { status, year } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (year) {
            const yearNum = parseInt(year);
            where.requestedAt = {
                gte: new Date(`${yearNum}-01-01`),
                lt: new Date(`${yearNum + 1}-01-01`)
            };
        }
        const adjustments = await index_1.prisma.budgetAdjustment.findMany({
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
    }
    catch (error) {
        console.error('Error fetching adjustments:', error);
        res.status(500).json({ error: 'Error al obtener solicitudes' });
    }
};
exports.getAllAdjustments = getAllAdjustments;
// ==================== APPROVE ADJUSTMENT (DIRECTOR only) ====================
const approveAdjustment = async (req, res) => {
    try {
        const userRole = req.user?.role;
        const userId = req.user?.id;
        const { id } = req.params;
        // Allow DIRECTOR, ADMIN, and DEVELOPER to approve
        if (!['DIRECTOR', 'ADMIN', 'DEVELOPER'].includes(userRole || '')) {
            return res.status(403).json({ error: 'Solo el DIRECTOR o ADMIN pueden aprobar solicitudes' });
        }
        const adjustment = await index_1.prisma.budgetAdjustment.findUnique({
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
        const result = await index_1.prisma.$transaction(async (tx) => {
            // 1. If TRANSFER, reduce available and total amount from source budgets
            if (adjustment.type === 'TRANSFER') {
                for (const source of adjustment.sources) {
                    const beforeSource = await tx.budget.findUnique({ where: { id: source.budgetId } });
                    console.log(`[ADJUSTMENT] Decrementing Source Budget ${source.budgetId} (${source.budget.title}). Old Available: ${beforeSource?.available}`);
                    await tx.budget.update({
                        where: { id: source.budgetId },
                        data: {
                            amount: { decrement: parseFloat(source.amount.toString()) },
                            available: { decrement: parseFloat(source.amount.toString()) },
                            version: { increment: 1 }
                        }
                    });
                }
            }
            // 2. Increase available and amount on target budget
            const beforeTarget = await tx.budget.findUnique({ where: { id: adjustment.budgetId } });
            console.log(`[ADJUSTMENT] Incrementing Target Budget ${adjustment.budgetId} (${adjustment.budget.title}). Old Available: ${beforeTarget?.available}, Amount to Add: ${adjustment.requestedAmount}`);
            const updatedBudget = await tx.budget.update({
                where: { id: adjustment.budgetId },
                data: {
                    amount: { increment: parseFloat(adjustment.requestedAmount.toString()) },
                    available: { increment: parseFloat(adjustment.requestedAmount.toString()) },
                    version: { increment: 1 }
                }
            });
            console.log(`[ADJUSTMENT] Target Budget Updated. New Available: ${updatedBudget.available}`);
            // Get approver name
            const approver = await tx.user.findUnique({ where: { id: userId }, select: { name: true } });
            // 3. Update adjustment status with director info
            const updatedAdjustment = await tx.budgetAdjustment.update({
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
            return { updatedAdjustment, approver };
        });
        const { updatedAdjustment, approver } = result;
        // Generate updated PDF with approval stamp
        try {
            const pdfUrl = await (0, pdfService_1.generateAdjustmentPDF)({
                code: updatedAdjustment.code || undefined,
                type: updatedAdjustment.type,
                requestedAmount: Number(updatedAdjustment.requestedAmount),
                reason: updatedAdjustment.reason,
                status: 'APPROVED',
                budget: {
                    title: updatedAdjustment.budget.title,
                    code: updatedAdjustment.budget.code || undefined,
                    project: { name: updatedAdjustment.budget.project.name },
                    area: { name: updatedAdjustment.budget.area.name },
                    category: updatedAdjustment.budget.category ? { name: updatedAdjustment.budget.category.name, code: updatedAdjustment.budget.category.code } : undefined
                },
                sources: updatedAdjustment.sources?.map(s => ({
                    budget: { title: s.budget.title, category: s.budget.category ? { name: s.budget.category.name, code: s.budget.category.code } : undefined },
                    amount: Number(s.amount)
                })),
                requestedBy: { name: updatedAdjustment.requestedBy.name || '' },
                reviewedBy: updatedAdjustment.reviewedBy ? { name: updatedAdjustment.reviewedBy.name || '' } : undefined,
                requestedAt: updatedAdjustment.requestedAt,
                reviewedAt: updatedAdjustment.reviewedAt || undefined
            });
            await index_1.prisma.budgetAdjustment.update({
                where: { id },
                data: { documentUrl: pdfUrl }
            });
            // Notify requester
            if (updatedAdjustment.requestedBy.email) {
                await (0, emailService_1.sendAdjustmentNotificationEmail)({
                    to: updatedAdjustment.requestedBy.email,
                    type: 'ADJUSTMENT_APPROVED',
                    adjustmentCode: updatedAdjustment.code || undefined,
                    adjustmentType: updatedAdjustment.type,
                    amount: Number(updatedAdjustment.requestedAmount),
                    budgetTitle: updatedAdjustment.budget.title,
                    approverName: approver?.name || 'Director'
                });
            }
        }
        catch (pdfError) {
            console.error('Error generating approval PDF or sending email:', pdfError);
        }
        res.json(updatedAdjustment);
    }
    catch (error) {
        console.error('Error approving adjustment:', error);
        res.status(500).json({ error: 'Error al aprobar solicitud' });
    }
};
exports.approveAdjustment = approveAdjustment;
// ==================== REJECT ADJUSTMENT (DIRECTOR only) ====================
const rejectAdjustment = async (req, res) => {
    try {
        const userRole = req.user?.role;
        const userId = req.user?.id;
        const { id } = req.params;
        const { comment } = req.body;
        // Allow DIRECTOR, ADMIN, and DEVELOPER to reject
        if (!['DIRECTOR', 'ADMIN', 'DEVELOPER'].includes(userRole || '')) {
            return res.status(403).json({ error: 'Solo el DIRECTOR o ADMIN pueden rechazar solicitudes' });
        }
        const adjustment = await index_1.prisma.budgetAdjustment.findUnique({
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
        const updated = await index_1.prisma.budgetAdjustment.update({
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
                await (0, emailService_1.sendAdjustmentNotificationEmail)({
                    to: adjustment.requestedBy.email,
                    type: 'ADJUSTMENT_REJECTED',
                    adjustmentCode: adjustment.code || undefined,
                    adjustmentType: adjustment.type,
                    amount: Number(adjustment.requestedAmount),
                    budgetTitle: adjustment.budget.title,
                    comment: comment || 'Rechazado sin comentarios'
                });
            }
        }
        catch (emailError) {
            console.error('Error sending rejection email:', emailError);
        }
        res.json(updated);
    }
    catch (error) {
        console.error('Error rejecting adjustment:', error);
        res.status(500).json({ error: 'Error al rechazar solicitud' });
    }
};
exports.rejectAdjustment = rejectAdjustment;
// ==================== GET ADJUSTMENT BY ID ====================
const getAdjustmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const adjustment = await index_1.prisma.budgetAdjustment.findUnique({
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
    }
    catch (error) {
        console.error('Error fetching adjustment:', error);
        res.status(500).json({ error: 'Error al obtener solicitud' });
    }
};
exports.getAdjustmentById = getAdjustmentById;
