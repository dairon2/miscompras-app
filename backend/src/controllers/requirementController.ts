import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';
import { createRequirementGroup } from '../services/requirementGroupService';
import { uploadToBlobStorage, processFileUploads } from '../services/blobStorageService';
import { checkSubmissionAllowed } from '../services/submissionRulesService';
import { sendRequirementNotificationEmail } from '../services/emailService';

// Helper function to translate status to Spanish
const translateStatus = (status: string): string => {
    const translations: Record<string, string> = {
        'PENDING_APPROVAL': 'Pendiente de Aprobación',
        'PENDING_COORDINATION': 'Pendiente de Coordinación',
        'PENDING_FINANCE': 'Pendiente de Finanzas',
        'APPROVED': 'Aprobado',
        'APPROVED_FOR_PURCHASE': 'Aprobado para Compra',
        'REJECTED': 'Rechazado',
        'CANCELLED': 'Cancelado',
        'FINALIZADO': 'Finalizado',
        'ENTREGADO': 'Entregado',
        'EN_TRAMITE': 'En Trámite',
        'PENDIENTE': 'Pendiente',
        'POSTERGADO': 'Postergado',
        'ANULADO': 'Anulado'
    };
    return translations[status] || status;
};

export const createRequirement = async (req: AuthRequest, res: Response) => {
    const { title, description, quantity, projectId, areaId, supplierId, manualSupplierName, suggestedSupplier, budgetId } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role || 'USER';
    const files = req.files as Express.Multer.File[];

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    // Verificar si el usuario puede enviar requerimientos en este momento
    const submissionCheck = await checkSubmissionAllowed(userRole);
    if (!submissionCheck.canSubmit) {
        return res.status(403).json({
            error: 'No puedes enviar requerimientos en este momento',
            message: submissionCheck.message,
            nextAvailable: submissionCheck.nextAvailable
        });
    }

    try {

        // Process attachments first using the new helper
        const attachmentData = await processFileUploads(files, 'requirements');

        // Use the service to create a group (even for a single requirement)
        // This ensures PDF generation and proper structure
        const result = await createRequirementGroup(userId, [{
            title,
            description,
            quantity: quantity || "1",
            manualSupplierName: manualSupplierName || null,
            suggestedSupplier: suggestedSupplier || null,
            projectId,
            areaId,
            budgetId: budgetId || null,
            supplierId: supplierId || null,
            attachments: {
                create: attachmentData
            }
        }]);

        const requirement = result.requirements[0];

        // Log the creation
        await prisma.historyLog.create({
            data: {
                action: 'CREATED',
                requirementId: requirement.id,
                details: `Requirement created by ${req.user?.email} with ${attachmentData.length} attachments (Group ${result.group.id})`
            }
        });

        // Notify Admins/Leaders
        const admins = await prisma.user.findMany({
            where: {
                role: { in: ['COORDINATOR', 'DIRECTOR'] }
            }
        });

        const adminEmails = admins.map((admin: { email: string }) => admin.email).join(',');

        // Notify Admins/Leaders via Email
        // Notify Admins/Leaders via Email - Non-blocking
        Promise.all(admins.map(admin =>
            sendRequirementNotificationEmail({
                to: admin.email,
                type: 'REQUIREMENT_CREATED',
                requirementId: requirement.id,
                requirementTitle: title,
                requesterName: (req.user as any)?.name || req.user?.email || 'Desconocido'
            }).catch(e => console.error(`Email error for ${admin.email}`, e))
        ));

        // --- IN-APP NOTIFICATION FOR ADMINS ---
        for (const admin of admins) {
            await prisma.notification.create({
                data: {
                    userId: admin.id,
                    title: 'Nuevo Requerimiento Creado',
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
    let { requirements } = req.body;
    const userId = req.user?.id;
    const files = req.files as Express.Multer.File[] || [];

    // DEBUG: Log received files
    console.log('[Mass Create] Received files count:', files.length);
    if (files.length > 0) {
        console.log('[Mass Create] File fieldnames:', files.map(f => f.fieldname));
        console.log('[Mass Create] File details:', files.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, size: f.size })));
    }

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    // Handle JSON string from FormData
    if (typeof requirements === 'string') {
        try {
            requirements = JSON.parse(requirements);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid requirements JSON format' });
        }
    }

    if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
        return res.status(400).json({ error: 'No requirements provided' });
    }

    try {
        // Prepare requirements with attachments
        const requirementsWithAttachments = await Promise.all(requirements.map(async (reqItem: any, index: number) => {
            // Find files for this specific requirement using index mapping
            // Frontend sends files with field name "attachments_0", "attachments_1", etc.
            const itemFiles = files.filter(f => f.fieldname === `attachments_${index}`);

            // DEBUG: Log files per item
            console.log(`[Mass Create] Item ${index}: found ${itemFiles.length} files`);

            // Generate attachment data
            const attachmentData = await processFileUploads(itemFiles, 'requirements');

            return {
                ...reqItem,
                attachments: {
                    create: attachmentData
                }
            };
        }));

        const result = await createRequirementGroup(userId, requirementsWithAttachments);

        // Send Response IMMEDIATELY to improve perceived performance
        res.status(201).json(result);

        // ---- BACKGROUND TASKS (Non-blocking) ----
        // Notify Approvers asynchronously - do not block the response
        (async () => {
            try {
                const approvers = await prisma.user.findMany({
                    where: {
                        role: { in: ['COORDINATOR', 'DIRECTOR'] }
                    }
                });

                const totalAmt = result.requirements.reduce((acc: number, r: any) => acc + Number(r.estimatedAmount || 0), 0);

                // Create all notifications in parallel
                await prisma.notification.createMany({
                    data: approvers.map(approver => ({
                        userId: approver.id,
                        title: 'Nuevo Requerimiento Creado',
                        message: `Se ha creado una solicitud agrupada (ID: ${result.group.id}) con ${requirements.length} items.`,
                        type: 'INFO'
                    }))
                });

                // Send emails in parallel (fire-and-forget)
                Promise.all(approvers.map(approver =>
                    sendRequirementNotificationEmail({
                        to: approver.email,
                        type: 'REQUIREMENT_CREATED',
                        requirementId: result.group.id.toString(),
                        groupId: result.group.id,
                        requirementTitle: `Nuevo Requerimiento Creado de ${(req.user as any)?.name || req.user?.email}`,
                        requesterName: (req.user as any)?.name || req.user?.email || 'Desconocido',
                        amount: totalAmt
                    }).catch(err => console.error(`Failed to send email to ${approver.email}`, err))
                ));
            } catch (bgError) {
                console.error('Background notification error:', bgError);
            }
        })();

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
        const where: any = {
            OR: [
                { createdById: userId },
                {
                    budget: {
                        OR: [
                            { managerId: userId },
                            { subLeaders: { some: { userId: userId } } },
                            { area: { directorId: userId } } // Allow Area Directors to see requirements/asientos of their area's budgets
                        ]
                    }
                }
            ],
            year: year
            // isAsiento filter removed to show everything by default
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
                },
                attachments: true
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
    const {
        status, procurementStatus, remarks, receivedAtSatisfaction, satisfactionComments,
        overallRating, deliveryRating, qualityRating, priceRating
    } = req.body;

    try {
        const requirement = await prisma.requirement.update({
            where: { id },
            data: {
                status: status || undefined,
                procurementStatus: procurementStatus || undefined,
                receivedAtSatisfaction: receivedAtSatisfaction !== undefined ? receivedAtSatisfaction : undefined,
                satisfactionComments: satisfactionComments || undefined
            },
            include: { supplier: true }
        });

        await prisma.historyLog.create({
            data: {
                action: 'STATUS_UPDATED',
                requirementId: requirement.id,
                details: `Cambio de estado a ${status}. Por: ${req.user?.email}. Comentario: ${remarks || 'Sin comentarios'}`
            }
        });

        // Create Supplier Rating if ratings are provided and requirement has a supplier
        if (requirement.supplierId && overallRating && overallRating > 0) {
            // Check if rating already exists for this requirement
            const existingRating = await prisma.supplierRating.findUnique({
                where: { requirementId: id }
            });

            if (!existingRating) {
                await prisma.supplierRating.create({
                    data: {
                        supplierId: requirement.supplierId,
                        requirementId: id,
                        overallRating: Number(overallRating),
                        deliveryRating: Number(deliveryRating) || Number(overallRating),
                        qualityRating: Number(qualityRating) || Number(overallRating),
                        priceRating: Number(priceRating) || Number(overallRating),
                        comment: remarks || satisfactionComments || null,
                        evaluatedById: req.user?.id || ''
                    }
                });

                await prisma.historyLog.create({
                    data: {
                        action: 'SUPPLIER_RATED',
                        requirementId: id,
                        details: `Proveedor ${requirement.supplier?.name} evaluado con ${overallRating}/5 estrellas por ${req.user?.email}`
                    }
                });
            }
        }

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
                    message: `Tu solicitud "${fullReq.title}" ha sido actualizada. Estado: ${translateStatus(status)}`,
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
        deleteAttachmentIds, hasMultiplePayments, suggestedSupplier
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

        // Prepare data based on role


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
                suggestedSupplier: suggestedSupplier === 'null' ? null : suggestedSupplier,
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

        // Log significant changes - track all editable fields
        let changes: string[] = [];

        // Title
        if (title !== undefined && title !== currentReq.title) {
            changes.push(`Título actualizado a "${title}"`);
        }

        // Description
        if (description !== undefined && description !== currentReq.description) {
            changes.push(`Descripción actualizada`);
        }

        // Quantity
        if (quantity !== undefined && quantity !== currentReq.quantity) {
            changes.push(`Cantidad actualizada a ${quantity}`);
        }

        // Actual Amount
        if (actualAmount && parseFloat(actualAmount) !== parseFloat(currentReq.actualAmount?.toString() || '0')) {
            changes.push(`Monto actualizado a $${actualAmount}`);
        }

        // Purchase Order Number (OC)
        const newOC = purchaseOrderNumber === 'null' ? null : purchaseOrderNumber;
        if (purchaseOrderNumber !== undefined && newOC !== currentReq.purchaseOrderNumber) {
            if (newOC) {
                changes.push(`OC actualizada a ${newOC}`);
            } else if (currentReq.purchaseOrderNumber) {
                changes.push(`OC eliminada (era: ${currentReq.purchaseOrderNumber})`);
            }
        }

        // Invoice Number
        const newInvoice = invoiceNumber === 'null' ? null : invoiceNumber;
        if (invoiceNumber !== undefined && newInvoice !== currentReq.invoiceNumber) {
            if (newInvoice) {
                changes.push(`Factura actualizada a ${newInvoice}`);
            } else if (currentReq.invoiceNumber) {
                changes.push(`Factura eliminada (era: ${currentReq.invoiceNumber})`);
            }
        }

        // Delivery Date
        const newDeliveryDate = parseSafeDate(deliveryDate);
        if (deliveryDate !== undefined && newDeliveryDate?.toISOString() !== currentReq.deliveryDate?.toISOString()) {
            if (newDeliveryDate) {
                changes.push(`Fecha acordada actualizada a ${newDeliveryDate.toLocaleDateString('es-CO')}`);
            } else if (currentReq.deliveryDate) {
                changes.push(`Fecha acordada eliminada`);
            }
        }

        // Received Date
        const newReceivedDate = parseSafeDate(receivedDate);
        if (receivedDate !== undefined && newReceivedDate?.toISOString() !== currentReq.receivedDate?.toISOString()) {
            if (newReceivedDate) {
                changes.push(`Fecha de recepción actualizada a ${newReceivedDate.toLocaleDateString('es-CO')}`);
            } else if (currentReq.receivedDate) {
                changes.push(`Fecha de recepción eliminada`);
            }
        }

        // Supplier
        const newSupplierId = (supplierId === 'null' || !supplierId) ? null : supplierId;
        if (supplierId !== undefined && newSupplierId !== currentReq.supplierId) {
            if (newSupplierId) {
                changes.push(`Proveedor asignado`);
            } else if (currentReq.supplierId) {
                changes.push(`Proveedor removido`);
            }
        }

        // Manual Supplier Name
        const newManualSupplier = manualSupplierName === 'null' ? null : manualSupplierName;
        if (manualSupplierName !== undefined && newManualSupplier !== currentReq.manualSupplierName) {
            if (newManualSupplier) {
                changes.push(`Proveedor manual actualizado a ${newManualSupplier}`);
            } else if (currentReq.manualSupplierName) {
                changes.push(`Proveedor manual eliminado`);
            }
        }

        // Category
        if (reqCategory !== undefined && reqCategory !== 'null' && reqCategory !== currentReq.reqCategory) {
            changes.push(`Categoría actualizada a ${reqCategory}`);
        }

        // Procurement Status
        if (procurementStatus !== undefined && procurementStatus !== 'null' && procurementStatus !== currentReq.procurementStatus) {
            changes.push(`Estado del trámite actualizado a ${procurementStatus}`);
        }

        // Has Multiple Payments
        const newHasMultiple = hasMultiplePayments === 'true' || hasMultiplePayments === true;
        if (hasMultiplePayments !== undefined && newHasMultiple !== currentReq.hasMultiplePayments) {
            changes.push(`Pagos múltiples ${newHasMultiple ? 'habilitados' : 'deshabilitados'}`);
        }

        // Attachments
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
            year: year
            // isAsiento filter removed to show everything by default
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

            // Check if user is manager of any budget
            const managedBudgets = await prisma.budget.findMany({
                where: { managerId: userId },
                select: { id: true }
            });
            const managedBudgetIds = managedBudgets.map(b => b.id);

            // Base condition: Created by user
            const orConditions: any[] = [{ createdById: userId }];

            // Add directed areas
            if (directedAreaIds.length > 0) {
                orConditions.push({ areaId: { in: directedAreaIds } });
            }

            // Add managed budgets
            if (managedBudgetIds.length > 0) {
                orConditions.push({ budgetId: { in: managedBudgetIds } });
            }

            where.OR = orConditions;
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
                },
                attachments: true
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
                budget: true,
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
        // Handle Individual Requirements by Creator (Virtual Group)
        if (id === 'individual') {
            const { creatorId } = req.body;
            if (!creatorId) {
                return res.status(400).json({ error: 'Creator ID is required for individual approval' });
            }

            const where: any = {
                status: 'PENDING_APPROVAL',
                groupId: null,
                createdById: creatorId
            };

            const isGlobalViewer = ['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER', 'COORDINATOR', 'AUDITOR'].includes(userRole || '');

            if (!isGlobalViewer) {
                // ... existing access control logic ...
                const directedAreas = await prisma.area.findMany({
                    where: { directorId: userId } as any,
                    select: { id: true }
                });
                const directedAreaIds = directedAreas.map(a => a.id);

                const managedBudgets = await prisma.budget.findMany({
                    where: { managerId: userId },
                    select: { id: true }
                });
                const managedBudgetIds = managedBudgets.map(b => b.id);

                const orConditions: any[] = [{ createdById: userId }];
                if (directedAreaIds.length > 0) orConditions.push({ areaId: { in: directedAreaIds } });
                if (managedBudgetIds.length > 0) orConditions.push({ budgetId: { in: managedBudgetIds } });

                where.OR = orConditions;
            }

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

            // Update all matching individual requirements
            await prisma.requirement.updateMany({
                where,
                data: updateData
            });

            // Check for full approval
            const updatedReqs = await prisma.requirement.findMany({ where });

            for (const req of updatedReqs) {
                const isApproved = (req.coordinatorApproval && req.directorApproval) ||
                    (userRole === 'DIRECTOR' || userRole === 'ADMIN' || userRole === 'DEVELOPER');

                if (isApproved) {
                    await prisma.requirement.update({
                        where: { id: req.id },
                        data: { status: 'APPROVED' }
                    });

                    // Notify
                    await prisma.historyLog.create({
                        data: {
                            action: 'APPROVED',
                            details: `Requerimiento individual ${req.id} aprobado por ${actionLabel} (${req.createdById}). ${comments || ''}`,
                            requirementId: req.id
                        }
                    });

                    // Fetch creator to notify
                    // Note: This might be slow if many requirements. optimization possible.
                    const creator = await prisma.user.findUnique({ where: { id: req.createdById } });
                    if (creator) {
                        await sendRequirementNotificationEmail({
                            to: creator.email,
                            type: 'REQUIREMENT_APPROVED',
                            requirementId: req.id,
                            requirementTitle: req.title,
                            requesterName: creator.name || creator.email,
                            approverName: (req as any)?.user?.name || 'Aprobador'
                        });
                    }
                }
            }
            return res.json({ message: `Solicitudes individuales procesadas por ${actionLabel}` });
        }

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

        // Notify Creator via Email
        const creator = await prisma.user.findUnique({
            where: { id: group.creatorId },
            select: { email: true, name: true }
        });

        if (creator && allApproved) {
            await sendRequirementNotificationEmail({
                to: creator.email,
                type: 'REQUIREMENT_APPROVED',
                requirementId: group.requirements[0].id.toString(),
                groupId: group.id,
                requirementTitle: `Solicitud Agrupada Aprobada`,
                requesterName: creator.name || creator.email,
                approverName: (req.user as any)?.name || req.user?.email
            });
        }

        res.json({ message: `Solicitud aprobada por ${actionLabel}`, allApproved });
    } catch (error: any) {
        res.status(500).json({ error: 'Approval failed', details: error.message });
    }
};

export const rejectRequirementGroup = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { comments } = req.body;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    try {
        // Handle Individual Requirements by Creator (Virtual Group)
        if (id === 'individual') {
            const { creatorId } = req.body;
            if (!creatorId) {
                return res.status(400).json({ error: 'Creator ID is required for individual rejection' });
            }

            const where: any = {
                status: 'PENDING_APPROVAL',
                groupId: null,
                createdById: creatorId
            };

            const isGlobalViewer = ['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER', 'COORDINATOR', 'AUDITOR'].includes(userRole || '');

            if (!isGlobalViewer) {
                // ... existing access control logic ...
                const directedAreas = await prisma.area.findMany({
                    where: { directorId: userId } as any,
                    select: { id: true }
                });
                const directedAreaIds = directedAreas.map(a => a.id);

                const managedBudgets = await prisma.budget.findMany({
                    where: { managerId: userId },
                    select: { id: true }
                });
                const managedBudgetIds = managedBudgets.map(b => b.id);

                const orConditions: any[] = [{ createdById: userId }];
                if (directedAreaIds.length > 0) orConditions.push({ areaId: { in: directedAreaIds } });
                if (managedBudgetIds.length > 0) orConditions.push({ budgetId: { in: managedBudgetIds } });

                where.OR = orConditions;
            }

            // Reject all matching individual requirements
            await prisma.requirement.updateMany({
                where,
                data: {
                    status: 'REJECTED',
                    coordinatorComment: userRole === 'COORDINATOR' ? comments : undefined,
                    directorComment: (userRole === 'DIRECTOR' || userRole === 'ADMIN') ? comments : undefined
                }
            });

            // Notify Rejection
            const rejectedReqs = await prisma.requirement.findMany({ where, select: { id: true, createdById: true, title: true } });
            for (const req of rejectedReqs) {
                const creator = await prisma.user.findUnique({ where: { id: req.createdById } });
                if (creator) {
                    await sendRequirementNotificationEmail({
                        to: creator.email,
                        type: 'REQUIREMENT_REJECTED',
                        requirementId: req.id,
                        requirementTitle: req.title,
                        rejectReason: comments,
                        groupId: 0,
                        requesterName: creator.name || creator.email,
                        approverName: 'Aprobador' // Ideally fetch user name
                    });
                }
            }

            return res.json({ message: 'Solicitudes individuales rechazadas' });
        }

        await prisma.requirement.updateMany({
            where: { groupId: parseInt(id) },
            data: {
                status: 'REJECTED',
                coordinatorComment: userRole === 'COORDINATOR' ? comments : undefined,
                directorComment: (userRole === 'DIRECTOR' || userRole === 'ADMIN') ? comments : undefined
            }
        });

        // Notify Creator of Rejection
        const groupInfo = await prisma.requirementGroup.findUnique({
            where: { id: parseInt(id) },
            select: { creatorId: true, requirements: { select: { id: true, title: true }, take: 1 } }
        });

        if (groupInfo) {
            const creatorUser = await prisma.user.findUnique({ where: { id: groupInfo.creatorId } });
            if (creatorUser) {
                await sendRequirementNotificationEmail({
                    to: creatorUser.email,
                    type: 'REQUIREMENT_REJECTED',
                    requirementId: groupInfo.requirements[0]?.id || '',
                    groupId: parseInt(id),
                    requirementTitle: `Solicitud Rechazada`,
                    rejectReason: comments
                });
            }
        }

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

            // Check if user is manager of any budget
            const managedBudgets = await prisma.budget.findMany({
                where: { managerId: userId },
                select: { id: true }
            });
            const managedBudgetIds = managedBudgets.map(b => b.id);

            const orConditions: any[] = [{ createdById: userId }];

            if (directedAreaIds.length > 0) {
                orConditions.push({ areaId: { in: directedAreaIds } });
            }

            if (managedBudgetIds.length > 0) {
                orConditions.push({ budgetId: { in: managedBudgetIds } });
            }

            where.OR = orConditions;
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

        // Group individual requirements by creator
        const creatorGroups = new Map<string, any[]>();
        individualReqs.forEach(req => {
            if (!creatorGroups.has(req.createdById)) {
                creatorGroups.set(req.createdById, []);
            }
            creatorGroups.get(req.createdById)?.push(req);
        });

        // Add virtual groups for individual requirements
        let virtualGroupId = -1;
        creatorGroups.forEach((reqs, creatorId) => {
            if (reqs.length > 0) {
                const firstReq = reqs[0];
                result.push({
                    id: virtualGroupId--, // Use negative IDs for virtual groups
                    creator: firstReq.createdBy,
                    pdfUrl: null,
                    createdAt: firstReq.createdAt,
                    requirements: reqs
                });
            }
        });

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

    console.log(`[Dashboard] Stats requested by ${req.user?.email} (${userRole}) for year ${year}`);

    try {
        const where: any = {
            year: year,
            isAsiento: false
        };

        const isGlobalViewer = ['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER', 'COORDINATOR', 'AUDITOR'].includes(userRole || '');

        if (!isGlobalViewer) {
            // Simplified filter: Only show user's own requirements
            // Complex budget/subleader filters were causing 500 errors
            where.createdById = userId;
            console.log("[Dashboard] Non-admin user, filtering by createdById:", userId);
        }

        console.log("[Dashboard] Fetching counts with where:", JSON.stringify(where));

        let pending = 0, approved = 0, rejected = 0;

        try {
            // Count pending - only PENDING_APPROVAL is a valid Status enum value
            pending = await prisma.requirement.count({
                where: {
                    ...where,
                    status: 'PENDING_APPROVAL'
                }
            });
            console.log("[Dashboard] Pending count:", pending);
        } catch (pendingErr: any) {
            console.error("[Dashboard] Error counting pending:", pendingErr.message);
        }

        try {
            approved = await prisma.requirement.count({ where: { ...where, status: 'APPROVED' } });
            console.log("[Dashboard] Approved count:", approved);
        } catch (approvedErr: any) {
            console.error("[Dashboard] Error counting approved:", approvedErr.message);
        }

        try {
            rejected = await prisma.requirement.count({ where: { ...where, status: 'REJECTED' } });
            console.log("[Dashboard] Rejected count:", rejected);
        } catch (rejectedErr: any) {
            console.error("[Dashboard] Error counting rejected:", rejectedErr.message);
        }

        // Recent Activity Filters
        const recentWhere: any = {};
        const budgetWhere: any = {};
        const invoiceWhere: any = {};

        if (!isGlobalViewer) {
            // Simplified: only user's own items
            recentWhere.createdById = userId;
            budgetWhere.managerId = userId; // Simplified - just manager, not subleaders
            invoiceWhere.requirement = { createdById: userId };
        }

        console.log("[Dashboard] Fetching recent items...");
        let recentRequirements: any[] = [];
        try {
            recentRequirements = await prisma.requirement.findMany({
                where: recentWhere,
                include: {
                    project: true,
                    area: true,
                    createdBy: { select: { name: true, email: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: 5
            });
        } catch (reqError: any) {
            console.error("[Dashboard] Error fetching recent requirements:", reqError.message);
        }

        console.log("[Dashboard] Fetching budgets...");
        let recentBudgets: any[] = [];
        try {
            recentBudgets = await prisma.budget.findMany({
                where: budgetWhere,
                include: {
                    project: true,
                    area: true,
                    createdBy: { select: { name: true, email: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: 3
            });
        } catch (budgetError) {
            console.error("[Dashboard] Error fetching budgets:", budgetError);
        }

        console.log("[Dashboard] Fetching invoices...");
        let recentInvoices: any[] = [];
        try {
            recentInvoices = await prisma.invoice.findMany({
                where: invoiceWhere,
                include: {
                    supplier: true,
                    requirement: { select: { title: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: 3
            });
        } catch (invoiceError) {
            console.error("[Dashboard] Error fetching invoices:", invoiceError);
        }

        const allActivity: any[] = [
            ...recentRequirements.map(r => ({
                id: r.id,
                type: 'requirement',
                title: r.title,
                status: r.status,
                totalAmount: Number(r.actualAmount?.toString() || r.estimatedAmount?.toString() || 0),
                createdAt: r.createdAt,
                project: r.project?.name,
                area: r.area?.name,
                createdBy: r.createdBy?.name || r.createdBy?.email
            })),
            ...recentBudgets.map(b => ({
                id: b.id,
                type: 'budget',
                title: b.title,
                status: b.status,
                totalAmount: Number(b.amount?.toString() || 0),
                createdAt: b.createdAt,
                project: b.project?.name,
                area: b.area?.name,
                createdBy: b.createdBy?.name || b.createdBy?.email
            })),
            ...recentInvoices.map(i => ({
                id: i.id,
                type: 'invoice',
                title: `Factura ${i.invoiceNumber}`,
                status: i.status || 'RECEIVED',
                totalAmount: Number(i.amount?.toString() || 0),
                createdAt: i.createdAt,
                project: i.requirement?.title || 'Sin requerimiento',
                area: i.supplier?.name || 'Proveedor',
                createdBy: 'Sistema'
            }))
        ];

        // Sort combined activity by date descending
        allActivity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Take top 4 (compact view)
        const recent = allActivity.slice(0, 4);

        // Sum totals logic (unchanged)
        let totalAmount = 0;
        try {
            const totalReqs = await prisma.requirement.findMany({
                where: { ...where, status: { not: 'REJECTED' } },
                select: { actualAmount: true, estimatedAmount: true }
            });

            totalAmount = totalReqs.reduce((sum, r) => {
                return sum + Number(r.actualAmount?.toString() || r.estimatedAmount?.toString() || 0);
            }, 0);
        } catch (totalErr: any) {
            console.error("[Dashboard] Error fetching total amount:", totalErr.message);
        }

        res.json({
            pending,
            approved,
            rejected,
            totalAmount,
            recent
        });

    } catch (error: any) {
        console.error("[Dashboard] FATAL Error fetching dashboard stats:", error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats', details: error.message });
    }
};

// Get pending approval count for sidebar badge
export const getPendingApprovalCount = async (req: AuthRequest, res: Response) => {
    const year = new Date().getFullYear();
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
        // Only roles that can approve should see this count
        if (!['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER'].includes(userRole || '')) {
            return res.json({ count: 0 });
        }

        const where: any = {
            year: year,
            status: 'PENDING_APPROVAL',
            isAsiento: false
        };

        const isGlobalApprover = ['ADMIN', 'DEVELOPER'].includes(userRole || '');

        if (!isGlobalApprover) {
            where.OR = [];

            // 1. Requirements directed to user's area
            try {
                const directedAreas = await prisma.area.findMany({
                    where: { directorId: userId } as any,
                    select: { id: true }
                });
                const directedAreaIds = directedAreas.map(a => a.id);
                if (directedAreaIds.length > 0) {
                    where.OR.push({ areaId: { in: directedAreaIds } });
                }
            } catch (e) { console.error("Error fetching directed areas for count:", e); }

            // 2. Budget manager or sub-leader
            where.OR.push({
                budget: {
                    OR: [
                        { managerId: userId },
                        { subLeaders: { some: { userId: userId } } }
                    ]
                }
            });

            // If user has no permissions (empty OR), this query might return 0 by default if we handle it right.
            // But let's assume if where.OR is empty, they see nothing.
        }

        const count = await prisma.requirement.count({ where });
        res.json({ count });

    } catch (error: any) {
        console.error("Error fetching pending approval count:", error);
        res.json({ count: 0 });
    }
};



// Create an Asiento (pre-approved requirement)
export const createAsiento = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Only ADMIN, DIRECTOR, COORDINATOR, DEVELOPER can create asientos
    if (!['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'].includes(userRole || '')) {
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
        hasMultiplePayments,
        groupId
    } = req.body;

    // ========== VALIDATIONS FIRST (before any DB operations) ==========

    // Validate groupId - REQUIRED for asientos
    if (!groupId || groupId === 'null' || groupId === '' || isNaN(parseInt(groupId))) {
        return res.status(400).json({
            error: 'El asiento debe estar vinculado a un número de Requerimiento existente'
        });
    }

    const existingGroup = await prisma.requirementGroup.findUnique({
        where: { id: parseInt(groupId) }
    });

    if (!existingGroup) {
        return res.status(400).json({
            error: `El Requerimiento #${groupId} no existe. Por favor ingresa un número de requerimiento válido.`
        });
    }

    const validGroupId = parseInt(groupId);

    try {
        // Use transaction to ensure atomicity - budget only decremented if asiento created successfully
        const result = await prisma.$transaction(async (tx) => {
            // Create the asiento first
            const asiento = await tx.requirement.create({
                data: {
                    title,
                    description,
                    quantity,
                    totalAmount: (totalAmount && totalAmount !== 'null' && !isNaN(parseFloat(totalAmount))) ? parseFloat(totalAmount) : null,
                    actualAmount: (actualAmount && actualAmount !== 'null' && !isNaN(parseFloat(actualAmount))) ? parseFloat(actualAmount) : null,
                    projectId: (projectId && projectId !== 'null') ? projectId : undefined,
                    areaId: (areaId && areaId !== 'null') ? areaId : undefined,
                    supplierId: (supplierId && supplierId !== 'null') ? supplierId : null,
                    manualSupplierName: manualSupplierName === 'null' ? null : manualSupplierName,
                    budgetId: (budgetId && budgetId !== 'null') ? budgetId : null,
                    reqCategory: reqCategory || 'COMPRA',
                    purchaseOrderNumber: purchaseOrderNumber === 'null' ? null : purchaseOrderNumber,
                    invoiceNumber: invoiceNumber === 'null' ? null : invoiceNumber,
                    createdById: userId!,
                    year: new Date().getFullYear(),
                    isAsiento: true,
                    hasMultiplePayments: hasMultiplePayments === 'true' || hasMultiplePayments === true,
                    status: 'APPROVED',  // Auto-approved for asientos
                    procurementStatus: 'EN_TRAMITE',
                    groupId: validGroupId,
                    attachments: {
                        create: await processFileUploads(req.files as Express.Multer.File[] || [], 'asientos')
                    }
                },
                include: {
                    project: true,
                    area: true,
                    supplier: true,
                    attachments: true
                }
            });

            // Only decrement budget AFTER asiento is created successfully (within transaction)
            if (budgetId && budgetId !== 'null' && totalAmount && !isNaN(parseFloat(totalAmount))) {
                await tx.budget.update({
                    where: { id: budgetId },
                    data: {
                        available: { decrement: parseFloat(totalAmount) }
                    }
                });
            }

            // Log creation (within transaction)
            await tx.historyLog.create({
                data: {
                    action: 'CREATED_ASIENTO',
                    requirementId: asiento.id,
                    details: `Asiento contable creado por ${req.user?.email}`
                }
            });

            return asiento;
        });

        res.status(201).json(result);
    } catch (error: any) {
        console.error("Error creating asiento:", error);
        res.status(500).json({ error: 'Error al crear el asiento', details: error.message });
    }
};

export const updateMassRequirements = async (req: AuthRequest, res: Response) => {
    const { ids, updates } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No requirement IDs provided' });
    }
    if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
    }

    try {
        const allowedUpdates: any = {};
        if (updates.supplierId !== undefined) allowedUpdates.supplierId = updates.supplierId;
        if (updates.manualSupplierName !== undefined) allowedUpdates.manualSupplierName = updates.manualSupplierName;
        if (updates.invoiceNumber !== undefined) allowedUpdates.invoiceNumber = updates.invoiceNumber;
        if (updates.purchaseOrderNumber !== undefined) allowedUpdates.purchaseOrderNumber = updates.purchaseOrderNumber;
        if (updates.procurementStatus !== undefined) allowedUpdates.procurementStatus = updates.procurementStatus;
        if (updates.status !== undefined) allowedUpdates.status = updates.status;
        if (updates.actualAmount !== undefined) allowedUpdates.actualAmount = updates.actualAmount;
        if (updates.observations !== undefined) {
            // If handling observations, consider appending to history or updating a notes field if exists.
            // For now we will assume simple field updates.
        }

        const result = await prisma.requirement.updateMany({
            where: {
                id: { in: ids }
            },
            data: allowedUpdates
        });

        // Log the mass update
        if (result.count > 0) {
            await prisma.historyLog.createMany({
                data: ids.map((id: string) => ({
                    action: 'MASS_UPDATE',
                    requirementId: id,
                    details: `Updated via mass edit by ${req.user?.email}`
                }))
            });
        }

        res.json({ message: 'Requirements updated successfully', count: result.count });
    } catch (error: any) {
        console.error("Mass update error:", error);
        res.status(500).json({ error: 'Failed to update requirements', details: error.message });
    }
};
