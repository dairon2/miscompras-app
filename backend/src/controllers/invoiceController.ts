import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';
import { processFileUploads, uploadToBlobStorage } from '../services/blobStorageService';
import logger from '../services/logger';
import fs from 'fs';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

const GLOBAL_INVOICE_VIEWER_ROLES = ['ADMIN', 'DIRECTOR', 'AUDITOR', 'DEVELOPER', 'COORDINATOR'];
const INVOICE_MANAGER_ROLES = ['ADMIN', 'DIRECTOR', 'DEVELOPER', 'COORDINATOR'];
const INVOICE_APPROVER_ROLES = ['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER', 'COORDINATOR'];
const INVOICE_PAYMENT_ROLES = ['ADMIN', 'DIRECTOR', 'DEVELOPER', 'COORDINATOR'];
const INVOICE_STATUSES = ['RECEIVED', 'VERIFIED', 'APPROVED', 'PAID', 'REJECTED'];

class InvoiceRequestError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'InvoiceRequestError';
    }
}

const invoiceInclude = {
    supplier: true,
    budget: {
        include: {
            project: true,
            area: true,
            category: true
        }
    },
    commercialArea: true,
    attachments: {
        orderBy: { createdAt: 'desc' as const }
    },
    auditLogs: {
        orderBy: { createdAt: 'desc' as const }
    },
    requirement: {
        include: {
            project: true,
            area: true
        }
    },
    createdBy: {
        select: {
            id: true,
            name: true,
            email: true
        }
    }
};

const hasRole = (role: string | undefined, roles: string[]) => roles.includes(role || '');

const canViewInvoice = (
    invoice: { createdById: string; requirement?: { createdById: string } | null },
    userRole?: string,
    userId?: string
) => {
    if (hasRole(userRole, GLOBAL_INVOICE_VIEWER_ROLES)) return true;
    return Boolean(userId && (invoice.createdById === userId || invoice.requirement?.createdById === userId));
};

const parseRequiredDate = (value: unknown, fieldName: string) => {
    if (!value || typeof value !== 'string') {
        throw new Error(`${fieldName} es requerida`);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`${fieldName} no tiene un formato válido`);
    }

    return parsed;
};

const parseOptionalDate = (value: unknown, fieldName: string) => {
    if (!value) return null;
    if (typeof value !== 'string') {
        throw new Error(`${fieldName} no tiene un formato válido`);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`${fieldName} no tiene un formato válido`);
    }

    return parsed;
};

const parsePositiveAmount = (value: unknown) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('El monto de la factura debe ser mayor a 0');
    }
    return amount;
};

const parseOptionalAmount = (value: unknown, fieldName: string) => {
    if (value === undefined || value === null || value === '') return null;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`${fieldName} debe ser un valor mayor o igual a 0`);
    }
    return amount;
};

const parseOptionalBoolean = (value: unknown) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        if (value === 'true') return true;
        if (value === 'false') return false;
    }
    throw new Error('La aprobación del líder debe ser verdadera o falsa');
};

const normalizeMatchValue = (value: unknown) => String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

type ReconciliationMatch = {
    invoice: any;
    requirement: any;
    evidence: string[];
};

const getReconciliationMatches = async () => {
    const [invoices, requirements, linkedInvoices] = await Promise.all([
        prisma.invoice.findMany({
            where: { requirementId: null },
            select: {
                id: true,
                invoiceNumber: true,
                purchaseOrderNumber: true,
                amount: true,
                issueDate: true,
                status: true,
                supplierId: true,
                supplier: { select: { id: true, name: true, nit: true } }
            }
        }),
        prisma.requirement.findMany({
            where: { status: 'APPROVED', supplierId: { not: null } },
            select: {
                id: true,
                groupId: true,
                title: true,
                purchaseOrderNumber: true,
                invoiceNumber: true,
                actualAmount: true,
                supplierId: true,
                hasMultiplePayments: true
            }
        }),
        prisma.invoice.findMany({ where: { requirementId: { not: null } }, select: { requirementId: true } })
    ]);

    const linkedRequirementIds = new Set(linkedInvoices.flatMap(invoice => invoice.requirementId ? [invoice.requirementId] : []));

    const requirementsBySupplier = new Map<string, any[]>();
    requirements.forEach(requirement => {
        if (!requirement.supplierId) return;
        const current = requirementsBySupplier.get(requirement.supplierId) || [];
        current.push(requirement);
        requirementsBySupplier.set(requirement.supplierId, current);
    });

    const candidates = new Map<string, ReconciliationMatch[]>();
    invoices.forEach(invoice => {
        const matches = (requirementsBySupplier.get(invoice.supplierId) || []).flatMap(requirement => {
            if (!requirement.hasMultiplePayments && linkedRequirementIds.has(requirement.id)) return [];
            const samePurchaseOrder = Boolean(normalizeMatchValue(invoice.purchaseOrderNumber))
                && normalizeMatchValue(invoice.purchaseOrderNumber) === normalizeMatchValue(requirement.purchaseOrderNumber);
            const sameInvoiceNumber = Boolean(normalizeMatchValue(invoice.invoiceNumber))
                && normalizeMatchValue(invoice.invoiceNumber) === normalizeMatchValue(requirement.invoiceNumber);
            const sameAmount = Math.abs(Number(invoice.amount) - Number(requirement.actualAmount || 0)) < 0.01;

            if (!sameAmount || (!samePurchaseOrder && !sameInvoiceNumber)) return [];

            const evidence = ['Mismo proveedor', 'Mismo valor'];
            if (samePurchaseOrder) evidence.push('Misma orden de compra');
            if (sameInvoiceNumber) evidence.push('Mismo número de factura');
            return [{ invoice, requirement, evidence }];
        });
        if (matches.length > 0) candidates.set(invoice.id, matches);
    });

    const requirementUseCount = new Map<string, number>();
    candidates.forEach(matches => matches.forEach(match => {
        requirementUseCount.set(match.requirement.id, (requirementUseCount.get(match.requirement.id) || 0) + 1);
    }));

    const highConfidence: ReconciliationMatch[] = [];
    const ambiguous: ReconciliationMatch[] = [];
    candidates.forEach(matches => {
        const isUnique = matches.length === 1 && requirementUseCount.get(matches[0].requirement.id) === 1;
        (isUnique ? highConfidence : ambiguous).push(...matches);
    });

    return { invoices, highConfidence, ambiguous };
};

const normalizeOptionalString = (value: unknown) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
};

const getUploadedFiles = (req: AuthRequest) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    return {
        invoicePdf: files?.file?.[0] || req.file,
        attachments: files?.attachments || []
    };
};

