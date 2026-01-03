import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';
import { createRequirementGroup } from '../services/requirementGroupService';
import { uploadToBlobStorage, processFileUploads } from '../services/blobStorageService';

export const createRequirement = async (req: AuthRequest, res: Response) => {
    const { title, description, quantity, projectId, areaId, supplierId, manualSupplierName, budgetId } = req.body;
    const userId = req.user?.id;
    const files = req.files as Express.Multer.File[];

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    try {
        // Process attachments first using the new helper
        const attachmentData = await processFileUploads(files, 'requirements');

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
                    create: attachmentData
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

export const createMassRequirements = async (req: AuthRequest, res: Response) => {
    const { requirements } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
        return res.status(400).json({ error: 'No requirements provided' });
    }

    try {
        const result = await createRequirementGroup(userId, requirements);

        // Notify Approvers (Leader of the area, Coordinators, Directors)
        const approvers = await prisma.user.findMany({
            where: {
                role: { in: ['LEADER', 'COORDINATOR', 'DIRECTOR', 'ADMIN'] }
            }
        });

        for (const approver of approvers) {
            await prisma.notification.create({
                data: {
                    userId: approver.id,
                    title: 'Nueva Solicitud Múltiple',
                    message: `Se ha creado una solicitud agrupada (ID: ${result.group.id}) con ${requirements.length} items.`,
                    type: 'INFO'
                }
            });
        }

        res.status(201).json(result);
    } catch (error: any) {
        console.error("Mass create error:", error);
        res.status(500).json({ error: 'Failed to create mass requirements', details: error.message });
    }
};

export const getMyRequirements = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const includeAsientos = req.query.includeAsientos === 'true';

    // Pagination params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    try {
        const where = {
            createdById: userId,
            year: year,
            isAsiento: includeAsientos ? undefined : false
        };

        // Get total count for pagination
        const total = await prisma.requirement.count({ where });

        const requirements = await prisma.requirement.findMany({
            where,
            include: {
                project: true,
                area: true,
                supplier: true,
                payments: true,
                budget: {
                    select: {
                        id: true,
                        title: true,
                        code: true,
                        category: {
                            select: {
                                id: true,
                                name: true,
                                code: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        });

        res.json({
            data: requirements,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
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
                },
                group: true
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

    // Defensive check for body
    if (!req.body) {
        console.error("updateRequirement: req.body is undefined");
        return res.status(400).json({ error: 'Request body is missing' });
    }

    const {
        title, description, quantity, actualAmount,
        projectId, areaId, supplierId, manualSupplierName,
        purchaseOrderNumber, invoiceNumber, deliveryDate,
        receivedDate, reqCategory, procurementStatus,
        receivedAtSatisfaction, satisfactionComments,
        deleteAttachmentIds, hasMultiplePayments
    } = req.body;
    const files = req.files as Express.Multer.File[];

    try {
        const currentReq = await prisma.requirement.findUnique({
            where: { id },
            include: { budget: true, attachments: true }
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

        // Handle attachment deletions
        if (deleteAttachmentIds) {
            const idsToDelete = Array.isArray(deleteAttachmentIds) ? deleteAttachmentIds : [deleteAttachmentIds];
            const attachmentsToDelete = currentReq.attachments.filter(a => idsToDelete.includes(a.id));

            for (const att of attachmentsToDelete) {
                try {
                    if (att.fileUrl && fs.existsSync(att.fileUrl)) {
                        fs.unlinkSync(att.fileUrl);
                    }
                } catch (err) {
                    console.error(`Warning: Could not delete file ${att.fileUrl}:`, err);
                }
            }

            await prisma.attachment.deleteMany({
                where: { id: { in: idsToDelete } }
            });
        }

        // Safe date parsing helper
        const parseSafeDate = (val: any) => {
            if (!val || val === 'null' || val === '') return null;
            const d = new Date(val);
            return (d instanceof Date && !isNaN(d.getTime())) ? d : undefined;
        };

        const updatedRequirement = await prisma.requirement.update({
            where: { id },
            data: {
                title,
                description,
                quantity,
                actualAmount: (actualAmount && actualAmount !== 'null' && !isNaN(parseFloat(actualAmount))) ? parseFloat(actualAmount) : (actualAmount === 'null' ? null : undefined),
                totalAmount: (actualAmount && actualAmount !== 'null' && !isNaN(parseFloat(actualAmount))) ? parseFloat(actualAmount) : (actualAmount === 'null' ? null : undefined),
                projectId: (projectId && projectId !== 'null') ? projectId : undefined,
                areaId: (areaId && areaId !== 'null') ? areaId : undefined,
                supplierId: (supplierId === 'null' || !supplierId) ? null : supplierId,
                manualSupplierName: manualSupplierName === 'null' ? null : manualSupplierName,
                purchaseOrderNumber: purchaseOrderNumber === 'null' ? null : purchaseOrderNumber,
                invoiceNumber: invoiceNumber === 'null' ? null : invoiceNumber,
                deliveryDate: parseSafeDate(deliveryDate),
                receivedDate: parseSafeDate(receivedDate),
                reqCategory: (reqCategory && reqCategory !== 'null') ? reqCategory : undefined,
                procurementStatus: (procurementStatus && procurementStatus !== 'null') ? procurementStatus : undefined,
                receivedAtSatisfaction: receivedAtSatisfaction !== undefined ? (receivedAtSatisfaction === 'true' || receivedAtSatisfaction === true) : undefined,
                satisfactionComments: satisfactionComments === 'null' ? null : satisfactionComments,
                hasMultiplePayments: hasMultiplePayments !== undefined ? (hasMultiplePayments === 'true' || hasMultiplePayments === true) : undefined,
                attachments: {
                    create: await processFileUploads(files, 'requirements')
                }
            },
            include: {
                project: true,
                area: true,
                supplier: true,
                attachments: true
            }
        });

        // Log significant changes
        let changes = [];
        if (actualAmount && parseFloat(actualAmount) !== parseFloat(currentReq.actualAmount?.toString() || '0')) {
            changes.push(`Monto actualizado a $${actualAmount}`);
        }
        if (purchaseOrderNumber !== currentReq.purchaseOrderNumber) changes.push(`OC actualizada a ${purchaseOrderNumber}`);
        if (files?.length > 0) changes.push(`${files.length} nuevos adjuntos añadidos`);
        if (deleteAttachmentIds) changes.push(`Adjuntos eliminados`);

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

    // Pagination params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
        const where: any = {
            year: year,
            isAsiento: includeAsientos ? undefined : false
        };

        // ADMIN, DIRECTOR (global), LEADER, COORDINATOR and AUDITOR see everything
        const isGlobalViewer = ['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER', 'COORDINATOR', 'AUDITOR', 'DEVELOPER'].includes(userRole || '');

        if (!isGlobalViewer) {
            // Check if user is director of any area
            const directedAreas = await prisma.area.findMany({
                where: { directorId: userId } as any,
                select: { id: true }
            });
            const directedAreaIds = directedAreas.map(a => a.id);

            if (directedAreaIds.length > 0) {
                // Area Director sees all of their area + their owned ones
                where.OR = [
                    { areaId: { in: directedAreaIds } },
                    { createdById: userId }
                ];
            }
        }

        // Get total count for pagination
        const total = await prisma.requirement.count({ where });

        const requirements = await prisma.requirement.findMany({
            where,
            include: {
                project: true,
                area: true,
                supplier: true,
                payments: true,
                budget: {
                    select: {
                        id: true,
                        title: true,
                        code: true,
                        category: {
                            select: {
                                id: true,
                                name: true,
                                code: true
                            }
                        }
                    }
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        });

        res.json({
            data: requirements,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
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

export const approveRequirementGroup = async (req: AuthRequest, res: Response) => {
    const { id } = req.params; // Group ID
    const { comments } = req.body;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    try {
        const group = await prisma.requirementGroup.findUnique({
            where: { id: parseInt(id) },
            include: { requirements: true }
        });

        if (!group) return res.status(404).json({ error: 'Group not found' });

        const updateData: any = {};
        let actionLabel = '';

        if (userRole === 'COORDINATOR') {
            updateData.coordinatorApproval = true;
            updateData.coordinatorComment = comments;
            actionLabel = 'Coordinador';
        } else if (userRole === 'DIRECTOR' || userRole === 'ADMIN' || userRole === 'DEVELOPER') {
            updateData.directorApproval = true;
            updateData.directorComment = comments;
            actionLabel = 'Dirección';
        } else {
            return res.status(403).json({ error: 'No tienes permisos para aprobar' });
        }

        const requirements = await prisma.requirement.updateMany({
            where: { groupId: parseInt(id) },
            data: updateData
        });

        // If both Coordinator and Director approved (or just Director/Admin who can override)
        // Check current status of requirements in group to see if we should mark the whole thing as APPROVED
        const updatedReqs = await prisma.requirement.findMany({ where: { groupId: parseInt(id) } });
        const allApproved = updatedReqs.every(r =>
            (r.coordinatorApproval && r.directorApproval) ||
            (userRole === 'DIRECTOR' || userRole === 'ADMIN' || userRole === 'DEVELOPER')
        );

        if (allApproved) {
            await prisma.requirement.updateMany({
                where: { groupId: parseInt(id) },
                data: { status: 'APPROVED' }
            });
        }

        // Log and Notify
        await prisma.historyLog.create({
            data: {
                action: 'GROUP_APPROVED',
                details: `Grupo ${id} aprobado por ${actionLabel} (${req.user?.email}). ${comments || ''}`,
                requirementId: group.requirements[0]?.id || '' // Link to first for reference
            }
        });

        res.json({ message: `Solicitud aprobada por ${actionLabel}`, allApproved });
    } catch (error: any) {
        res.status(500).json({ error: 'Approval failed', details: error.message });
    }
};

export const rejectRequirementGroup = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { comments } = req.body;
    const userRole = req.user?.role;

    try {
        await prisma.requirement.updateMany({
            where: { groupId: parseInt(id) },
            data: {
                status: 'REJECTED',
                coordinatorComment: userRole === 'COORDINATOR' ? comments : undefined,
                directorComment: (userRole === 'DIRECTOR' || userRole === 'ADMIN') ? comments : undefined
            }
        });

        res.json({ message: 'Solicitud rechazada' });
    } catch (error: any) {
        res.status(500).json({ error: 'Rejection failed' });
    }
};

// Get pending requirements for approval view (returns requirements with status PENDING_APPROVAL)
// Get pending requirements for approval view (returns requirements with status PENDING_APPROVAL)
export const getRequirementGroups = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    try {
        const where: any = {
            status: 'PENDING_APPROVAL',
            year: year
        };

        const isGlobalViewer = ['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER', 'COORDINATOR', 'AUDITOR'].includes(userRole || '');

        // Filter by area if user is not a global viewer
        if (!isGlobalViewer) {
            const directedAreas = await prisma.area.findMany({
                where: { directorId: userId } as any,
                select: { id: true }
            });
            const directedAreaIds = directedAreas.map(a => a.id);

            if (directedAreaIds.length > 0) {
                where.areaId = { in: directedAreaIds };
            } else {
                // Regular USER should only see what they created
                where.createdById = userId;
            }
        }

        const requirements = await prisma.requirement.findMany({
            where,
            include: {
                project: true,
                area: true,
                budget: {
                    include: {
                        category: true
                    }
                },
                attachments: true,
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                group: true // Include group details if available
            },
            orderBy: { createdAt: 'desc' }
        });

        // Group requirements by groupId
        const groupsMap = new Map<number | string, any>();
        const individualReqs: any[] = [];

        requirements.forEach(req => {
            if (req.groupId) {
                if (!groupsMap.has(req.groupId)) {
                    groupsMap.set(req.groupId, {
                        id: req.groupId,
                        creator: req.group?.creatorId ? { ...req.createdBy } : req.createdBy, // Fallback to req creator
                        pdfUrl: req.group?.pdfUrl || null,
                        createdAt: req.group?.createdAt || req.createdAt,
                        requirements: []
                    });
                }
                groupsMap.get(req.groupId).requirements.push(req);
            } else {
                individualReqs.push(req);
            }
        });

        const result = Array.from(groupsMap.values());

        // Add individual requirements as a separate group if any
        if (individualReqs.length > 0) {
            result.push({
                id: 0, // ID 0 for "Individual/Miscellaneous"
                creator: { id: 'system', name: 'Solicitudes Individuales', email: '' },
                pdfUrl: null,
                createdAt: new Date().toISOString(),
                requirements: individualReqs
            });
        }

        res.json(result);
    } catch (error: any) {
        console.error("Error fetching pending requirements:", error);
        res.status(500).json({ error: 'Failed to fetch requirements', details: error.message });
    }
};

// Get available years for requirements history
export const getAvailableYears = async (req: AuthRequest, res: Response) => {
    try {
        const result = await prisma.requirement.findMany({
            select: { year: true },
            distinct: ['year'],
            orderBy: { year: 'desc' }
        });

        const years = result.map(r => r.year).filter(y => y !== null);
        const currentYear = new Date().getFullYear();

        // Ensure current year is always available
        if (!years.includes(currentYear)) {
            years.unshift(currentYear);
            years.sort((a, b) => b - a); // Re-sort descending
        }

        res.json(years);
    } catch (error: any) {
        console.error("Error fetching available years:", error);
        res.status(500).json({ error: 'Failed to fetch years' });
    }
};

// Get dashboard stats (counts, sums and recent activity) based on user role
export const getDashboardStats = async (req: AuthRequest, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
        const where: any = {
            year: year,
            isAsiento: false // Usually dashboard focuses on actual requirements
        };

        // Visibility logic (same as getAllRequirements)
        const isGlobalViewer = ['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER', 'COORDINATOR', 'AUDITOR'].includes(userRole || '');

        if (!isGlobalViewer) {
            const directedAreas = await prisma.area.findMany({
                where: { directorId: userId } as any,
                select: { id: true }
            });
            const directedAreaIds = directedAreas.map(a => a.id);

            if (directedAreaIds.length > 0) {
                where.OR = [
                    { areaId: { in: directedAreaIds } },
                    { createdById: userId }
                ];
            } else {
                where.createdById = userId;
            }
        }

        // Get stats in parallel
        const [
            pending,
            approved,
            rejected,
            recent
        ] = await Promise.all([
            prisma.requirement.count({ where: { ...where, status: { contains: 'PENDING' } } }),
            prisma.requirement.count({ where: { ...where, status: 'APPROVED' } }),
            prisma.requirement.count({ where: { ...where, status: 'REJECTED' } }),
            prisma.requirement.findMany({
                where,
                include: {
                    project: true,
                    area: true,
                    createdBy: {
                        select: { name: true, email: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 8 // Show a few more than the frontend 5 just in case
            })
        ]);

        // Calculate total amount safely by prioritizing actualAmount over totalAmount
        const allStatsReqs = await prisma.requirement.findMany({
            where,
            select: { actualAmount: true, totalAmount: true }
        });

        const totalAmount = allStatsReqs.reduce((acc, req) => {
            return acc + Number(req.actualAmount || req.totalAmount || 0);
        }, 0);

        res.json({
            pending,
            approved,
            rejected,
            totalAmount,
            recent
        });
    } catch (error: any) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
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
                procurementStatus: 'EN_TRAMITE',
                attachments: {
                    create: await processFileUploads(req.files as Express.Multer.File[], 'asientos')
                }
            },
            include: {
                project: true,
                area: true,
                supplier: true,
                attachments: true
            }
        });

        // Log creation
        // History Log removed: Table does not exist in schema.
        // The record is already tracked by the IsAsiento=true flag in Requirements table.

        res.status(201).json(asiento);
    } catch (error: any) {
        console.error("Error creating asiento:", error);
        res.status(500).json({ error: 'Error al crear el asiento', details: error.message });
    }
};
