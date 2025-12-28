import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';

export const createRequirement = async (req: AuthRequest, res: Response) => {
    const { title, description, quantity, projectId, areaId, supplierId, manualSupplierName, budgetId } = req.body;
    const userId = req.user?.id;
    const files = req.files as Express.Multer.File[];

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    try {
        const requirement = await prisma.requirement.create({
            data: {
                title,
                description,
                quantity: quantity || "1",
                manualSupplierName: manualSupplierName || null,
                projectId,
                areaId,
                budgetId: budgetId || null,
                supplierId: supplierId || null,
                createdById: userId,
                year: new Date().getFullYear(),
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

        // TODO: Re-enable email notification with Azure Communication Services
        // Email notification temporarily disabled
        console.log(`[INFO] New requirement created. Would notify: ${adminEmails}`);


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
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const includeAsientos = req.query.includeAsientos === 'true';

    try {
        const requirements = await prisma.requirement.findMany({
            where: {
                createdById: userId,
                year: year,
                isAsiento: includeAsientos ? undefined : false
            },
            include: {
                project: true,
                area: true,
                supplier: true,
                payments: true
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

// Get ALL requirements - for ADMIN, DIRECTOR, LEADER
export const getAllRequirements = async (req: AuthRequest, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const includeAsientos = req.query.includeAsientos === 'true';

    try {
        const requirements = await prisma.requirement.findMany({
            where: {
                year: year,
                isAsiento: includeAsientos ? undefined : false
            },
            include: {
                project: true,
                area: true,
                supplier: true,
                payments: true,
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requirements);
    } catch (error: any) {
        console.error("Error fetching all requirements:", error);
        res.status(500).json({ error: 'Failed to fetch requirements' });
    }
};

// Update ONLY observations field - for regular users on their own requirements
export const updateObservations = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { observations, satisfactionComments } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
        const requirement = await prisma.requirement.findUnique({
            where: { id }
        });

        if (!requirement) {
            return res.status(404).json({ error: 'Requirement not found' });
        }

        // Users can only update observations on their own requirements
        // Admins/Directors can update any
        const isOwner = requirement.createdById === userId;
        const isAdmin = ['ADMIN', 'DIRECTOR', 'LEADER'].includes(userRole || '');

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'No tienes permiso para modificar este requerimiento' });
        }

        const updatedRequirement = await prisma.requirement.update({
            where: { id },
            data: {
                satisfactionComments: satisfactionComments !== undefined ? satisfactionComments : undefined
            },
            include: {
                project: true,
                area: true,
                supplier: true
            }
        });

        // Log the change
        await prisma.historyLog.create({
            data: {
                action: 'OBSERVATIONS_UPDATED',
                requirementId: id,
                details: `Observaciones actualizadas por ${req.user?.email}`
            }
        });

        res.json(updatedRequirement);
    } catch (error: any) {
        console.error("Update observations error:", error);
        res.status(400).json({ error: 'Failed to update observations' });
    }
};

// Delete requirement - only ADMIN and DIRECTOR
export const deleteRequirement = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const requirement = await prisma.requirement.findUnique({
            where: { id },
            include: { attachments: true }
        });

        if (!requirement) {
            return res.status(404).json({ error: 'Requirement not found' });
        }

        // Delete physical files
        if (requirement.attachments && requirement.attachments.length > 0) {
            for (const attachment of requirement.attachments) {
                try {
                    if (fs.existsSync(attachment.fileUrl)) {
                        fs.unlinkSync(attachment.fileUrl);
                    }
                } catch (err) {
                    console.error(`Error deleting file ${attachment.fileUrl}:`, err);
                }
            }
        }

        // Delete related records first (cascade)
        await prisma.historyLog.deleteMany({ where: { requirementId: id } });
        await prisma.attachment.deleteMany({ where: { requirementId: id } });
        await prisma.notification.deleteMany({ where: { requirementId: id } });

        // Delete the requirement
        await prisma.requirement.delete({ where: { id } });

        // Log deletion
        console.log(`Requirement ${id} deleted by ${req.user?.email}`);

        res.json({ message: 'Requerimiento eliminado exitosamente' });
    } catch (error: any) {
        console.error("Delete requirement error:", error);
        res.status(400).json({ error: 'Failed to delete requirement', details: error.message });
    }
};

// Get all Asientos (pre-approved requirements) - for ADMIN, DIRECTOR, LEADER
export const getAsientos = async (req: AuthRequest, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    try {
        const asientos = await prisma.requirement.findMany({
            where: {
                isAsiento: true,
                year: year
            },
            include: {
                project: true,
                area: true,
                supplier: true,
                payments: true,
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(asientos);
    } catch (error: any) {
        console.error("Error fetching asientos:", error);
        res.status(500).json({ error: 'Failed to fetch asientos' });
    }
};

// Create an Asiento (pre-approved requirement)
export const createAsiento = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Only ADMIN, DIRECTOR, LEADER can create asientos
    if (!['ADMIN', 'DIRECTOR', 'LEADER'].includes(userRole || '')) {
        return res.status(403).json({ error: 'No tienes permiso para crear asientos' });
    }

    const {
        title,
        description,
        quantity,
        totalAmount,
        actualAmount,
        projectId,
        areaId,
        supplierId,
        manualSupplierName,
        budgetId,
        reqCategory,
        purchaseOrderNumber,
        invoiceNumber,
        hasMultiplePayments
    } = req.body;

    try {
        // Budget deduction for asientos (immediate)
        if (budgetId && totalAmount) {
            await prisma.budget.update({
                where: { id: budgetId },
                data: {
                    available: { decrement: parseFloat(totalAmount) }
                }
            });
        }

        const asiento = await prisma.requirement.create({
            data: {
                title,
                description,
                quantity,
                totalAmount: totalAmount ? parseFloat(totalAmount) : null,
                actualAmount: actualAmount ? parseFloat(actualAmount) : null,
                projectId,
                areaId,
                supplierId,
                manualSupplierName,
                budgetId,
                reqCategory: reqCategory || 'COMPRA',
                purchaseOrderNumber,
                invoiceNumber,
                createdById: userId!,
                year: new Date().getFullYear(),
                isAsiento: true,
                hasMultiplePayments: hasMultiplePayments || false,
                status: 'APPROVED',  // Auto-approved for asientos
                procurementStatus: 'EN_TRAMITE'
            },
            include: {
                project: true,
                area: true,
                supplier: true
            }
        });

        // Log creation
        await prisma.historyLog.create({
            data: {
                action: 'ASIENTO_CREATED',
                requirementId: asiento.id,
                details: `Asiento creado por ${req.user?.email} - Monto: $${totalAmount?.toLocaleString() || 0}`
            }
        });

        res.status(201).json(asiento);
    } catch (error: any) {
        console.error("Error creating asiento:", error);
        res.status(500).json({ error: 'Error al crear el asiento', details: error.message });
    }
};
