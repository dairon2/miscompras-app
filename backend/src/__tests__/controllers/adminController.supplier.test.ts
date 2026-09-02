jest.mock('../../index', () => ({
    prisma: {
        supplier: {
            findUnique: jest.fn(),
            update: jest.fn()
        }
    }
}));

import { prisma } from '../../index';
import { updateSupplier } from '../../controllers/adminController';

const createResponse = () => {
    const response: any = {
        status: jest.fn(),
        json: jest.fn()
    };
    response.status.mockReturnValue(response);
    return response;
};

describe('supplier creation date authorization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rejects a creation date change from a director', async () => {
        const request: any = {
            params: { id: 'supplier-id' },
            user: { id: 'director-id', role: 'DIRECTOR' },
            body: { name: 'Proveedor', createdAt: '2026-07-30T07:21:22.000Z' }
        };
        const response = createResponse();

        await updateSupplier(request, response);

        expect(response.status).toHaveBeenCalledWith(403);
        expect(prisma.supplier.update).not.toHaveBeenCalled();
    });

    it('rejects a future creation date from an administrator', async () => {
        const request: any = {
            params: { id: 'supplier-id' },
            user: { id: 'admin-id', role: 'ADMIN' },
            body: { name: 'Proveedor', createdAt: '2999-01-01T00:00:00.000Z' }
        };
        const response = createResponse();

        await updateSupplier(request, response);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(prisma.supplier.update).not.toHaveBeenCalled();
    });

    it('allows an administrator to save a valid creation date', async () => {
        const request: any = {
            params: { id: 'supplier-id' },
            user: { id: 'admin-id', role: 'ADMIN' },
            body: { name: 'Proveedor', createdAt: '2026-07-30T07:21:22.000Z' }
        };
        const response = createResponse();
        (prisma.supplier.update as jest.Mock).mockResolvedValue({
            id: 'supplier-id',
            name: 'Proveedor',
            createdAt: new Date('2026-07-30T07:21:22.000Z')
        });

        await updateSupplier(request, response);

        expect(prisma.supplier.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'supplier-id' },
            data: expect.objectContaining({
                createdAt: new Date('2026-07-30T07:21:22.000Z')
            })
        }));
        expect(response.json).toHaveBeenCalled();
    });
});
