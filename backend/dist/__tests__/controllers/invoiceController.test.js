"use strict";
/**
 * Invoice Controller Unit Tests
 */
Object.defineProperty(exports, "__esModule", { value: true });
const invoiceController_1 = require("../../controllers/invoiceController");
const index_1 = require("../../index");
// Mock Prisma
jest.mock('../../index', () => ({
    prisma: {
        invoice: {
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findUnique: jest.fn()
        },
        requirement: {
            findUnique: jest.fn()
        },
        payment: {
            create: jest.fn()
        },
        historyLog: {
            create: jest.fn()
        }
    }
}));
describe('Invoice Controller', () => {
    let req;
    let res;
    let json;
    let status;
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
        };
    });
    describe('createInvoice', () => {
        it('should create an invoice successfully', async () => {
            req.body = {
                invoiceNumber: 'INV001',
                supplierId: 'sup-1',
                amount: '1000',
                issueDate: '2025-01-01'
            };
            req.file = { path: 'uploads/file.pdf' };
            index_1.prisma.invoice.create.mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV001', status: 'RECEIVED' });
            await (0, invoiceController_1.createInvoice)(req, res);
            expect(index_1.prisma.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
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
            await (0, invoiceController_1.createInvoice)(req, res);
            expect(status).toHaveBeenCalledWith(400);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invoice PDF is required' }));
        });
    });
    describe('verifyInvoice', () => {
        it('should verify match with approved PO', async () => {
            req.params = { id: 'inv-1' };
            req.body = { requirementId: 'req-1' };
            index_1.prisma.requirement.findUnique.mockResolvedValue({ id: 'req-1', status: 'APPROVED' });
            index_1.prisma.invoice.update.mockResolvedValue({ id: 'inv-1', status: 'VERIFIED', requirementId: 'req-1' });
            await (0, invoiceController_1.verifyInvoice)(req, res);
            expect(index_1.prisma.invoice.update).toHaveBeenCalledWith({
                where: { id: 'inv-1' },
                data: { requirementId: 'req-1', status: 'VERIFIED' }
            });
            expect(json).toHaveBeenCalled();
        });
        it('should fail if PO is not approved', async () => {
            req.params = { id: 'inv-1' };
            req.body = { requirementId: 'req-1' };
            index_1.prisma.requirement.findUnique.mockResolvedValue({ id: 'req-1', status: 'PENDING_APPROVAL' });
            await (0, invoiceController_1.verifyInvoice)(req, res);
            expect(status).toHaveBeenCalledWith(400);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Purchase Order is not approved' }));
        });
    });
    describe('approveInvoice', () => {
        it('should allow LEADER to approve', async () => {
            req.user.role = 'LEADER';
            req.params = { id: 'inv-1' };
            index_1.prisma.invoice.update.mockResolvedValue({ id: 'inv-1', status: 'APPROVED' });
            await (0, invoiceController_1.approveInvoice)(req, res);
            expect(index_1.prisma.invoice.update).toHaveBeenCalledWith({
                where: { id: 'inv-1' },
                data: { status: 'APPROVED' }
            });
        });
        it('should deny regular USER', async () => {
            req.user.role = 'USER';
            req.params = { id: 'inv-1' };
            await (0, invoiceController_1.approveInvoice)(req, res);
            expect(status).toHaveBeenCalledWith(403);
        });
    });
    describe('payInvoice', () => {
        it('should mark as PAID and create payment record', async () => {
            req.params = { id: 'inv-1' };
            req.body = { paymentDate: '2025-01-10' };
            index_1.prisma.invoice.update.mockResolvedValue({
                id: 'inv-1',
                status: 'PAID',
                amount: 1000,
                invoiceNumber: 'INV001',
                requirementId: 'req-1'
            });
            await (0, invoiceController_1.payInvoice)(req, res);
            expect(index_1.prisma.invoice.update).toHaveBeenCalledWith({
                where: { id: 'inv-1' },
                data: { status: 'PAID' },
                include: { requirement: true }
            });
            expect(index_1.prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    requirementId: 'req-1',
                    amount: 1000,
                    invoiceNumber: 'INV001'
                })
            }));
        });
    });
});
