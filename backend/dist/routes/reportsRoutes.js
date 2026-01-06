"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const reportsController_1 = require("../controllers/reportsController");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authMiddleware);
// Role-based middleware for finance reports
const financeRoles = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'AUDITOR', 'DEVELOPER'];
const requireFinanceRole = (req, res, next) => {
    if (!financeRoles.includes(req.user?.role)) {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de finanzas.' });
    }
    next();
};
// Apply finance role check to all routes
router.use(requireFinanceRole);
// Executive Dashboard
router.get('/executive-summary', reportsController_1.getExecutiveSummary);
// Budget Execution
router.get('/budget-execution/project', reportsController_1.getBudgetExecutionByProject);
router.get('/budget-execution/area', reportsController_1.getBudgetExecutionByArea);
// Requirements Analytics
router.get('/requirements-by-status', reportsController_1.getRequirementsByStatus);
// Supplier Analytics
router.get('/top-suppliers', reportsController_1.getTopSuppliers);
// Trends
router.get('/monthly-trend', reportsController_1.getMonthlyTrend);
// Payments
router.get('/payments-calendar', reportsController_1.getPaymentsCalendar);
exports.default = router;
