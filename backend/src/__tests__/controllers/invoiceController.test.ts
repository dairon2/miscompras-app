/**
 * Invoice Controller Unit Tests
 */

import { Request, Response } from 'express';
import { createInvoice, getInvoices, getInvoiceById, verifyInvoice, approveInvoice, payInvoice } from '../../controllers/invoiceController';
import { prisma } from '../../index';

// Mock Prisma
jest.mock('../../index', () => ({
    prisma: {
        invoice: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findUnique: jest.fn()
        },
        supplier: {
            findUnique: jest.fn()
        },
        requirement: {
            findUnique: jest.fn()
        },
        payment: {
            findFirst: jest.fn(),
            create: jest.fn()
        },
        historyLog: {
            create: jest.fn()
        },
        invoiceAuditLog: {
            create: jest.fn()
        },
        $transaction: jest.fn()
    }
}));

describe('Invoice Controller', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let json: jest.Mock;
    let status: jest.Mock;

    beforeEach(() => {
        // Clear all mocks on the prisma object
        jest.clearAllMocks();
        json = jest.fn();
        status = jest.fn().mockReturnValue({ json });
        res = { json, status };
        req = {
            user: { id: 'user-1', role: 'ADMIN', email: 'test@example.com' },
            body: {},
            params: {},
            query: {}
        } as any;
        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));
    });

    describe('createInvoice', () => {
        it('should create an invoice successfully', async () => {
            req.body = {
                invoiceNumber: 'INV001',
                supplierId: 'sup-1',
                amount: '1000',
                issueDate: '2025-01-01'
            };
            req.file = { path: 'uploads/file.pdf' } as any;

            (prisma.supplier.findUnique as jest.Mock).mockResolvedValue({ id: 'sup-1' });
            (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.invoice.create as jest.Mock).mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV001', status: 'RECEIVED' });

            await createInvoice(req as Request, res as Response);

            expect(prisma.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    invoiceNumber: 'INV001',
                    amount: 1000,
                    status: 'RECEIVED'
                })
            }));
            expect(status).toHaveBeenCalledWith(201);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ id: 'inv-1' }));
        });

        it('should return error if file is missing', async () => {
            req.body = { invoiceNumber: 'INV001' };
            // no file

            await createInvoice(req as Request, res as Response);

            expect(status).toHaveBeenCalledWith(400);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invoice PDF is required' }));
        });
    });

    describe('getInvoiceById', () => {
        it('should return invoice when the user can view it', async () => {
            req.params = { id: 'inv-1' };

            (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
                id: 'inv-1',
                createdById: 'user-1',
                requirement: null
            });

            await getInvoiceById(req as Request, res as Response);

            expect(prisma.invoice.findUnique).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'inv-1' }
            }));
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ id: 'inv-1' }));
        });

        it('should deny invoice detail for users without visibility', async () => {
            (req as any).user.role = 'USER';
            (req as any).user.id = 'user-2';
            req.params = { id: 'inv-1' };

            (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
                id: 'inv-1',
                createdById: 'user-1',
                requirement: { createdById: 'user-3' }
            });

            await getInvoiceById(req as Request, res as Response);

            expect(status).toHaveBeenCalledWith(403);
        });
    });

    describe('getInvoices', () => {
        it('should combine search filters with the visibility scope', async () => {
            (req as any).user.role = 'USER';
            (req as any).user.id = 'user-1';
            req.query = { search: 'FE-001', status: 'RECEIVED' };
            (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

            await getInvoices(req as Request, res as Response);

            expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: {
                    AND: expect.arrayContaining([
                        { status: 'RECEIVED' },
                        expect.objectContaining({ OR: expect.arrayContaining([
                            { invoiceNumber: { contains: 'FE-001', mode: 'insensitive' } }
                        ]) }),
                        { OR: [
                            { createdById: 'user-1' },
                            { requirement: { createdById: 'user-1' } }
                        ] }
                    ])
                }
            }));
            expect(json).toHaveBeenCalledWith([]);
        });
    });

    describe('verifyInvoice', () => {
        it('should verify match with approved PO', async () => {
            req.params = { id: 'inv-1' };
            req.body = { requirementId: 'req-1' };

            (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ id: 'inv-1', status: 'RECEIVED', supplierId: 'sup-1' });
            (prisma.requirement.findUnique as jest.Mock).mockResolvedValue({ id: 'req-1', status: 'APPROVED', supplierId: 'sup-1' });
            (prisma.invoice.update as jest.Mock).mockResolvedValue({ id: 'inv-1', status: 'VERIFIED', requirementId: 'req-1' });

            await verifyInvoice(req as Request, res as Response);

            expect(prisma.invoice.update).toHaveBeenCalledWith({
                where: { id: 'inv-1' },
                data: expect.objectContaining({ requirementId: 'req-1', status: 'VERIFIED', verifiedById: 'user-1' })
            });
            expect(prisma.invoiceAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ action: 'INVOICE_VERIFIED', invoiceId: 'inv-1' })
            }));
            expect(json).toHaveBeenCalled();
        });

        it('should fail if PO is not approved', async () => {
            req.params = { id: 'inv-1' };
            req.body = { requirementId: 'req-1' };

            (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ id: 'inv-1', status: 'RECEIVED', supplierId: 'sup-1' });
            (prisma.requirement.findUnique as jest.Mock).mockResolvedValue({ id: 'req-1', status: 'PENDING_APPROVAL' });

            await verifyInvoice(req as Request, res as Response);

            expect(status).toHaveBeenCalledWith(400);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'El requerimiento debe estar aprobado para vincular una factura' }));
        });
    });

    describe('approveInvoice', () => {
        it('should allow LEADER to approve', async () => {
            (req as any).user.role = 'LEADER';
            req.params = { id: 'inv-1' };

            (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ id: 'inv-1', status: 'VERIFIED' });
            (prisma.invoice.update as jest.Mock).mockResolvedValue({ id: 'inv-1', status: 'APPROVED' });

            await approveInvoice(req as Request, res as Response);

            expect(prisma.invoice.update).toHaveBeenCalledWith({
                where: { id: 'inv-1' },
                data: expect.objectContaining({ status: 'APPROVED', approvedById: 'user-1' })
            });
            expect(prisma.invoiceAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ action: 'INVOICE_APPROVED', invoiceId: 'inv-1' })
            }));
        });

        it('should deny regular USER', async () => {
            (req as any).user.role = 'USER';
            req.params = { id: 'inv-1' };

            await approveInvoice(req as Request, res as Response);

            expect(status).toHaveBeenCalledWith(403);
        });
    });

    describe('payInvoice', () => {
        it('should mark as PAID and create payment record', async () => {
            req.params = { id: 'inv-1' };
            req.body = { paymentDate: '2025-01-10' };

            const tx = {
                invoice: {
                    findUnique: jest.fn()
                        .mockResolvedValueOnce({
                            id: 'inv-1',
                            status: 'APPROVED',
                            amount: 1000,
                            invoiceNumber: 'INV001',
                            requirementId: 'req-1',
                            requirement: { id: 'req-1', hasMultiplePayments: true, payments: [] }
                        })
                        .mockResolvedValueOnce({
                            id: 'inv-1',
                            status: 'PAID',
                            amount: 1000,
                            invoiceNumber: 'INV001',
                            requirementId: 'req-1'
                        }),
                    update: jest.fn().mockResolvedValue({
                        id: 'inv-1',
                        status: 'PAID'
                    })
                },
                payment: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(null)
                        .mockResolvedValueOnce({ paymentNumber: 2 }),
                    create: jest.fn().mockResolvedValue({ id: 'pay-1' })
                },
                historyLog: {
                    create: jest.fn().mockResolvedValue({ id: 'log-1' })
                },
                invoiceAuditLog: {
                    create: jest.fn().mockResolvedValue({ id: 'audit-1' })
                }
            };

            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));

            await payInvoice(req as Request, res as Response);

            expect(tx.invoice.update).toHaveBeenCalledWith({
                where: { id: 'inv-1' },
                data: expect.objectContaining({ status: 'PAID', paidById: 'user-1' })
            });

            expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    requirementId: 'req-1',
                    invoiceId: 'inv-1',
                    paymentNumber: 3,
                    amount: 1000,
                    invoiceNumber: 'INV001'
                })
            }));
            expect(tx.invoiceAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ action: 'INVOICE_PAID', invoiceId: 'inv-1' })
            }));
            expect(json).toHaveBeenCalledWith(expect.objectContaining({
                id: 'inv-1',
                status: 'PAID'
            }));
        });

        it('should reject payment when invoice is not approved', async () => {
            req.params = { id: 'inv-1' };
            req.body = { paymentDate: '2025-01-10' };

            const tx = {
                invoice: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 'inv-1',
                        status: 'VERIFIED',
                        requirementId: 'req-1'
                    })
                }
            };

            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));

            await payInvoice(req as Request, res as Response);

            expect(status).toHaveBeenCalledWith(400);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Solo se pueden pagar facturas autorizadas. Estado actual: VERIFIED'
            }));
        });
    });
});
