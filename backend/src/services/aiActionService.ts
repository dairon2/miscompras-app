import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { getEmailTemplate, sendContractEmail, sendEmail } from './emailService';
import { checkSubmissionAllowed } from './submissionRulesService';
import { getServiceContractTemplate } from '../utils/contractTemplates';
import {
    AiActor,
    AiActionPayload,
    AiMutableAction,
    canPerformAiAction,
    signAiAction,
    verifyAiAction
} from './aiSecurityService';

export type AiPendingAction = {
    token: string;
    action: AiMutableAction;
    title: string;
    description: string;
    confirmLabel: string;
    severity: 'info' | 'warning';
};

export type AiActionResponse = {
    reply: string;
    actions?: Array<{ label: string; type: 'link' | 'prompt' | 'download'; value: string }>;
    pendingAction?: AiPendingAction;
};

type RequestMetadata = { ipAddress?: string; userAgent?: string };

const formatMoney = (amount: unknown) => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
}).format(Number(amount) || 0);

const normalize = (value: unknown) => String(value || '').trim().toLocaleLowerCase('es-CO');

const createPendingAction = (
    actor: AiActor,
    action: AiMutableAction,
    params: Record<string, unknown>,
    presentation: Omit<AiPendingAction, 'token' | 'action'>
): AiPendingAction => {
    const payload: AiActionPayload = {
        requestId: crypto.randomUUID(),
        userId: actor.id,
        action,
        params
    };

    return { action, token: signAiAction(payload), ...presentation };
};

const permissionDenied = (action: AiMutableAction): AiActionResponse => ({
    reply: `No tienes permisos para ejecutar la acción ${action}. Puedes seguir usando el asistente para consultas dentro de tu alcance.`
});

const resolveSupplier = async (name: unknown) => {
    const query = String(name || '').trim();
    if (query.length < 2) return { error: 'Indica el nombre completo del proveedor.' } as const;

    const matches = await prisma.supplier.findMany({
        where: { name: { contains: query, mode: 'insensitive' } },
        take: 6,
        select: { id: true, name: true, nit: true, taxId: true, contactEmail: true }
    });
    const exact = matches.filter(item => normalize(item.name) === normalize(query));
    const candidates = exact.length > 0 ? exact : matches;
    if (candidates.length !== 1) {
        return { error: candidates.length === 0
            ? `No encontré el proveedor "${query}".`
            : `Encontré ${candidates.length} proveedores similares. Usa el nombre exacto o realiza la acción desde el formulario.` } as const;
    }
    return { supplier: candidates[0] } as const;
};

const resolveSingleRequirement = async (groupId: unknown) => {
    const numericGroupId = Number(groupId);
    if (!Number.isInteger(numericGroupId) || numericGroupId <= 0) return { error: 'Indica un número de requerimiento válido.' } as const;
    const requirements = await prisma.requirement.findMany({
        where: { groupId: numericGroupId },
        take: 3,
        select: { id: true, groupId: true, title: true, status: true, supplierId: true, supplier: { select: { name: true } } }
    });
    if (requirements.length !== 1) {
        return { error: requirements.length === 0
            ? `No encontré el requerimiento #${numericGroupId}.`
            : `El número #${numericGroupId} contiene varios ítems. Para evitar modificar el ítem equivocado, realiza esta acción desde el detalle del requerimiento.` } as const;
    }
    return { requirement: requirements[0] } as const;
};