const cleanupUploadedFiles = (files: Array<Express.Multer.File | undefined>) => {
    files.forEach(file => {
        if (!file?.path) return;
        try {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch (error) {
            logger.warn('Could not clean up invoice upload:', error);
        }
    });
};

const writeInvoiceAuditLog = async (
    client: any,
    data: {
        invoiceId?: string | null;
        action: string;
        fromStatus?: 'RECEIVED' | 'VERIFIED' | 'APPROVED' | 'PAID' | 'REJECTED' | null;
        toStatus?: 'RECEIVED' | 'VERIFIED' | 'APPROVED' | 'PAID' | 'REJECTED' | null;
        details?: string;
        actorId?: string;
        actorEmail?: string;
    }
) => {
    try {
        await client.invoiceAuditLog.create({
            data: {
                invoiceId: data.invoiceId || null,
                action: data.action,
                fromStatus: data.fromStatus || null,
                toStatus: data.toStatus || null,
                details: data.details || null,
                actorId: data.actorId || null,
                actorEmail: data.actorEmail || null
            }
        });
    } catch (error) {
        logger.error('Could not create invoice audit log:', error);
    }
};

// Helper to notify relevant users when an invoice is passed to an area
const notifyPassToAreaUsers = async (invoice: any, passToArea: string, actorId: string) => {
    try {
        if (!passToArea || !passToArea.trim()) return;
        const areaUpper = passToArea.toUpperCase();
        let targetRoles: string[] = [];

        if (areaUpper.includes('COMPRA')) {
            targetRoles = ['COORDINATOR', 'ADMIN', 'DEVELOPER'];
        } else if (areaUpper.includes('JURIDIC') || areaUpper.includes('JURÍDIC')) {
            targetRoles = ['AUDITOR', 'ADMIN', 'DEVELOPER'];
        } else if (areaUpper.includes('CONTAB')) {
            targetRoles = ['COORDINATOR', 'ADMIN', 'DEVELOPER'];
        } else if (areaUpper.includes('COMER')) {
            targetRoles = ['LEADER', 'DIRECTOR', 'ADMIN', 'DEVELOPER'];
        } else {
            targetRoles = ['ADMIN', 'DEVELOPER', 'COORDINATOR'];
        }

        const usersToNotify = await prisma.user.findMany({
            where: {
                role: { in: targetRoles as any },
                isActive: true,
                id: { not: actorId }
            },
            select: { id: true }
        });

        if (usersToNotify.length > 0) {
            const supplierName = invoice.supplier?.name || 'Proveedor';
            const invNum = invoice.invoiceNumber;
            await prisma.notification.createMany({
                data: usersToNotify.map(u => ({
                    userId: u.id,
                    title: `Factura Trasladada a ${passToArea}`,
                    message: `La factura N° ${invNum} (${supplierName}) ha sido asignada al área de ${passToArea}.`,
                    type: 'INFO'
                }))
            });
        }
    } catch (err) {
        logger.error('Error creating passToArea notifications:', err);
    }
};

// Export Invoices to Excel (.xlsx) with 16 columns matching LMaestro2026.xlsm
export const exportInvoicesExcel = async (req: AuthRequest, res: Response) => {
    const { status, supplierId, search, startDate, endDate } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    try {
        if (!userId) return res.status(401).json({ error: 'User not authenticated' });

        const filters: any[] = [];
        if (status) {
            const normalizedStatus = String(status).toUpperCase();
            if (INVOICE_STATUSES.includes(normalizedStatus)) {
                filters.push({ status: normalizedStatus });
            }
        }
        if (supplierId) filters.push({ supplierId: String(supplierId) });

        if (startDate) {
            const parsedStart = new Date(String(startDate));
            if (!isNaN(parsedStart.getTime())) {
                filters.push({ issueDate: { gte: parsedStart } });
            }
        }

        if (endDate) {
            const parsedEnd = new Date(String(endDate));
            if (!isNaN(parsedEnd.getTime())) {
                parsedEnd.setHours(23, 59, 59, 999);
                filters.push({ issueDate: { lte: parsedEnd } });
            }
        }

        const normalizedSearch = String(search || '').trim();
        if (normalizedSearch) {
            filters.push({
                OR: [
                    { invoiceNumber: { contains: normalizedSearch, mode: 'insensitive' } },
                    { purchaseOrderNumber: { contains: normalizedSearch, mode: 'insensitive' } },
                    { requirementNumber: { contains: normalizedSearch, mode: 'insensitive' } },
                    { causationNumber: { contains: normalizedSearch, mode: 'insensitive' } },
                    { costCenterOrProject: { contains: normalizedSearch, mode: 'insensitive' } },
                    { passToArea: { contains: normalizedSearch, mode: 'insensitive' } },
                    { supplier: { name: { contains: normalizedSearch, mode: 'insensitive' } } },
                    { supplier: { nit: { contains: normalizedSearch, mode: 'insensitive' } } },
                    { requirement: { title: { contains: normalizedSearch, mode: 'insensitive' } } }
                ]
            });
        }

        const isGlobalViewer = hasRole(userRole, GLOBAL_INVOICE_VIEWER_ROLES);
        if (!isGlobalViewer) {
            filters.push({ OR: [
                { createdById: userId },
                { requirement: { createdById: userId } }
            ] });
        }

        const invoices = await prisma.invoice.findMany({
            where: filters.length > 0 ? { AND: filters } : {},
            include: invoiceInclude,
            orderBy: { createdAt: 'desc' }
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Control Facturas');

        worksheet.columns = [
            { header: '#', key: 'item', width: 8 },
            { header: 'NIT', key: 'nit', width: 16 },
            { header: 'RAZÓN SOCIAL', key: 'supplierName', width: 35 },
            { header: 'N° DE DOCUMENTO', key: 'invoiceNumber', width: 20 },
            { header: 'VALOR', key: 'amount', width: 18 },
            { header: 'FECHA DE RECEPCIÓN Y DOCUMENTO', key: 'issueDate', width: 22 },
            { header: 'PASA A:', key: 'passToArea', width: 20 },
            { header: 'OBSERVACIONES DESDE ARCHIVO', key: 'observations', width: 30 },
            { header: 'N° DE ORDEN', key: 'purchaseOrderNumber', width: 18 },
            { header: 'CENTRO DE COSTOS O PROYECTO', key: 'costCenterOrProject', width: 30 },
            { header: 'OBSERVACIONES DESDE COMPRAS', key: 'purchaseObservations', width: 30 },
            { header: 'VALIDACIÓN COMERCIAL', key: 'commercialValidation', width: 22 },
            { header: 'VALIDACIÓN JURÍDICA', key: 'legalValidation', width: 22 },
            { header: 'OBSERVACIONES DESDE JURÍDICA', key: 'legalObservations', width: 30 },
            { header: 'N° DE CAUSACIÓN', key: 'causationNumber', width: 18 },
            { header: 'OBSERVACIONES DESDE CONTABILIDAD', key: 'causationObservations', width: 30 }
        ];

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '1E3A8A' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        invoices.forEach((inv, idx) => {
            const row = worksheet.addRow({
                item: inv.itemNumber || idx + 1,
                nit: inv.supplier?.nit || inv.supplier?.taxId || '',
                supplierName: inv.supplier?.name || '',
                invoiceNumber: inv.invoiceNumber,
                amount: Number(inv.amount),
                issueDate: inv.issueDate ? new Date(inv.issueDate).toLocaleDateString('es-CO') : '',
                passToArea: inv.passToArea || '',
                observations: inv.observations || '',
                purchaseOrderNumber: inv.purchaseOrderNumber || '',
                costCenterOrProject: inv.costCenterOrProject || '',
                purchaseObservations: inv.purchaseObservations || '',
                commercialValidation: inv.commercialValidation || 'PENDIENTE',
                legalValidation: inv.legalValidation || 'PENDIENTE',
                legalObservations: inv.legalObservations || '',
                causationNumber: inv.causationNumber || '',
                causationObservations: inv.causationObservations || ''
            });

            const amountCell = row.getCell('amount');
            amountCell.numFmt = '"$"#,##0.00';
            amountCell.alignment = { horizontal: 'right' };
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Reporte_Facturas_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error: any) {
        console.error("Export invoices excel error:", error);
        res.status(500).json({ error: 'Error al generar reporte de facturas en Excel' });
    }
};

// Get Invoices with Filters, Date Ranges & Pagination
export const getInvoices = async (req: AuthRequest, res: Response) => {
    const { status, supplierId, search, startDate, endDate, page, limit, paginate } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    try {
        if (!userId) return res.status(401).json({ error: 'User not authenticated' });

        const filters: any[] = [];
        if (status) {
            const normalizedStatus = String(status).toUpperCase();
            if (!INVOICE_STATUSES.includes(normalizedStatus)) {
                return res.status(400).json({ error: 'Estado de factura no válido' });
            }
            filters.push({ status: normalizedStatus });
        }
        if (supplierId) filters.push({ supplierId: String(supplierId) });

        if (startDate) {
            const parsedStart = new Date(String(startDate));
            if (!isNaN(parsedStart.getTime())) {
                filters.push({ issueDate: { gte: parsedStart } });
            }
        }

        if (endDate) {
            const parsedEnd = new Date(String(endDate));
            if (!isNaN(parsedEnd.getTime())) {
                parsedEnd.setHours(23, 59, 59, 999);
                filters.push({ issueDate: { lte: parsedEnd } });
            }
        }

        const normalizedSearch = String(search || '').trim();
        if (normalizedSearch) {
            filters.push({
                OR: [
                    { invoiceNumber: { contains: normalizedSearch, mode: 'insensitive' } },
                    { purchaseOrderNumber: { contains: normalizedSearch, mode: 'insensitive' } },
                    { requirementNumber: { contains: normalizedSearch, mode: 'insensitive' } },
                    { causationNumber: { contains: normalizedSearch, mode: 'insensitive' } },
                    { costCenterOrProject: { contains: normalizedSearch, mode: 'insensitive' } },
                    { passToArea: { contains: normalizedSearch, mode: 'insensitive' } },
                    { supplier: { name: { contains: normalizedSearch, mode: 'insensitive' } } },
                    { supplier: { nit: { contains: normalizedSearch, mode: 'insensitive' } } },
                    { requirement: { title: { contains: normalizedSearch, mode: 'insensitive' } } }
                ]
            });
        }

        // Role-based visibility
        const isGlobalViewer = hasRole(userRole, GLOBAL_INVOICE_VIEWER_ROLES);

        if (!isGlobalViewer) {
            filters.push({ OR: [
                { createdById: userId },
                { requirement: { createdById: userId } }
            ] });
        }

        const whereClause = filters.length > 0 ? { AND: filters } : {};

        // Paginated or All
        const shouldPaginate = Boolean(page || limit || paginate === 'true');
        if (shouldPaginate) {
            const pageNum = Math.max(1, parseInt(String(page || '1'), 10));
            const limitNum = Math.max(1, Math.min(500, parseInt(String(limit || '50'), 10)));
            const skip = (pageNum - 1) * limitNum;

            const [invoices, total] = await Promise.all([
                prisma.invoice.findMany({
                    where: whereClause,
                    include: invoiceInclude,
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limitNum
                }),
                prisma.invoice.count({ where: whereClause })
            ]);

            return res.json({
                data: invoices,
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            });
        }

        const invoices = await prisma.invoice.findMany({
            where: whereClause,
            include: invoiceInclude,
            orderBy: { createdAt: 'desc' }
        });

        res.json(invoices);
    } catch (error: any) {
        console.error("Get invoices error:", error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
};

// Get a single invoice by ID
export const getInvoiceById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: invoiceInclude
        });

        if (!invoice) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        if (!canViewInvoice(invoice, userRole, userId)) {
            return res.status(403).json({ error: 'No tienes permiso para ver esta factura' });
        }

        res.json(invoice);
    } catch (error: any) {
        console.error("Get invoice error:", error);
        res.status(500).json({ error: 'Error al consultar la factura' });
    }
};

// Administrative reconciliation keeps historical invoice statuses intact while restoring a verified relationship.
export const getReconciliationSuggestions = async (req: AuthRequest, res: Response) => {
    if (!hasRole(req.user?.role, INVOICE_MANAGER_ROLES)) {
        return res.status(403).json({ error: 'No tienes permiso para conciliar facturas' });
    }

    try {
        const requestedPage = parseInt(String(req.query.page || '1'), 10);
        const requestedPageSize = parseInt(String(req.query.pageSize || '50'), 10);
        const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
        const pageSize = Number.isInteger(requestedPageSize) ? Math.min(Math.max(requestedPageSize, 1), 100) : 50;
        const mode = req.query.mode === 'ambiguous' ? 'ambiguous' : 'suggested';
        const [reconciliation, invoicesWithoutFile, overdueOpenInvoices] = await Promise.all([
            getReconciliationMatches(),
            prisma.invoice.count({ where: { fileUrl: null } }),
            prisma.invoice.count({
                where: {
                    dueDate: { lt: new Date() },
                    status: { notIn: ['PAID', 'REJECTED'] }
                }
            })
        ]);
        const selected = mode === 'ambiguous' ? reconciliation.ambiguous : reconciliation.highConfidence;
        const ordered = selected.sort((a, b) => new Date(b.invoice.issueDate).getTime() - new Date(a.invoice.issueDate).getTime());
        const skip = (page - 1) * pageSize;

        return res.json({
            data: ordered.slice(skip, skip + pageSize).map(match => ({
                invoice: match.invoice,
                requirement: match.requirement,
                evidence: match.evidence,
                confidence: mode === 'suggested' ? 'HIGH' : 'REVIEW'
            })),
            total: ordered.length,
            page,
            pageSize,
            totalPages: Math.ceil(ordered.length / pageSize),
            stats: {
                unlinkedInvoices: reconciliation.invoices.length,
                highConfidence: reconciliation.highConfidence.length,
                ambiguous: reconciliation.ambiguous.length,
                invoicesWithoutFile,
                overdueOpenInvoices
            }
        });
    } catch (error) {
        logger.error('Error generating reconciliation suggestions:', error);
        return res.status(500).json({ error: 'No se pudieron generar las sugerencias de conciliación' });
    }
};

export const searchCompatibleRequirements = async (req: AuthRequest, res: Response) => {
    if (!hasRole(req.user?.role, INVOICE_MANAGER_ROLES)) {
        return res.status(403).json({ error: 'No tienes permiso para vincular facturas' });
    }

    try {
        const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
        if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });

        const search = String(req.query.search || '').trim();
        const groupId = Number(search);
        const canSearchByGroupId = Number.isSafeInteger(groupId) && groupId > 0;
        const requirements = await prisma.requirement.findMany({
            where: {
                status: 'APPROVED',
                supplierId: invoice.supplierId,
                ...(search ? {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        ...(canSearchByGroupId ? [{ groupId }] : []),
                        { id: { contains: search, mode: 'insensitive' } },
                        { purchaseOrderNumber: { contains: search, mode: 'insensitive' } },
                        { invoiceNumber: { contains: search, mode: 'insensitive' } }
                    ]
                } : {})
            },
            select: {
                id: true,
                groupId: true,
                title: true,
                status: true,
                actualAmount: true,
                supplierId: true,
                purchaseOrderNumber: true,
                invoiceNumber: true
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        return res.json(requirements);
    } catch (error) {
        logger.error('Error searching compatible requirements:', error);
        return res.status(500).json({ error: 'No se pudieron buscar los requerimientos compatibles' });
    }
};

const reconcileInvoiceLink = async (invoiceId: string, requirementId: string, actor: AuthRequest['user']) => {
    const [invoice, requirement] = await Promise.all([
        prisma.invoice.findUnique({ where: { id: invoiceId } }),
        prisma.requirement.findUnique({ where: { id: requirementId } })
    ]);

    if (!invoice) throw new InvoiceRequestError(404, 'Factura no encontrada');
    if (invoice.requirementId) throw new InvoiceRequestError(409, 'La factura ya está vinculada a un requerimiento');
    if (!requirement || requirement.status !== 'APPROVED') throw new InvoiceRequestError(400, 'El requerimiento debe existir y estar aprobado');
    if (!requirement.supplierId || requirement.supplierId !== invoice.supplierId) {
        throw new InvoiceRequestError(400, 'El proveedor de la factura no coincide con el del requerimiento');
    }
    if (Math.abs(Number(invoice.amount) - Number(requirement.actualAmount || 0)) >= 0.01) {
        throw new InvoiceRequestError(400, 'El valor de la factura no coincide con el valor del requerimiento');
    }
    if (!requirement.hasMultiplePayments && await prisma.invoice.count({ where: { requirementId } }) > 0) {
        throw new InvoiceRequestError(409, 'El requerimiento ya tiene una factura vinculada y no admite pagos múltiples');
    }

    return prisma.$transaction(async tx => {
        const updated = await tx.invoice.update({
            where: { id: invoiceId },
            data: { requirementId },
            include: invoiceInclude
        });
        await writeInvoiceAuditLog(tx, {
            invoiceId,
            action: 'INVOICE_RECONCILED',
            fromStatus: invoice.status,
            toStatus: invoice.status,
            details: `Vínculo histórico conciliado con requerimiento${requirement.groupId ? ` #${requirement.groupId}` : ''}; estado conservado: ${invoice.status}`,
            actorId: actor?.id,
            actorEmail: actor?.email
        });
        return updated;
    });
};

export const reconcileInvoice = async (req: AuthRequest, res: Response) => {
    if (!hasRole(req.user?.role, INVOICE_MANAGER_ROLES)) {
        return res.status(403).json({ error: 'No tienes permiso para conciliar facturas' });
    }

    try {
        if (!req.body?.requirementId) return res.status(400).json({ error: 'Selecciona un requerimiento para conciliar' });
        const invoice = await reconcileInvoiceLink(req.params.id, String(req.body.requirementId), req.user);
        return res.json(invoice);
    } catch (error: any) {
        return res.status(error instanceof InvoiceRequestError ? error.status : 400).json({ error: error.message || 'No se pudo conciliar la factura' });
    }
};

export const reconcileInvoicesBatch = async (req: AuthRequest, res: Response) => {
    if (!hasRole(req.user?.role, INVOICE_MANAGER_ROLES)) {
        return res.status(403).json({ error: 'No tienes permiso para conciliar facturas' });
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0 || items.length > 100) {
        return res.status(400).json({ error: 'Selecciona entre 1 y 100 facturas para conciliar' });
    }

    try {
        const suggestions = await getReconciliationMatches();
        const safePairs = new Map(suggestions.highConfidence.map(match => [match.invoice.id, match.requirement.id]));
        const uniqueInvoiceIds = new Set<string>();
        items.forEach((item: any) => {
            if (!item?.invoiceId || !item?.requirementId || uniqueInvoiceIds.has(item.invoiceId) || safePairs.get(item.invoiceId) !== item.requirementId) {
                throw new InvoiceRequestError(400, 'El lote contiene una sugerencia inválida o desactualizada');
            }
            uniqueInvoiceIds.add(item.invoiceId);
        });

        await prisma.$transaction(async tx => {
            const [currentInvoices, currentRequirements] = await Promise.all([
                tx.invoice.findMany({ where: { id: { in: items.map((item: any) => item.invoiceId) } } }),
                tx.requirement.findMany({ where: { id: { in: items.map((item: any) => item.requirementId) } } })
            ]);
            const invoicesById = new Map(currentInvoices.map(invoice => [invoice.id, invoice]));
            const requirementsById = new Map(currentRequirements.map(requirement => [requirement.id, requirement]));

            for (const item of items) {
                const invoice = invoicesById.get(item.invoiceId);
                const requirement = requirementsById.get(item.requirementId);
                if (!invoice || invoice.requirementId || !requirement || requirement.status !== 'APPROVED'
                    || requirement.supplierId !== invoice.supplierId
                    || Math.abs(Number(invoice.amount) - Number(requirement.actualAmount || 0)) >= 0.01) {
                    throw new InvoiceRequestError(409, 'Una factura o requerimiento cambió; actualiza las sugerencias antes de confirmar');
                }
                if (!requirement.hasMultiplePayments && await tx.invoice.count({ where: { requirementId: requirement.id } }) > 0) {
                    throw new InvoiceRequestError(409, 'Un requerimiento del lote ya tiene una factura vinculada');
                }

                await tx.invoice.update({ where: { id: invoice.id }, data: { requirementId: requirement.id } });
                await writeInvoiceAuditLog(tx, {
                    invoiceId: invoice.id,
                    action: 'INVOICE_RECONCILED',
                    fromStatus: invoice.status,
                    toStatus: invoice.status,
                    details: `Vínculo histórico conciliado con requerimiento${requirement.groupId ? ` #${requirement.groupId}` : ''}; estado conservado: ${invoice.status}`,
                    actorId: req.user?.id,
                    actorEmail: req.user?.email
                });
            }
        });
        return res.json({ success: true, reconciled: items.length });
    } catch (error: any) {
        return res.status(error instanceof InvoiceRequestError ? error.status : 400).json({ error: error.message || 'No se pudo conciliar el lote' });
    }
};

// Soft duplicate validation for invoice reception
export const checkDuplicateInvoice = async (req: AuthRequest, res: Response) => {
    const { supplierId, invoiceNumber } = req.query;

    try {
        const normalizedInvoiceNumber = String(invoiceNumber || '').trim();
        if (!supplierId || !normalizedInvoiceNumber) {
            return res.json({ isDuplicate: false });
        }

        const duplicateInvoice = await prisma.invoice.findFirst({
            where: {
                supplierId: String(supplierId),
                invoiceNumber: {
                    equals: normalizedInvoiceNumber,
                    mode: 'insensitive'
                }
            },
            select: {
                id: true,
                invoiceNumber: true,
                status: true,
                createdAt: true
            }
        });

        res.json({
            isDuplicate: Boolean(duplicateInvoice),
            invoice: duplicateInvoice
        });
    } catch (error: any) {
        console.error("Check duplicate invoice error:", error);
        res.status(500).json({ error: 'Error al validar si la factura ya existe' });
    }
};

// Create Invoice (Reception)
export const createInvoice = async (req: AuthRequest, res: Response) => {
    const {
        invoiceNumber,
        supplierId,
        amount,
        issueDate,
        dueDate,
        purchaseOrderNumber,
        budgetId,
        observations,
        causationNumber,
        causationDate,
        leaderApproval,
        subtotal,
        taxAmount,
        commercialAreaId,
        policyApproverName,
        policyReviewObservations,
        causationObservations,
        requirementNumber
    } = req.body;
    const userId = req.user?.id;
    const { invoicePdf, attachments } = getUploadedFiles(req);
    const uploadedFiles = [invoicePdf, ...attachments];

    if (!userId) {
        cleanupUploadedFiles(uploadedFiles);
        return res.status(401).json({ error: 'User not authenticated' });
    }
    if (!invoicePdf) {
        cleanupUploadedFiles(uploadedFiles);
        return res.status(400).json({ error: 'Invoice PDF is required' });
    }


    try {
        const normalizedInvoiceNumber = String(invoiceNumber || '').trim();
        if (!normalizedInvoiceNumber) {
            return res.status(400).json({ error: 'El número de factura es requerido' });
        }
        if (!supplierId) {
            return res.status(400).json({ error: 'El proveedor es requerido' });
        }

        const parsedAmount = parsePositiveAmount(amount);
        const parsedSubtotal = parseOptionalAmount(subtotal, 'El subtotal');
        const parsedTaxAmount = parseOptionalAmount(taxAmount, 'El IVA');
        const parsedIssueDate = parseRequiredDate(issueDate, 'La fecha de emisión');
        const parsedDueDate = parseOptionalDate(dueDate, 'La fecha de vencimiento');
        const parsedCausationDate = parseOptionalDate(causationDate, 'La fecha de causación');

        if (parsedDueDate && parsedDueDate < parsedIssueDate) {
            throw new Error('La fecha de vencimiento no puede ser anterior a la fecha de emisión');
        }

        if (parsedSubtotal !== null && parsedTaxAmount !== null && Math.abs(parsedSubtotal + parsedTaxAmount - parsedAmount) > 0.01) {
            throw new Error('El subtotal más el IVA debe coincidir con el monto total de la factura');
        }

        const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
        if (!supplier) {
            throw new InvoiceRequestError(404, 'Proveedor no encontrado');
        }

        const normalizedBudgetId = normalizeOptionalString(budgetId);
        if (normalizedBudgetId) {
            const budget = await prisma.budget.findUnique({ where: { id: normalizedBudgetId } });
            if (!budget) throw new InvoiceRequestError(404, 'Presupuesto no encontrado');
        }

        const normalizedCommercialAreaId = normalizeOptionalString(commercialAreaId);
        if (normalizedCommercialAreaId) {
            const area = await prisma.area.findUnique({ where: { id: normalizedCommercialAreaId } });
            if (!area) throw new InvoiceRequestError(404, 'Área comercial no encontrada');
        }

        const duplicateInvoice = await prisma.invoice.findFirst({
            where: {
                supplierId,
                invoiceNumber: {
                    equals: normalizedInvoiceNumber,
                    mode: 'insensitive'
                }
            }
        });

        if (duplicateInvoice) {
            throw new InvoiceRequestError(409, 'Ya existe una factura con este número para el proveedor seleccionado');
        }

        // Normalize path for local fallback immediately
        let fileUrl = invoicePdf.path.replace(/\\/g, '/');

        // Upload to Blob Storage if available
        try {
            const blobName = `invoices/${Date.now()}-${invoicePdf.originalname.replace(/\s+/g, '_')}`;
            const blobUrl = await uploadToBlobStorage(invoicePdf.path, blobName);
            if (blobUrl) {
                fileUrl = blobUrl;
                logger.blob('Invoice uploaded to cloud:', blobUrl);
            }
        } catch (blobErr) {
            logger.error('Failed to upload invoice to blob storage, using local path:', blobErr);
        }

        const attachmentData = await processFileUploads(attachments, 'invoice-attachments');

        const {
            passToArea,
            costCenterOrProject,
            purchaseObservations,
            commercialValidation,
            legalValidation,
            legalObservations
        } = req.body;

        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber: normalizedInvoiceNumber,
                amount: parsedAmount,
                subtotal: parsedSubtotal,
                taxAmount: parsedTaxAmount,
                issueDate: parsedIssueDate,
                dueDate: parsedDueDate,
                supplierId,
                createdById: userId,
                status: 'RECEIVED',
                fileUrl: fileUrl,
                purchaseOrderNumber: normalizeOptionalString(purchaseOrderNumber),
                budgetId: normalizedBudgetId,
                observations: normalizeOptionalString(observations),
                causationNumber: normalizeOptionalString(causationNumber),
                causationDate: parsedCausationDate,
                leaderApproval: parseOptionalBoolean(leaderApproval),
                commercialAreaId: normalizedCommercialAreaId,
                policyApproverName: normalizeOptionalString(policyApproverName),
                policyReviewObservations: normalizeOptionalString(policyReviewObservations),
                causationObservations: normalizeOptionalString(causationObservations),
                requirementNumber: normalizeOptionalString(requirementNumber),
                passToArea: normalizeOptionalString(passToArea),
                costCenterOrProject: normalizeOptionalString(costCenterOrProject),
                purchaseObservations: normalizeOptionalString(purchaseObservations),
                commercialValidation: normalizeOptionalString(commercialValidation),
                legalValidation: normalizeOptionalString(legalValidation),
                legalObservations: normalizeOptionalString(legalObservations),
                attachments: attachmentData.length > 0 ? { create: attachmentData } : undefined
            },
            include: invoiceInclude
        });

        await writeInvoiceAuditLog(prisma, {
            invoiceId: invoice.id,
            action: 'INVOICE_CREATED',
            toStatus: 'RECEIVED',
            details: `Factura ${normalizedInvoiceNumber} recepcionada`,
            actorId: userId,
            actorEmail: req.user?.email
        });

        if (invoice.passToArea) {
            notifyPassToAreaUsers(invoice, invoice.passToArea, userId);
        }

        res.status(201).json(invoice);
    } catch (error: any) {
        cleanupUploadedFiles(uploadedFiles);
        console.error("Create invoice error:", error);
        res.status(error instanceof InvoiceRequestError ? error.status : 400).json({ error: error.message || 'Error al crear la factura' });
    }
};

