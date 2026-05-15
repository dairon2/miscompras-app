import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';
import path from 'path';
import { uploadToBlobStorage } from '../services/blobStorageService';
import logger from '../services/logger';

const GLOBAL_INVOICE_VIEWER_ROLES = ['ADMIN', 'DIRECTOR', 'AUDITOR', 'DEVELOPER', 'COORDINATOR'];
const INVOICE_MANAGER_ROLES = ['ADMIN', 'DIRECTOR', 'DEVELOPER', 'COORDINATOR'];
const INVOICE_APPROVER_ROLES = ['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER', 'COORDINATOR'];
const INVOICE_PAYMENT_ROLES = ['ADMIN', 'DIRECTOR', 'DEVELOPER', 'COORDINATOR'];

const invoiceInclude = {
    supplier: true,
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

// Get Invoices with Filters
export const getInvoices = async (req: AuthRequest, res: Response) => {
    const { status, supplierId } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    try {
        const where: any = {};
        if (status) where.status = status;
        if (supplierId) where.supplierId = supplierId;

        // Role-based visibility
        const isGlobalViewer = hasRole(userRole, GLOBAL_INVOICE_VIEWER_ROLES);

        if (!isGlobalViewer) {
            // Users/Leaders see invoices if they uploaded them OR if they own the related requirement
            where.OR = [
                { createdById: userId },
                { requirement: { createdById: userId } }
            ];
        }

        const invoices = await prisma.invoice.findMany({
            where,
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
    const { invoiceNumber, supplierId, amount, issueDate, dueDate } = req.body;
    const userId = req.user?.id;
    const file = req.file;

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!file) return res.status(400).json({ error: 'Invoice PDF is required' });


    try {
        const normalizedInvoiceNumber = String(invoiceNumber || '').trim();
        if (!normalizedInvoiceNumber) {
            return res.status(400).json({ error: 'El número de factura es requerido' });
        }
        if (!supplierId) {
            return res.status(400).json({ error: 'El proveedor es requerido' });
        }

        const parsedAmount = parsePositiveAmount(amount);
        const parsedIssueDate = parseRequiredDate(issueDate, 'La fecha de emisión');
        const parsedDueDate = parseOptionalDate(dueDate, 'La fecha de vencimiento');

        const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
        if (!supplier) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
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
            return res.status(409).json({ error: 'Ya existe una factura con este número para el proveedor seleccionado' });
        }

        // Normalize path for local fallback immediately
        let fileUrl = file.path.replace(/\\/g, '/');

        // Upload to Blob Storage if available
        try {
            const blobName = `invoices/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
            const blobUrl = await uploadToBlobStorage(file.path, blobName);
            if (blobUrl) {
                fileUrl = blobUrl;
                logger.blob('Invoice uploaded to cloud:', blobUrl);
            }
        } catch (blobErr) {
            logger.error('Failed to upload invoice to blob storage, using local path:', blobErr);
        }

        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber: normalizedInvoiceNumber,
                amount: parsedAmount,
                issueDate: parsedIssueDate,
                dueDate: parsedDueDate,
                supplierId,
                createdById: userId,
                status: 'RECEIVED',
                fileUrl: fileUrl
            }
        });

        await writeInvoiceAuditLog(prisma, {
            invoiceId: invoice.id,
            action: 'INVOICE_CREATED',
            toStatus: 'RECEIVED',
            details: `Factura ${normalizedInvoiceNumber} recepcionada`,
            actorId: userId,
            actorEmail: req.user?.email
        });

        res.status(201).json(invoice);
    } catch (error: any) {
        console.error("Create invoice error:", error);
        res.status(400).json({ error: error.message || 'Error al crear la factura' });
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
