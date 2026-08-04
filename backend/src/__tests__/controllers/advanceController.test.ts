import { Request, Response } from 'express';
import { createAdvance, updateAdvanceStatus } from '../../controllers/advanceController';
import { prisma } from '../../index';

jest.mock('../../index', () => ({
    prisma: {
        advance: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
        advanceSequence: { upsert: jest.fn() },
        advanceAuditLog: { create: jest.fn() },
        $transaction: jest.fn()
    }
}));

describe('Advance Controller', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let json: jest.Mock;
    let status: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        json = jest.fn();
        status = jest.fn().mockReturnValue({ json });
        res = { json, status };
        req = { user: { id: 'user-1', role: 'COORDINATOR', email: 'coord@example.com' }, body: {}, params: {}, files: [] } as any;
        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));
    });

    it('creates a yearly consecutive advance with a 15-day legalization deadline', async () => {
        req.body = { beneficiaryType: 'EMPLOYEE', beneficiaryDocument: '1010094522', beneficiaryName: 'Dario Moreno', amount: '50000', purpose: 'Anticipo de prueba', requestDate: '2026-07-23' };
        (prisma.advanceSequence.upsert as jest.Mock).mockResolvedValue({ year: 2026, nextConsecutive: 4633 });
        (prisma.advance.create as jest.Mock).mockResolvedValue({ id: 'adv-1', year: 2026, consecutive: 4632 });

        await createAdvance(req as Request, res as Response);

        expect(prisma.advance.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ consecutive: 4632, year: 2026, amount: 50000, beneficiaryType: 'EMPLOYEE', legalizationDueDate: new Date('2026-08-07') })
        }));
        expect(prisma.advanceAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'ADVANCE_CREATED', toStatus: 'REQUESTED' }) }));
        expect(status).toHaveBeenCalledWith(201);
    });

    it('records who legalizes a disbursed advance', async () => {
        req.params = { id: 'adv-1' };
        req.body = { status: 'LEGALIZED', legalizationNotes: 'Soportes completos' };
        (prisma.advance.findUnique as jest.Mock).mockResolvedValue({ id: 'adv-1', status: 'DISBURSED' });
        (prisma.advance.update as jest.Mock).mockResolvedValue({ id: 'adv-1', status: 'LEGALIZED' });

        await updateAdvanceStatus(req as Request, res as Response);

        expect(prisma.advance.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'LEGALIZED', legalizedById: 'user-1' }) }));
        expect(prisma.advanceAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'ADVANCE_LEGALIZED', fromStatus: 'DISBURSED', toStatus: 'LEGALIZED' }) }));
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ status: 'LEGALIZED' }));
    });
});