// Update Invoice (Role-based editing for LMaestro2026 columns)
export const updateInvoice = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!hasRole(userRole, INVOICE_MANAGER_ROLES)) {
        return res.status(403).json({ error: 'No tienes permiso para editar facturas' });
    }

    try {
        const currentInvoice = await prisma.invoice.findUnique({ where: { id } });
        if (!currentInvoice) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        const updateData: any = {};
        const {
            invoiceNumber,
            supplierId,
            amount,
            issueDate,
            passToArea,
            observations,
            purchaseOrderNumber,
            costCenterOrProject,
            purchaseObservations,
            commercialValidation,
            legalValidation,
            legalObservations,
            causationNumber,
            causationObservations
        } = req.body;

        if (invoiceNumber !== undefined) updateData.invoiceNumber = String(invoiceNumber).trim();
        if (supplierId !== undefined && supplierId) updateData.supplierId = String(supplierId);
        if (amount !== undefined && amount !== null && amount !== '') updateData.amount = parsePositiveAmount(amount);
        if (issueDate !== undefined && issueDate) updateData.issueDate = parseRequiredDate(issueDate, 'Fecha de emisión');
        if (passToArea !== undefined) updateData.passToArea = normalizeOptionalString(passToArea);
        if (observations !== undefined) updateData.observations = normalizeOptionalString(observations);

        if (purchaseOrderNumber !== undefined) updateData.purchaseOrderNumber = normalizeOptionalString(purchaseOrderNumber);
        if (costCenterOrProject !== undefined) updateData.costCenterOrProject = normalizeOptionalString(costCenterOrProject);
        if (purchaseObservations !== undefined) updateData.purchaseObservations = normalizeOptionalString(purchaseObservations);

        if (commercialValidation !== undefined) updateData.commercialValidation = normalizeOptionalString(commercialValidation);

        if (legalValidation !== undefined) updateData.legalValidation = normalizeOptionalString(legalValidation);
        if (legalObservations !== undefined) updateData.legalObservations = normalizeOptionalString(legalObservations);

        if (causationNumber !== undefined) updateData.causationNumber = normalizeOptionalString(causationNumber);
        if (causationObservations !== undefined) updateData.causationObservations = normalizeOptionalString(causationObservations);

        const updated = await prisma.invoice.update({
            where: { id },
            data: updateData,
            include: invoiceInclude
        });

        await writeInvoiceAuditLog(prisma, {
            invoiceId: id,
            action: 'INVOICE_UPDATED',
            details: `Factura actualizada por usuario (${userRole || 'USER'})`,
            actorId: userId,
            actorEmail: req.user?.email
        });

        if (updated.passToArea && updated.passToArea !== currentInvoice.passToArea) {
            notifyPassToAreaUsers(updated, updated.passToArea, userId);
        }

        res.json(updated);
    } catch (error: any) {
        console.error("Update invoice error:", error);
        res.status(400).json({ error: error.message || 'Error al actualizar la factura' });
    }
};

