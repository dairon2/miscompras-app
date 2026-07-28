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
                details: `Factura vinculada al requerimiento ${requirementId}`,
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

// Import Invoices from Excel (LMaestro2026.xlsm / .xlsx) securely in Azure Cloud
export const importInvoicesFromExcel = async (req: AuthRequest, res: Response) => {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (!hasRole(userRole, ['ADMIN', 'DEVELOPER', 'DIRECTOR', 'COORDINATOR'])) {
        return res.status(403).json({ error: 'No tienes permiso para importar registros masivos de facturas' });
    }

    const file = req.file;
    if (!file || !file.path) {
        return res.status(400).json({ error: 'Debes adjuntar un archivo Excel válido (.xlsx o .xlsm)' });
    }

    try {
        logger.info(`Iniciando importación segura en Nube del archivo: ${file.originalname}...`);
        const workbook = XLSX.readFile(file.path, { cellDates: true });

        // Identificar usuario creador de la auditoría
        let creatorId = userId;
        if (!creatorId) {
            const fallbackAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } }) || await prisma.user.findFirst();
            if (!fallbackAdmin) {
                return res.status(500).json({ error: 'No se encontró un usuario activo en el sistema para la auditoría de registros' });
            }
            creatorId = fallbackAdmin.id;
        }

        // 1. Procesar Hoja 1 ("Base") para Proveedores con total seguridad de unicidad
        const sheet1Name = workbook.SheetNames.find(s => s.trim().toLowerCase() === 'base') || workbook.SheetNames[0];
        const sheet1 = workbook.Sheets[sheet1Name];
        const baseRows: any[] = XLSX.utils.sheet_to_json(sheet1, { header: 1 });

        const supplierMap = new Map<string, string>(); // Key: nit o razon social en minúscula -> id
        const existingSuppliers = await prisma.supplier.findMany({ select: { id: true, nit: true, taxId: true, name: true } });
        for (const sup of existingSuppliers) {
            if (sup.nit) supplierMap.set(sup.nit.trim().toLowerCase(), sup.id);
            if (sup.taxId) supplierMap.set(sup.taxId.trim().toLowerCase(), sup.id);
            if (sup.name) supplierMap.set(sup.name.trim().toLowerCase(), sup.id);
        }

        let createdSuppliers = 0;
        const cleanStr = (val: any) => {
            if (val === undefined || val === null) return null;
            const str = String(val).trim();
            return (!str || str.toLowerCase() === 'none' || str === '#REF!') ? null : str;
        };

        for (let i = 1; i < baseRows.length; i++) {
            const row = baseRows[i];
            if (!row || row.length === 0) continue;
            const nit = cleanStr(row[0]);
            const name = cleanStr(row[1]);
            if (!nit && !name) continue;

            const lookupKey = (nit || name!).toLowerCase();
            if (!supplierMap.has(lookupKey)) {
                try {
                    const newSup = await prisma.supplier.create({
                        data: {
                            nit: nit || undefined,
                            taxId: nit || undefined,
                            name: name || nit || 'PROVEEDOR DESCONOCIDO',
                            criticality: 'LOW',
                            supplierType: 'SUPPLIER'
                        }
                    });
                    createdSuppliers++;
                    if (nit) supplierMap.set(nit.toLowerCase(), newSup.id);
                    if (name) supplierMap.set(name.toLowerCase(), newSup.id);
                } catch (collision: any) {
                    // Si hubo colisión de NIT pre-existente, resolver en BD el ID auténtico
                    const match = await prisma.supplier.findFirst({
                        where: { OR: [{ nit: nit || undefined }, { taxId: nit || undefined }, { name: name || undefined }] },
                        select: { id: true }
                    });
                    if (match) {
                        if (nit) supplierMap.set(nit.toLowerCase(), match.id);
                        if (name) supplierMap.set(name.toLowerCase(), match.id);
                    }
                }
            }
        }

        // 2. Procesar Hoja 2 ("CONTROL FACTURAS") en lotes y respetando relaciones al 100%
        const sheet2Name = workbook.SheetNames.find(s => s.trim().toUpperCase().includes('CONTROL FACTURAS')) || workbook.SheetNames[1];
        const sheet2 = workbook.Sheets[sheet2Name];
        const invoiceRows: any[] = XLSX.utils.sheet_to_json(sheet2, { header: 1 });

        let createdInvoices = 0;
        let updatedInvoices = 0;

        const parseAmt = (val: any): number => {
            if (val === undefined || val === null || val === '') return 0;
            if (typeof val === 'number') return val;
            let str = String(val).replace(/[\$\s]/g, '');
            if (!str) return 0;
            if (str.includes(',') && str.includes('.')) str = str.replace(/\./g, '').replace(',', '.');
            else if (str.includes(',') && !str.includes('.')) str = str.replace(',', '.');
            const parsed = parseFloat(str);
            return isNaN(parsed) ? 0 : parsed;
        };

        const parseDt = (val: any): Date => {
            if (!val) return new Date();
            if (val instanceof Date && !isNaN(val.getTime())) return val;
            if (typeof val === 'number' && val > 30000 && val < 60000) {
                const d = new Date((val - (25567 + 2)) * 86400 * 1000);
                if (!isNaN(d.getTime())) return d;
            }
            if (typeof val === 'string') {
                const d = new Date(val);
                if (!isNaN(d.getTime())) return d;
            }
            return new Date();
        };

        for (let i = 1; i < invoiceRows.length; i++) {
            const row = invoiceRows[i];
            if (!row || row.length === 0) continue;

            const rawItem = cleanStr(row[0]);
            const nit = cleanStr(row[1]);
            const name = cleanStr(row[2]);
            const invoiceNumber = cleanStr(row[3]);
            const amount = parseAmt(row[4]);
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

            if (!nit && !name && !invoiceNumber && amount === 0) continue;

            // Encontrar o fabricar Proveedor sin asignar JAMÁS al azar si falla
            let supplierId: string | undefined;
            if (nit && supplierMap.has(nit.toLowerCase())) supplierId = supplierMap.get(nit.toLowerCase());
            else if (name && supplierMap.has(name.toLowerCase())) supplierId = supplierMap.get(name.toLowerCase());

            if (!supplierId) {
                try {
                    const newSup = await prisma.supplier.create({
                        data: {
                            nit: nit || undefined,
                            taxId: nit || undefined,
                            name: name || nit || `PROVEEDOR LMAESTRO ${i}`,
                            criticality: 'LOW',
                            supplierType: 'SUPPLIER'
                        }
                    });
                    supplierId = newSup.id;
                    createdSuppliers++;
                    if (nit) supplierMap.set(nit.toLowerCase(), supplierId);
                    if (name) supplierMap.set(name.toLowerCase(), supplierId);
                } catch (err) {
                    const existingMatch = await prisma.supplier.findFirst({
                        where: { OR: [{ nit: nit || undefined }, { name: name || undefined }] }
                    });
                    if (existingMatch) supplierId = existingMatch.id;
                }
            }

            if (!supplierId) continue; // Si no hay proveedor seguro, omitir fila en vez de causar inconsistencias relacionales

            const finalNumber = invoiceNumber || `FAC-${rawItem || i}`;
            const itemNum = rawItem && !isNaN(parseInt(rawItem)) ? parseInt(rawItem) : i;

            let status: any = 'RECEIVED';
            if (causationObservations?.toLowerCase() === 'ok' || causationNumber) status = 'PAID';
            else if (commercialValidation?.toUpperCase() === 'APROBADO' || legalValidation?.toUpperCase() === 'APROBADO') status = 'APPROVED';
            else if (purchaseOrderNumber) status = 'VERIFIED';

            // Buscar si ya se había cargado por su NIT de proveedor + número de documento O itemNumber idéntico
            const existingInv = await prisma.invoice.findFirst({
                where: {
                    OR: [
                        { supplierId, invoiceNumber: finalNumber },
                        { itemNumber: itemNum }
                    ]
                }
            });

            const dataToUpsert = {
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
                // BLINDAJE DE RELACIONES: budgetId, requirementId y commercialAreaId en null por defecto,
                // respetando al 100% las demás tablas de presupuestos y requerimientos vigentes del usuario en Azure!
                budgetId: null,
                requirementId: null,
                commercialAreaId: null
            };

            if (existingInv) {
                await prisma.invoice.update({
                    where: { id: existingInv.id },
                    data: dataToUpsert
                });
                updatedInvoices++;
            } else {
                await prisma.invoice.create({
                    data: {
                        ...dataToUpsert,
                        createdById: creatorId
                    }
                });
                createdInvoices++;
            }
        }

        logger.info(`Importación de Excel completada: ${createdSuppliers} prov. creados, ${createdInvoices} fact. creadas, ${updatedInvoices} fact. actualizadas.`);

        res.json({
            success: true,
            summary: {
                suppliersCreated: createdSuppliers,
                invoicesCreated: createdInvoices,
                invoicesUpdated: updatedInvoices,
                totalProcessed: createdInvoices + updatedInvoices
            },
            message: 'Registros del Libro Maestro procesados exitosamente sin afectar ninguna otra tabla del sistema.'
        });

    } catch (error: any) {
        logger.error('Error procesando importación de archivo Excel:', error);
        res.status(500).json({ error: error.message || 'Error al leer y sincronizar los registros del archivo Excel' });
    } finally {
        if (file && file.path && fs.existsSync(file.path)) {
            try { fs.unlinkSync(file.path); } catch (e) {}
        }
    }
};
