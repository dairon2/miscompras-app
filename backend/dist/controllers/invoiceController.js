"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payInvoice = exports.approveInvoice = exports.verifyInvoice = exports.createInvoice = exports.getInvoices = void 0;
const index_1 = require("../index");
// Get Invoices with Filters
const getInvoices = async (req, res) => {
    const { status, supplierId } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    try {
        const where = {};
        if (status)
            where.status = status;
        if (supplierId)
            where.supplierId = supplierId;
        // Role-based visibility
        // ADMIN, DIRECTOR, AUDITOR see all
        // LEADER sees their area's invoices (via Requirements or created by them?)
        // For now, simplificamos: Leaders see everything to facilitate approval
        const invoices = await index_1.prisma.invoice.findMany({
            where,
            include: {
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
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(invoices);
    }
    catch (error) {
        console.error("Get invoices error:", error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
};
exports.getInvoices = getInvoices;
// Create Invoice (Reception)
const createInvoice = async (req, res) => {
    const { invoiceNumber, supplierId, amount, issueDate, dueDate } = req.body;
    const userId = req.user?.id;
    const file = req.file;
    if (!userId)
        return res.status(401).json({ error: 'User not authenticated' });
    if (!file)
        return res.status(400).json({ error: 'Invoice PDF is required' });
    try {
        const invoice = await index_1.prisma.invoice.create({
            data: {
                invoiceNumber,
                amount: parseFloat(amount),
                issueDate: new Date(issueDate),
                dueDate: dueDate ? new Date(dueDate) : null,
                supplierId,
                createdById: userId,
                status: 'RECEIVED',
                fileUrl: file.path // Azure Blob Storage will return the URL here in the real middleware setup
            }
        });
        // Log
        // Note: HistoryLog requires a valid requirementId which we don't have yet.
        // We will skip logging to HistoryLog for now or implementing a separate InvoiceLog later.
        /*
        await prisma.historyLog.create({
            data: {
                action: 'INVOICE_CREATED',
                details: `Factura ${invoiceNumber} subida por ${req.user?.email}`,
                requirementId: ''
            }
        }).catch(err => console.warn("Could not create history log for invoice (no reqId)", err));
        */
        res.status(201).json(invoice);
    }
    catch (error) {
        console.error("Create invoice error:", error);
        res.status(400).json({ error: 'Failed to create invoice', details: error.message });
    }
};
exports.createInvoice = createInvoice;
// Verify Invoice (Link to PO)
const verifyInvoice = async (req, res) => {
    const { id } = req.params;
    const { requirementId } = req.body;
    const userId = req.user?.id;
    try {
        const requirement = await index_1.prisma.requirement.findUnique({ where: { id: requirementId } });
        if (!requirement)
            return res.status(404).json({ error: 'Purchase Order (Requirement) not found' });
        if (requirement.status !== 'APPROVED') {
            return res.status(400).json({ error: 'Purchase Order is not approved' });
        }
        const invoice = await index_1.prisma.invoice.update({
            where: { id },
            data: {
                requirementId,
                status: 'VERIFIED'
            }
        });
        res.json(invoice);
    }
    catch (error) {
        res.status(400).json({ error: 'Failed to verify invoice' });
    }
};
exports.verifyInvoice = verifyInvoice;
// Approve Payment (Leader)
const approveInvoice = async (req, res) => {
    const { id } = req.params;
    const userRole = req.user?.role;
    if (!['ADMIN', 'DIRECTOR', 'LEADER'].includes(userRole || '')) {
        return res.status(403).json({ error: 'Not authorized to approve payments' });
    }
    try {
        const invoice = await index_1.prisma.invoice.update({
            where: { id },
            data: { status: 'APPROVED' }
        });
        res.json(invoice);
    }
    catch (error) {
        res.status(400).json({ error: 'Failed to approve invoice' });
    }
};
exports.approveInvoice = approveInvoice;
// Pay Invoice (Finalize)
const payInvoice = async (req, res) => {
    const { id } = req.params;
    const { paymentDate, transactionNumber } = req.body;
    try {
        // 1. Mark Invoice as PAID
        const invoice = await index_1.prisma.invoice.update({
            where: { id },
            data: { status: 'PAID' },
            include: { requirement: true }
        });
        // 2. Create Payment record in Requirement (Consistency)
        if (invoice.requirementId) {
            await index_1.prisma.payment.create({
                data: {
                    requirementId: invoice.requirementId,
                    paymentNumber: 1, // Logic for sequential numbers needed
                    amount: invoice.amount,
                    invoiceNumber: invoice.invoiceNumber,
                    paymentDate: new Date(paymentDate || new Date()),
                    observations: `Pago generado desde Factura ${invoice.invoiceNumber}. Transacción: ${transactionNumber || 'N/A'}`
                }
            });
        }
        res.json(invoice);
    }
    catch (error) {
        res.status(400).json({ error: 'Failed to register payment' });
    }
};
exports.payInvoice = payInvoice;