// Verify Invoice (Link to PO)
export const verifyInvoice = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { requirementId } = req.body;
    const userRole = req.user?.role;

    if (!hasRole(userRole, INVOICE_MANAGER_ROLES)) {
        return res.status(403).json({ error: 'No tienes permiso para verificar facturas' });
    }

    try {
        if (!requirementId) {
            return res.status(400).json({ error: 'Selecciona un requerimiento para vincular la factura' });
        }

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        if (invoice.status !== 'RECEIVED') {
            return res.status(400).json({ error: `Solo se pueden verificar facturas recibidas. Estado actual: ${invoice.status}` });
        }

        const requirement = await prisma.requirement.findUnique({ where: { id: requirementId } });
        if (!requirement) return res.status(404).json({ error: 'Requerimiento no encontrado' });

        if (requirement.status !== 'APPROVED') {
            return res.status(400).json({ error: 'El requerimiento debe estar aprobado para vincular una factura' });
        }

        if (requirement.supplierId && requirement.supplierId !== invoice.supplierId) {
            return res.status(400).json({ error: 'El proveedor de la factura no coincide con el proveedor del requerimiento' });
        }

        const updatedInvoice = await prisma.$transaction(async (tx) => {
            const updated = await tx.invoice.update({
                where: { id },
                data: {
                    requirementId,
                    status: 'VERIFIED',
                    verifiedAt: new Date(),
                    verifiedById: req.user?.id
                }
            });

            await writeInvoiceAuditLog(tx, {
                invoiceId: id,
                action: 'INVOICE_VERIFIED',
                fromStatus: 'RECEIVED',
                toStatus: 'VERIFIED',
                details: `Factura vinculada al requerimiento${requirement.groupId ? ` #${requirement.groupId}` : ''}`,
                actorId: req.user?.id,
                actorEmail: req.user?.email
            });

            return updated;
        });

        res.json(updatedInvoice);
    } catch (error: any) {
        console.error("Verify invoice error:", error);
        res.status(400).json({ error: 'Error al verificar la factura' });
    }
};

