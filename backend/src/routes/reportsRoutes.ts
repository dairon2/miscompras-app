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

// Role-based data filtering middleware - ALL authenticated users can access
// but data is filtered based on role
const setupDataFiltering = async (req: any, res: any, next: any) => {
    try {
        const userRole = req.user?.role;
        const userId = req.user?.id;

        // Roles that see all data
        const fullAccessRoles = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'AUDITOR', 'DEVELOPER'];

        if (fullAccessRoles.includes(userRole)) {
            req.dataScope = 'ALL';
            return next();
        }

        // For USER role, determine scope
        if (userRole === 'USER') {
            const { prisma } = await import('../index');

            // Check if user is an area director
            const userAreasDirected = await prisma.area.findMany({
                where: { directorId: userId },
                select: { id: true }
            });

            if (userAreasDirected.length > 0) {
                // Area director: filter by their areas
                req.dataScope = 'AREA';
                req.directedAreaIds = userAreasDirected.map(a => a.id);
                return next();
            }

            // Normal user: filter by their own created data
            req.dataScope = 'USER';
            req.filterUserId = userId;
            return next();
        }

        // Default: user-level access
        req.dataScope = 'USER';
        req.filterUserId = userId;
        return next();
    } catch (error) {
        console.error('Error in data filtering middleware:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Apply data filtering to all routes
router.use(setupDataFiltering);

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