export const proposeAiAction = async (
    action: string,
    rawParams: Record<string, unknown>,
    actor: AiActor
): Promise<AiActionResponse | null> => {
    if (action === 'DELETE_SUPPLIER') {
        return { reply: 'Por seguridad, el chatbot no elimina proveedores. Utiliza el módulo de proveedores, donde se validan relaciones y dependencias antes de cualquier eliminación.' };
    }
    if (!['CREATE_REQ', 'ASSIGN_SUPPLIER', 'APPROVE_REQ', 'SEND_QUOTE', 'GENERATE_CONTRACT'].includes(action)) return null;

    const mutableAction = action as AiMutableAction;
    if (!canPerformAiAction(actor.role, mutableAction)) return permissionDenied(mutableAction);

    if (mutableAction === 'CREATE_REQ') {
        const title = String(rawParams.title || '').trim();
        const projectName = String(rawParams.projectName || '').trim();
        const areaName = String(rawParams.areaName || '').trim();
        const amount = Number(rawParams.amount);
        if (!title || !projectName || !areaName || !Number.isFinite(amount) || amount <= 0) {
            return { reply: 'Para preparar el requerimiento necesito título, valor, proyecto y área. Ejemplo: “Crea un requerimiento de papelería por 500000 para el proyecto Mantenimiento, área Administrativa”.' };
        }
        const [projects, areas] = await Promise.all([
            prisma.project.findMany({ where: { name: { contains: projectName, mode: 'insensitive' } }, take: 3, select: { id: true, name: true } }),
            prisma.area.findMany({ where: { name: { contains: areaName, mode: 'insensitive' } }, take: 3, select: { id: true, name: true } })
        ]);
        if (projects.length !== 1 || areas.length !== 1) {
            return { reply: `No pude identificar de forma única ${projects.length !== 1 ? 'el proyecto' : 'el área'}. Escribe el nombre exacto antes de continuar.` };
        }
        return {
            reply: 'Preparé el requerimiento. Revisa los datos antes de confirmar.',
            pendingAction: createPendingAction(actor, mutableAction, {
                title,
                description: String(rawParams.description || '').trim(),
                amount,
                projectId: projects[0].id,
                areaId: areas[0].id
            }, {
                title: `Crear requerimiento: ${title}`,
                description: `${formatMoney(amount)} · Proyecto ${projects[0].name} · Área ${areas[0].name}`,
                confirmLabel: 'Crear requerimiento',
                severity: 'warning'
            })
        };
    }

    if (mutableAction === 'ASSIGN_SUPPLIER') {
        const [supplierResult, requirementResult] = await Promise.all([
            resolveSupplier(rawParams.supplierName),
            resolveSingleRequirement(rawParams.groupId)
        ]);
        if ('error' in supplierResult) return { reply: supplierResult.error || 'No pude identificar el proveedor.' };
        if ('error' in requirementResult) return { reply: requirementResult.error || 'No pude identificar el requerimiento.' };
        const { supplier } = supplierResult;
        const { requirement } = requirementResult;
        return {
            reply: 'La asignación está lista para confirmar.',
            pendingAction: createPendingAction(actor, mutableAction, {
                supplierId: supplier.id,
                requirementId: requirement.id,
                expectedSupplierId: requirement.supplierId
            }, {
                title: `Asignar proveedor al requerimiento #${requirement.groupId}`,
                description: `${requirement.title} · ${requirement.supplier?.name || 'Sin proveedor'} → ${supplier.name}`,
                confirmLabel: 'Confirmar asignación',
                severity: 'warning'
            })
        };
    }

    if (mutableAction === 'APPROVE_REQ') {
        const result = await resolveSingleRequirement(rawParams.groupId);
        if ('error' in result) return { reply: result.error || 'No pude identificar el requerimiento.' };
        if (result.requirement.status !== 'PENDING_APPROVAL') return { reply: `El requerimiento #${result.requirement.groupId} ya está en estado ${result.requirement.status}.` };
        return {
            reply: 'La aprobación está lista para confirmar.',
            pendingAction: createPendingAction(actor, mutableAction, {
                requirementId: result.requirement.id,
                expectedStatus: result.requirement.status
            }, {
                title: `Aprobar requerimiento #${result.requirement.groupId}`,
                description: result.requirement.title,
                confirmLabel: 'Aprobar requerimiento',
                severity: 'warning'
            })
        };
    }

    const supplierResult = mutableAction === 'SEND_QUOTE' ? await resolveSupplier(rawParams.supplierName) : null;
    if (supplierResult && 'error' in supplierResult) return { reply: supplierResult.error || 'No pude identificar el proveedor.' };

    if (mutableAction === 'SEND_QUOTE' && supplierResult && 'supplier' in supplierResult) {
        const supplier = supplierResult.supplier;
        const product = String(rawParams.product || '').trim();
        if (!supplier.contactEmail || !product) return { reply: !product ? 'Indica el producto o servicio que deseas cotizar.' : `El proveedor ${supplier.name} no tiene correo registrado.` };
        return {
            reply: 'El correo de solicitud de cotización está listo. No se enviará hasta que confirmes.',
            pendingAction: createPendingAction(actor, mutableAction, {
                supplierId: supplier.id,
                expectedEmail: supplier.contactEmail,
                product
            }, {
                title: `Enviar solicitud a ${supplier.name}`,
                description: `${supplier.contactEmail} · ${product}`,
                confirmLabel: 'Enviar correo',
                severity: 'warning'
            })
        };
    }

    if (mutableAction === 'GENERATE_CONTRACT') {
        const result = await resolveSingleRequirement(rawParams.groupId);
        if ('error' in result) return { reply: result.error || 'No pude identificar el requerimiento.' };
        const requirement = await prisma.requirement.findUnique({
            where: { id: result.requirement.id },
            include: { supplier: true, project: true, createdBy: { select: { name: true, email: true } } }
        });
        if (!requirement?.supplier?.contactEmail) return { reply: 'El requerimiento debe tener un proveedor con correo antes de generar el contrato.' };
        return {
            reply: 'El contrato está listo para generación y envío. Revisa el destinatario antes de confirmar.',
            pendingAction: createPendingAction(actor, mutableAction, {
                requirementId: requirement.id,
                expectedSupplierId: requirement.supplierId,
                expectedEmail: requirement.supplier.contactEmail
            }, {
                title: `Generar contrato del requerimiento #${requirement.groupId}`,
                description: `${requirement.supplier.name} · ${requirement.supplier.contactEmail} · ${formatMoney(requirement.totalAmount || requirement.estimatedAmount)}`,
                confirmLabel: 'Generar y enviar contrato',
                severity: 'warning'
            })
        };
    }

    return null;
};

