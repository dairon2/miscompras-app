"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const reportsController_1 = require("../controllers/reportsController");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authMiddleware);
// Role-based data filtering middleware - ALL authenticated users can access
// but data is filtered based on role
const setupDataFiltering = async (req, res, next) => {
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
            const { prisma } = await Promise.resolve().then(() => __importStar(require('../index')));
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
    }
    catch (error) {
        console.error('Error in data filtering middleware:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};
// Apply data filtering to all routes
router.use(setupDataFiltering);
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
