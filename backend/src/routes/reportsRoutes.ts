import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import {
    getExecutiveSummary,
    getBudgetExecutionByProject,
    getBudgetExecutionByArea,
    getRequirementsByStatus,
    getTopSuppliers,
    getMonthlyTrend,
    getPaymentsCalendar
} from '../controllers/reportsController';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Role-based middleware for finance reports
const financeRoles = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'AUDITOR', 'DEVELOPER'];

const requireFinanceRole = (req: any, res: any, next: any) => {
    if (!financeRoles.includes(req.user?.role)) {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de finanzas.' });
    }
    next();
};

// Apply finance role check to all routes
router.use(requireFinanceRole);

// Executive Dashboard
router.get('/executive-summary', getExecutiveSummary);

// Budget Execution
router.get('/budget-execution/project', getBudgetExecutionByProject);
router.get('/budget-execution/area', getBudgetExecutionByArea);

// Requirements Analytics
router.get('/requirements-by-status', getRequirementsByStatus);

// Supplier Analytics
router.get('/top-suppliers', getTopSuppliers);

// Trends
router.get('/monthly-trend', getMonthlyTrend);

// Payments
router.get('/payments-calendar', getPaymentsCalendar);

export default router;