const reserveAuditLog = async (payload: AiActionPayload, actor: AiActor, metadata: RequestMetadata) => {
    try {
        await prisma.aiAuditLog.create({
            data: {
                requestId: payload.requestId,
                userId: actor.id,
                action: payload.action,
                status: 'EXECUTING',
                details: payload.params as Prisma.InputJsonValue,
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent
            }
        });
    } catch (error: any) {
        if (error?.code === 'P2002') throw new Error('Esta acción ya fue procesada o está en ejecución.');
        throw error;
    }
};

const completeAuditLog = (requestId: string, status: 'COMPLETED' | 'FAILED', result?: Record<string, unknown>) => prisma.aiAuditLog.update({
    where: { requestId },
    data: { status, ...(result ? { details: result as Prisma.InputJsonValue } : {}) }
});

export const confirmAiAction = async (
    token: string,
    authenticatedActor: AiActor,
    metadata: RequestMetadata
): Promise<AiActionResponse> => {
    const payload = verifyAiAction(token);
    if (payload.userId !== authenticatedActor.id) throw new Error('La confirmación pertenece a otro usuario.');

    const currentUser = await prisma.user.findUnique({
        where: { id: authenticatedActor.id },
        select: { id: true, email: true, role: true, areaId: true, invoiceValidationScope: true, isActive: true }
    });
    if (!currentUser?.isActive) throw new Error('El usuario ya no está activo.');
    const actor: AiActor = currentUser;
    if (!canPerformAiAction(actor.role, payload.action)) throw new Error('Tus permisos cambiaron y ya no puedes ejecutar esta acción.');

    await reserveAuditLog(payload, actor, metadata);

    try {
        let response: AiActionResponse;
        if (payload.action === 'CREATE_REQ') {
            const submission = await checkSubmissionAllowed(actor.role);
            if (!submission.canSubmit) throw new Error(submission.message);
            const params = payload.params as any;
            const [project, area] = await Promise.all([
                prisma.project.findUnique({ where: { id: params.projectId }, select: { id: true, name: true } }),
                prisma.area.findUnique({ where: { id: params.areaId }, select: { id: true, name: true } })
            ]);
            if (!project || !area) throw new Error('El proyecto o el área ya no existen.');
            const result = await prisma.$transaction(async tx => {
                const group = await tx.requirementGroup.create({ data: { creatorId: actor.id } });
                const requirement = await tx.requirement.create({
                    data: {
                        title: params.title,
                        description: params.description || '',
                        quantity: '1',
                        estimatedAmount: params.amount,
                        totalAmount: params.amount,
                        projectId: project.id,
                        areaId: area.id,
                        groupId: group.id,
                        createdById: actor.id,
                        year: new Date().getFullYear(),
                        status: 'PENDING_APPROVAL',
                        procurementStatus: 'PENDIENTE',
                        reqCategory: 'COMPRA'
                    }
                });
                await tx.historyLog.create({ data: { requirementId: requirement.id, action: 'AI_CREATED', details: `Creado y confirmado por ${actor.email}` } });
                return requirement;
            });
            response = { reply: `Requerimiento #${result.groupId} creado correctamente y pendiente de aprobación.`, actions: [{ label: 'Ver requerimiento', type: 'link', value: `/requirements/${result.id}` }] };
        } else if (payload.action === 'ASSIGN_SUPPLIER') {
            const params = payload.params as any;
            const result = await prisma.$transaction(async tx => {
                const requirement = await tx.requirement.findUnique({ where: { id: params.requirementId }, select: { id: true, groupId: true, title: true, supplierId: true } });
                const supplier = await tx.supplier.findUnique({ where: { id: params.supplierId }, select: { id: true, name: true } });
                if (!requirement || !supplier) throw new Error('El requerimiento o proveedor ya no existe.');
                if ((requirement.supplierId || null) !== (params.expectedSupplierId || null)) throw new Error('El proveedor del requerimiento cambió; consulta nuevamente antes de confirmar.');
                await tx.requirement.update({ where: { id: requirement.id }, data: { supplierId: supplier.id } });
                await tx.historyLog.create({ data: { requirementId: requirement.id, action: 'AI_SUPPLIER_ASSIGNED', details: `${supplier.name} asignado por ${actor.email}` } });
                return { requirement, supplier };
            });
            response = { reply: `${result.supplier.name} fue asignado al requerimiento #${result.requirement.groupId}.`, actions: [{ label: 'Ver requerimiento', type: 'link', value: `/requirements/${result.requirement.id}` }] };
        } else if (payload.action === 'APPROVE_REQ') {
            const params = payload.params as any;
            const result = await prisma.$transaction(async tx => {
                const updated = await tx.requirement.updateMany({ where: { id: params.requirementId, status: params.expectedStatus }, data: { status: 'APPROVED' } });
                if (updated.count !== 1) throw new Error('El requerimiento cambió; consulta nuevamente antes de aprobar.');
                const requirement = await tx.requirement.findUniqueOrThrow({ where: { id: params.requirementId }, select: { id: true, groupId: true } });
                await tx.historyLog.create({ data: { requirementId: requirement.id, action: 'AI_APPROVED', details: `Aprobado por ${actor.email}` } });
                return requirement;
            });
            response = { reply: `Requerimiento #${result.groupId} aprobado correctamente.`, actions: [{ label: 'Ver requerimiento', type: 'link', value: `/requirements/${result.id}` }] };
        } else if (payload.action === 'SEND_QUOTE') {
            const params = payload.params as any;
            const supplier = await prisma.supplier.findUnique({ where: { id: params.supplierId }, select: { name: true, contactEmail: true } });
            if (!supplier?.contactEmail || supplier.contactEmail !== params.expectedEmail) throw new Error('El correo del proveedor cambió; prepara nuevamente la solicitud.');
            const subject = `Solicitud de Cotización - ${params.product}`;
            const html = getEmailTemplate(subject, `<p>Estimado ${supplier.name},</p><p>Solicitamos cotización para: ${params.product}.</p><p>Gracias.</p>`);
            await sendEmail(supplier.contactEmail, subject, html);
            response = { reply: `Solicitud de cotización enviada a ${supplier.contactEmail}.` };
        } else {
            const params = payload.params as any;
            const requirement = await prisma.requirement.findUnique({
                where: { id: params.requirementId },
                include: { supplier: true, project: true, createdBy: { select: { name: true, email: true } } }
            });
            if (!requirement?.supplier?.contactEmail || requirement.supplierId !== params.expectedSupplierId || requirement.supplier.contactEmail !== params.expectedEmail) {
                throw new Error('El requerimiento o el destinatario cambió; prepara nuevamente el contrato.');
            }
            const contractNumber = `MC-${requirement.groupId}-${Date.now().toString(36).toUpperCase()}`;
            const contractData = {
                contractNumber,
                contractDate: new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
                supplierName: requirement.supplier.name,
                supplierNit: requirement.supplier.nit || requirement.supplier.taxId || 'N/A',
                supplierEmail: requirement.supplier.contactEmail,
                supplierPhone: requirement.supplier.contactPhone || undefined,
                supplierAddress: requirement.supplier.address || undefined,
                requirementGroupId: requirement.groupId!,
                requirementTitle: requirement.title,
                requirementDescription: requirement.description || undefined,
                amount: Number(requirement.totalAmount || requirement.estimatedAmount || 0),
                projectName: requirement.project?.name || 'N/A',
                projectCode: requirement.project?.code || undefined,
                requesterName: requirement.createdBy?.name || requirement.createdBy?.email || 'N/A'
            };
            await sendContractEmail({
                to: requirement.supplier.contactEmail,
                supplierName: requirement.supplier.name,
                contractNumber,
                requirementTitle: requirement.title,
                amount: contractData.amount,
                contractHtml: getServiceContractTemplate(contractData)
            });
            response = { reply: `Contrato ${contractNumber} generado y enviado a ${requirement.supplier.contactEmail}.` };
        }

        await completeAuditLog(payload.requestId, 'COMPLETED', { ...payload.params, result: response.reply })
            .catch(error => console.error('[AI AUDIT] Could not mark action as completed:', error));
        return response;
    } catch (error: any) {
        await completeAuditLog(payload.requestId, 'FAILED', { ...payload.params, error: error.message }).catch(() => undefined);
        throw error;
    }
};
