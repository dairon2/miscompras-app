"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const budgetController_1 = require("../controllers/budgetController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authMiddleware);
// Get budget years for filter dropdown
router.get('/years', budgetController_1.getBudgetYears);
// Get users for manager select (used in budget form)
router.get('/manager-options', budgetController_1.getManagerOptions);
// Get all budgets (with role-based filtering in controller)
router.get('/', budgetController_1.getBudgets);
// Get budget by ID
router.get('/:id', budgetController_1.getBudgetById);
// Create budget - DIRECTOR only
router.post('/', (0, auth_1.roleCheck)(['DIRECTOR']), budgetController_1.createBudget);
// Update budget - DIRECTOR only
router.put('/:id', (0, auth_1.roleCheck)(['DIRECTOR']), budgetController_1.updateBudget);
// Delete budget - DIRECTOR only
router.delete('/:id', (0, auth_1.roleCheck)(['DIRECTOR']), budgetController_1.deleteBudget);
// Approve/Reject budget (by assigned manager/leader)
router.patch('/:id/approve', budgetController_1.approveBudget);
exports.default = router;
