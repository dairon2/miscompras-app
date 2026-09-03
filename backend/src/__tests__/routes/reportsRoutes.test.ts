import express from 'express';
import request from 'supertest';

const exportSuppliersMock = jest.fn((_req, res) => {
    res.status(200).send('supplier-export');
});

jest.mock('../../middlewares/auth', () => ({
    authMiddleware: (req: any, _res: any, next: any) => {
        req.user = { id: 'admin-id', role: 'ADMIN' };
        next();
    }
}));

jest.mock('../../controllers/reportsController', () => ({
    getExecutiveSummary: jest.fn(),
    getBudgetExecutionByProject: jest.fn(),
    getBudgetExecutionByArea: jest.fn(),
    getRequirementsByStatus: jest.fn(),
    getTopSuppliers: jest.fn(),
    getMonthlyTrend: jest.fn(),
    getPaymentsCalendar: jest.fn()
}));

jest.mock('../../controllers/reportController', () => ({
    exportSuppliers: exportSuppliersMock
}));

import reportsRoutes from '../../routes/reportsRoutes';

describe('reports routes', () => {
    it('connects the supplier Excel export endpoint', async () => {
        const app = express();
        app.use('/api/reports', reportsRoutes);

        const response = await request(app).get('/api/reports/suppliers');

        expect(response.status).toBe(200);
        expect(response.text).toBe('supplier-export');
        expect(exportSuppliersMock).toHaveBeenCalledTimes(1);
    });
});