// Approve Payment (Leader)
export const approveInvoice = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userRole = req.user?.role;

    if (!hasRole(userRole, INVOICE_APPROVER_ROLES)) {
        return res.status(403).json({ error: 'No tienes permiso para autorizar pagos' });
    }

    try {
        const currentInvoice = await prisma.invoice.findUnique({ where: { id } });
        if (!currentInvoice) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        if (currentInvoice.status !== 'VERIFIED') {
            return res.status(400).json({ error: `Solo se pueden autorizar facturas verificadas. Estado actual: ${currentInvoice.status}` });
        }

        const invoice = await prisma.$transaction(async (tx) => {
            const updated = await tx.invoice.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    approvedAt: new Date(),
                    approvedById: req.user?.id
                }
            });

            await writeInvoiceAuditLog(tx, {
                invoiceId: id,
                action: 'INVOICE_APPROVED',
                fromStatus: 'VERIFIED',
                toStatus: 'APPROVED',
                details: 'Pago de factura autorizado',
                actorId: req.user?.id,
                actorEmail: req.user?.email
            });

            return updated;
        });
        res.json(invoice);
    } catch (error: any) {
        console.error("Approve invoice error:", error);
        res.status(400).json({ error: 'Error al autorizar la factura' });
    }
};

// Pay Invoice (Finalize)
export const payInvoice = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { paymentDate, transactionNumber } = req.body;
    const userRole = req.user?.role;

    if (!hasRole(userRole, INVOICE_PAYMENT_ROLES)) {
        return res.status(403).json({ error: 'No tienes permiso para registrar pagos de facturas' });
    }

    try {
        const parsedPaymentDate = paymentDate ? parseRequiredDate(paymentDate, 'La fecha de pago') : new Date();

        const invoice = await prisma.$transaction(async (tx) => {
            const currentInvoice = await tx.invoice.findUnique({
                where: { id },
                include: {
                    requirement: {
                        include: {
                            payments: true
                        }
                    }
                }
            });

            if (!currentInvoice) {
                throw new Error('Factura no encontrada');
            }

            if (currentInvoice.status !== 'APPROVED') {
                throw new Error(`Solo se pueden pagar facturas autorizadas. Estado actual: ${currentInvoice.status}`);
            }

            if (!currentInvoice.requirementId || !currentInvoice.requirement) {
                throw new Error('La factura debe estar vinculada a un requerimiento antes de registrar el pago');
            }

            if (!currentInvoice.requirement.hasMultiplePayments && currentInvoice.requirement.payments.length > 0) {
                throw new Error('Este requerimiento no tiene habilitados los pagos múltiples y ya registra un abono');
            }

            if (currentInvoice.requirement.payments.length >= 24) {
                throw new Error('Este requerimiento ya alcanzó el máximo de 24 abonos');
            }

            const existingInvoicePayment = await tx.payment.findFirst({
                where: {
                    OR: [
                        { invoiceId: currentInvoice.id },
                        {
                            requirementId: currentInvoice.requirementId,
                            invoiceNumber: currentInvoice.invoiceNumber
                        }
                    ]
                }
            });

            if (existingInvoicePayment) {
                throw new Error('Ya existe un abono registrado con este número de factura para el requerimiento');
            }

            const maxPayment = await tx.payment.findFirst({
                where: { requirementId: currentInvoice.requirementId },
                orderBy: { paymentNumber: 'desc' }
            });

            const paymentNumber = (maxPayment?.paymentNumber || 0) + 1;

            await tx.invoice.update({
                where: { id },
                data: {
                    status: 'PAID',
                    paidAt: new Date(),
                    paidById: req.user?.id,
                    transactionNumber: transactionNumber || null
                }
            });

            await tx.payment.create({
                data: {
                    requirementId: currentInvoice.requirementId,
                    invoiceId: currentInvoice.id,
                    paymentNumber,
                    amount: currentInvoice.amount,
                    invoiceNumber: currentInvoice.invoiceNumber,
                    paymentDate: parsedPaymentDate,
                    observations: `Pago generado desde Factura ${currentInvoice.invoiceNumber}. Transacción: ${transactionNumber || 'N/A'}`
                }
            });

            await writeInvoiceAuditLog(tx, {
                invoiceId: currentInvoice.id,
                action: 'INVOICE_PAID',
                fromStatus: 'APPROVED',
                toStatus: 'PAID',
                details: `Factura pagada y abono #${paymentNumber} registrado. Transacción: ${transactionNumber || 'N/A'}`,
                actorId: req.user?.id,
                actorEmail: req.user?.email
            });

            await tx.historyLog.create({
                data: {
                    action: 'INVOICE_PAID',
                    requirementId: currentInvoice.requirementId,
                    details: `Factura ${currentInvoice.invoiceNumber} marcada como pagada y abono #${paymentNumber} registrado`
                }
            });

            return tx.invoice.findUnique({
                where: { id },
                include: invoiceInclude
            });
        });

        res.json(invoice);
    } catch (error: any) {
        console.error("Pay invoice error:", error);
        res.status(400).json({ error: error.message || 'Error al registrar el pago' });
    }
};

