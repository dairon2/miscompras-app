import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';
import { generatePDF } from '../services/pdfService';
import { sendEmail } from '../services/emailService';
import { DateTime } from 'luxon';

export const createRequirement = async (req: AuthRequest, res: Response) => {
    const { title, description, quantity, projectId, areaId, supplierId, manualSupplierName, budgetId } = req.body;
    const userId = req.user?.id;
    const files = req.files as Express.Multer.File[];

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    try {
        // Automatically find budgetId based on projectId and areaId
        let finalBudgetId = budgetId;
        if (!finalBudgetId && projectId && areaId) {
            const budget = await prisma.budget.findFirst({
                where: { projectId, areaId }
            });
            if (budget) finalBudgetId = budget.id;
        }

        const requirement = await prisma.requirement.create({
            data: {
                title,
                description,
                quantity,
                manualSupplierName: manualSupplierName || null,
                projectId,
                areaId,
                budgetId: finalBudgetId || null,
                supplierId: supplierId || null,
                createdById: userId,
                status: 'PENDING_APPROVAL',
                attachments: {
                    create: files?.map(file => ({
                        fileName: file.originalname,
                        fileUrl: file.path
                    })) || []
                }
            },
            include: {
                attachments: true
            }
        });

        // Log the creation
        await prisma.historyLog.create({
            data: {
                action: 'CREATED',
                requirementId: requirement.id,
                details: `Requirement created by ${req.user?.email} with ${files?.length || 0} attachments`
            }
        });

        // Notify Admins/Leaders
        const admins = await prisma.user.findMany({
            where: {
                role: { in: ['ADMIN', 'LEADER', 'DIRECTOR'] }
            }
        });

        const adminEmails = admins.map((admin: { email: string }) => admin.email).join(',');

        if (adminEmails) {
            try {
                await sendEmail(
                    adminEmails,
                    'Nueva Solicitud de Compra Pendiente',
                    `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h2 style="color: #2563eb;">Nueva Solicitud de Compra</h2>
                        <p>Se ha creado una nueva solicitud que requiere su revisión:</p>
                        <ul style="background: #f3f4f6; padding: 20px; border-radius: 10px; list-style: none;">
                            <li><b>Título:</b> ${title}</li>
                            <li><b>Solicitante:</b> ${req.user?.email}</li>
                        </ul>
                        <p>Por favor, ingrese al sistema para revisar los detalles y adjuntos.</p>
                        <a href="http://localhost:3000/requirements/${requirement.id}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Ver Solicitud</a>
                    </div>
                    `
                );
            } catch (emailError) {
                console.error("Email notification failed but requirement was created:", emailError);
            }
        }

        // --- IN-APP NOTIFICATION FOR ADMINS ---
        for (const admin of admins) {
            await prisma.notification.create({
                data: {
                    userId: admin.id,
                    title: 'Nueva Solicitud Pendiente',
                    message: `Se ha creado el requerimiento: ${title}`,
                    type: 'INFO',
                    requirementId: requirement.id
                }
            });
        }

        res.status(201).json(requirement);
    } catch (error: any) {
        console.error("Create requirement error:", error);
        res.status(400).json({ error: 'Failed to create requirement', details: error.message });
    }
};

export const getMyRequirements = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    try {
        const requirements = await prisma.requirement.findMany({
            where: { createdById: userId },
            include: {
                project: true,
                area: true,
                supplier: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requirements);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch requirements' });
    }
};

export const getRequirementById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const requirement = await prisma.requirement.findUnique({
            where: { id },
            include: {
                project: true,
                area: true,
                supplier: true,
                createdBy: true,
                attachments: true,
                logs: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!requirement) {
            return res.status(404).json({ error: 'Requirement not found' });
        }

        res.json(requirement);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch requirement' });
    }
};

export const updateRequirementStatus = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status, procurementStatus, remarks, receivedAtSatisfaction, satisfactionComments } = req.body;

    try {
        const requirement = await prisma.requirement.update({
            where: { id },
            data: {
                status: status || undefined,
                procurementStatus: procurementStatus || undefined,
                receivedAtSatisfaction: receivedAtSatisfaction !== undefined ? receivedAtSatisfaction : undefined,
                satisfactionComments: satisfactionComments || undefined
            }
        });

        await prisma.historyLog.create({
            data: {
                action: 'STATUS_UPDATED',
                requirementId: requirement.id,
                details: `Cambio de estado a ${status}. Por: ${req.user?.email}. Comentario: ${remarks || 'Sin comentarios'}`
            }
        });

        // In-app Notification for Creator
        const fullReq = await prisma.requirement.findUnique({
            where: { id },
            include: { project: true, area: true, supplier: true, createdBy: true }
        });

        if (fullReq) {
            await prisma.notification.create({
                data: {
                    userId: fullReq.createdById,
                    title: `Requerimiento Actualizado`,
                    message: `Tu solicitud "${fullReq.title}" ha sido actualizada. Estado: ${status}`,
                    type: status === 'REJECTED' ? 'ERROR' : 'INFO',
                    requirementId: fullReq.id
                }
            });
        }

        res.json(requirement);
    } catch (error: any) {
        console.error("Status update error:", error);
        res.status(400).json({ error: 'Status update failed' });
    }
};

export const updateRequirement = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const {
        title, description, quantity, actualAmount,
        projectId, areaId, supplierId, manualSupplierName,
        purchaseOrderNumber, invoiceNumber, deliveryDate,
        receivedAtSatisfaction, satisfactionComments
    } = req.body;

    try {
        const currentReq = await prisma.requirement.findUnique({
            where: { id },
            include: { budget: true }
        });

        if (!currentReq) return res.status(404).json({ error: 'Requirement not found' });

        // Budget Deduction Logic
        let budgetAdjustment = 0;
        if (actualAmount !== undefined && currentReq.budgetId) {
            const newAmount = parseFloat(actualAmount) || 0;
            const oldAmount = parseFloat(currentReq.actualAmount?.toString() || '0');

            if (newAmount !== oldAmount) {
                budgetAdjustment = newAmount - oldAmount;

                await prisma.budget.update({
                    where: { id: currentReq.budgetId },
                    data: {
                        available: { decrement: budgetAdjustment }
                    }
                });
            }
        }

        const updatedRequirement = await prisma.requirement.update({
            where: { id },
            data: {
                title,
                description,
                quantity,
                actualAmount: actualAmount !== undefined ? parseFloat(actualAmount) : undefined,
                projectId,
                areaId,
                supplierId,
                manualSupplierName,
                purchaseOrderNumber,
                invoiceNumber,
                deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
                receivedAtSatisfaction,
                satisfactionComments
            },
            include: {
                project: true,
                area: true,
                supplier: true
            }
        });

        // Log significant changes
        let changes = [];
        if (actualAmount && parseFloat(actualAmount) !== parseFloat(currentReq.actualAmount?.toString() || '0')) {
            changes.push(`Monto actualizado a $${actualAmount}`);
        }
        if (purchaseOrderNumber !== currentReq.purchaseOrderNumber) changes.push(`OC actualizada a ${purchaseOrderNumber}`);

        if (changes.length > 0) {
            await prisma.historyLog.create({
                data: {
                    action: 'EDITED',
                    requirementId: id,
                    details: `Detalles actualizados por ${req.user?.email}: ${changes.join(', ')}`
                }
            });
        }

        res.json(updatedRequirement);
    } catch (error: any) {
        console.error("Update requirement error:", error);
        res.status(400).json({ error: 'Failed to update requirement', details: error.message });
    }
};