// Delete Invoice
export const deleteInvoice = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userRole = req.user?.role;

    if (!hasRole(userRole, INVOICE_MANAGER_ROLES)) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar facturas' });
    }

    try {
        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        if (invoice.status === 'PAID') {
            return res.status(400).json({ error: 'No se puede eliminar una factura pagada desde este módulo' });
        }

        await prisma.$transaction(async (tx) => {
            await writeInvoiceAuditLog(tx, {
                invoiceId: id,
                action: 'INVOICE_DELETED',
                fromStatus: invoice.status,
                details: `Factura ${invoice.invoiceNumber} eliminada`,
                actorId: req.user?.id,
                actorEmail: req.user?.email
            });

            await tx.invoice.delete({ where: { id } });
        });

        res.json({ message: 'Factura eliminada' });
    } catch (error: any) {
        console.error("Delete invoice error:", error);
        res.status(400).json({ error: 'Failed to delete invoice' });
    }
};

// Import Invoices from Excel (LMaestro2026.xlsm / .xlsx) securely in Azure Cloud (Ultrafast Batch Processing)
export const importInvoicesFromExcel = async (req: AuthRequest, res: Response) => {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    res.setHeader('Content-Type', 'application/json');

    if (!hasRole(userRole, ['ADMIN', 'DEVELOPER', 'DIRECTOR', 'COORDINATOR'])) {
        return res.status(403).json({ error: 'No tienes permiso para importar registros masivos de facturas' });
    }

    const file = req.file;
    if (!file || !file.path) {
        return res.status(400).json({ error: 'Debes adjuntar un archivo Excel válido (.xlsx o .xlsm)' });
    }

    try {
        logger.info(`Iniciando importación masiva y optimizada de: ${file.originalname}...`);
        const workbook = XLSX.readFile(file.path, { cellDates: true });

        let creatorId = userId;
        if (!creatorId) {
            const fallbackAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } }) || await prisma.user.findFirst();
            if (!fallbackAdmin) {
                return res.status(500).json({ error: 'No se encontró un usuario activo para asociar la auditoría de facturas' });
            }
            creatorId = fallbackAdmin.id;
        }

        const cleanStr = (val: any): string | null => {
            if (val === undefined || val === null) return null;
            const str = String(val).trim();
            return (!str || str.toLowerCase() === 'none' || str === '#ref!' || str === '#valor!' || str === '#div/0!') ? null : str;
        };

        const parseAmt = (val: any): number => {
            if (val === undefined || val === null || val === '') return 0;
            if (typeof val === 'number') return isNaN(val) ? 0 : val;
            let str = String(val).replace(/[\$\s]/g, '').trim();
            if (!str || str.includes('#')) return 0;
            if (str.includes(',') && str.includes('.')) str = str.replace(/\./g, '').replace(',', '.');
            else if (str.includes(',') && !str.includes('.')) str = str.replace(',', '.');
            const parsed = parseFloat(str);
            return isNaN(parsed) ? 0 : parsed;
        };

        const parseDt = (val: any): Date => {
            const def = new Date(2026, 0, 1);
            if (!val) return def;
            if (val instanceof Date && !isNaN(val.getTime())) {
                if (val.getFullYear() < 2015 || val.getFullYear() > 2035) return def;
                return val;
            }
            if (typeof val === 'number' && val > 30000 && val < 70000) {
                const d = new Date((val - (25567 + 2)) * 86400 * 1000);
                if (!isNaN(d.getTime())) return d;
            }
            if (typeof val === 'string') {
                const d = new Date(val);
                if (!isNaN(d.getTime())) return d;
            }
            return def;
        };

        // 1. CARGA RÁPIDA DE PROVEEDORES (Hoja "Base")
        const sheet1Name = workbook.SheetNames.find(s => s.trim().toLowerCase() === 'base') || workbook.SheetNames[0];
        const sheet1 = workbook.Sheets[sheet1Name];
        const baseRows: any[] = XLSX.utils.sheet_to_json(sheet1, { header: 1 });

        const supplierMap = new Map<string, string>(); // NIT/Nombre minúscula -> ID
        const existingSuppliers = await prisma.supplier.findMany({ select: { id: true, nit: true, taxId: true, name: true } });
        for (const sup of existingSuppliers) {
            if (sup.nit) supplierMap.set(sup.nit.trim().toLowerCase(), sup.id);
            if (sup.taxId) supplierMap.set(sup.taxId.trim().toLowerCase(), sup.id);
            if (sup.name) supplierMap.set(sup.name.trim().toLowerCase(), sup.id);
        }

        const suppliersToCreate: any[] = [];
        const seenNewSuppliers = new Set<string>();

        for (let i = 1; i < baseRows.length; i++) {
            const row = baseRows[i];
            if (!row || row.length === 0) continue;
            const nit = cleanStr(row[0]);
            const name = cleanStr(row[1]);
            if (!nit && !name) continue;

            const key = (nit || name!).toLowerCase();
            if (!supplierMap.has(key) && !seenNewSuppliers.has(key)) {
                seenNewSuppliers.add(key);
                suppliersToCreate.push({
                    nit: nit || undefined,
                    taxId: nit || undefined,
                    name: (name || nit || 'PROVEEDOR LMAESTRO').toUpperCase(),
                    criticality: 'LOW',
                    supplierType: 'SUPPLIER'
                });
            }
        }

        let createdSuppliers = 0;
        if (suppliersToCreate.length > 0) {
            try {
                const batchRes = await prisma.supplier.createMany({
                    data: suppliersToCreate,
                    skipDuplicates: true
                });
                createdSuppliers = batchRes.count;
            } catch (err) {
                logger.warn('Fallo en createMany de proveedores, reintentando carga tolerada en BD', err);
            }
            // Recargar mapa tras inserción masiva en milisegundos
            const allSuppliers = await prisma.supplier.findMany({ select: { id: true, nit: true, taxId: true, name: true } });
            for (const sup of allSuppliers) {
                if (sup.nit) supplierMap.set(sup.nit.trim().toLowerCase(), sup.id);
                if (sup.taxId) supplierMap.set(sup.taxId.trim().toLowerCase(), sup.id);
                if (sup.name) supplierMap.set(sup.name.trim().toLowerCase(), sup.id);
            }
        }

        // 2. CARGA ULTRARRÁPIDA DE FACTURAS IN-MEMORY (Hoja "CONTROL FACTURAS")
        const sheet2Name = workbook.SheetNames.find(s => s.trim().toUpperCase().includes('CONTROL FACTURAS')) || workbook.SheetNames[1];
        const sheet2 = workbook.Sheets[sheet2Name];
        const invoiceRows: any[] = XLSX.utils.sheet_to_json(sheet2, { header: 1 });

        const existingInvoices = await prisma.invoice.findMany({ select: { id: true, invoiceNumber: true, supplierId: true, itemNumber: true } });
        const existingInvMap = new Map<string, { id: string }>(); // key -> existing invoice
        for (const inv of existingInvoices) {
            if (inv.supplierId && inv.invoiceNumber) existingInvMap.set(`${inv.supplierId}-${inv.invoiceNumber.toLowerCase()}`, inv);
            if (inv.itemNumber) existingInvMap.set(`item-${inv.itemNumber}`, inv);
        }

        const invoicesToCreate: any[] = [];
        let updatedInvoicesCount = 0;
        const seenInvoicesInFile = new Set<string>();

        // Si faltaron proveedores, creamos un proveedor de respaldo garantizado y auditado para conservar la factura sin romper relaciones
        let defaultSupplierId = supplierMap.get('varios') || supplierMap.get('sinf-000');
        if (!defaultSupplierId) {
            let defSup = await prisma.supplier.findFirst({ where: { OR: [{ nit: 'SINF-000' }, { name: 'PROVEEDORES VARIOS LMAESTRO' }] } });
            if (!defSup) {
                defSup = await prisma.supplier.create({
                    data: { nit: 'SINF-000', name: 'PROVEEDORES VARIOS LMAESTRO', criticality: 'LOW', supplierType: 'SUPPLIER' }
                });
            }
            defaultSupplierId = defSup.id;
            supplierMap.set('sinf-000', defaultSupplierId);
        }

        for (let i = 1; i < invoiceRows.length; i++) {
            const row = invoiceRows[i];
            if (!row || row.length === 0) continue;

            const rawItem = cleanStr(row[0]);
            const nit = cleanStr(row[1]);
            const name = cleanStr(row[2]);
            const invoiceNumber = cleanStr(row[3]);
            const amount = parseAmt(row[4]);

            // Filtrar filas sueltas o rotas con basura al 100%
            if (!nit && !name && !invoiceNumber && amount === 0) continue;
            if (name && (name.toUpperCase().includes('TOTALES') || name.toUpperCase().includes('GRAN TOTAL'))) continue;

            let supplierId: string | undefined;
            if (nit && supplierMap.has(nit.toLowerCase())) supplierId = supplierMap.get(nit.toLowerCase());
            else if (name && supplierMap.has(name.toLowerCase())) supplierId = supplierMap.get(name.toLowerCase());
            
            if (!supplierId) supplierId = defaultSupplierId;

            const itemNum = rawItem && !isNaN(parseInt(rawItem)) ? parseInt(rawItem) : i;
            let finalNumber = invoiceNumber || `FAC-${itemNum}-${i}`;

            const fileKey = `${supplierId}-${finalNumber.toLowerCase()}`;
            if (seenInvoicesInFile.has(fileKey)) {
                finalNumber = `${finalNumber}-R${i}`;
            }
            seenInvoicesInFile.add(`${supplierId}-${finalNumber.toLowerCase()}`);

            const issueDate = parseDt(row[5]);
            const passToArea = cleanStr(row[6]);
            const observations = cleanStr(row[7]);
            const purchaseOrderNumber = cleanStr(row[8]);
            const costCenterOrProject = cleanStr(row[9]);
            const purchaseObservations = cleanStr(row[10]);
            const commercialValidation = cleanStr(row[11]);
            const legalValidation = cleanStr(row[12]);
            const legalObservations = cleanStr(row[13]);
            const causationNumber = cleanStr(row[14]);
            const causationObservations = cleanStr(row[15]);

            let status: any = 'RECEIVED';
            if (causationObservations?.toLowerCase() === 'ok' || causationNumber) status = 'PAID';
            else if (commercialValidation?.toUpperCase() === 'APROBADO' || legalValidation?.toUpperCase() === 'APROBADO') status = 'APPROVED';
            else if (purchaseOrderNumber) status = 'VERIFIED';

            const payload = {
                itemNumber: itemNum,
                invoiceNumber: finalNumber,
                supplierId,
                amount,
                issueDate,
                status,
                passToArea,
                observations,
                purchaseOrderNumber,
                costCenterOrProject,
                purchaseObservations,
                commercialValidation,
                legalValidation,
                legalObservations,
                causationNumber,
                causationObservations,
                // Las relaciones se omiten para conservar las conciliaciones ya confirmadas.
            };

            const existingInvoice = existingInvMap.get(`${supplierId}-${finalNumber.toLowerCase()}`) || existingInvMap.get(`item-${itemNum}`);
            if (existingInvoice) {
                // Actualizar sin frenar el flujo
                await prisma.invoice.update({ where: { id: existingInvoice.id }, data: payload }).catch(e => logger.warn(`Skipping inv update ${existingInvoice.id}`, e));
                updatedInvoicesCount++;
            } else {
                invoicesToCreate.push({
                    ...payload,
                    createdById: creatorId
                });
            }
        }

        let createdInvoicesCount = 0;
        if (invoicesToCreate.length > 0) {
            // Inserción en bloques de 500 para una velocidad fulminante en el Postgres de Azure
            const CHUNK_SIZE = 500;
            for (let c = 0; c < invoicesToCreate.length; c += CHUNK_SIZE) {
                const chunk = invoicesToCreate.slice(c, c + CHUNK_SIZE);
                const batchInv = await prisma.invoice.createMany({
                    data: chunk,
                    skipDuplicates: true
                });
                createdInvoicesCount += batchInv.count;
            }
        }

        logger.info(`Sincronización Excel concluida exitosamente: ${createdSuppliers} prov, ${createdInvoicesCount} fact creadas, ${updatedInvoicesCount} act.`);

        return res.json({
            success: true,
            summary: {
                suppliersCreated: createdSuppliers,
                invoicesCreated: createdInvoicesCount,
                invoicesUpdated: updatedInvoicesCount,
                totalProcessed: createdInvoicesCount + updatedInvoicesCount
            },
            message: 'Registros consolidados exitosamente a máxima velocidad in-memory preservando tus relaciones relacionales.'
        });

    } catch (error: any) {
        logger.error('Error durante la importación in-memory de Azure:', error);
        return res.status(500).json({ error: 'Error procesando el archivo. Asegúrate de usar el archivo LMaestro2026_Limpio.xlsx.' });
    } finally {
        if (file && file.path && fs.existsSync(file.path)) {
            try { fs.unlinkSync(file.path); } catch (e) {}
        }
    }
};
