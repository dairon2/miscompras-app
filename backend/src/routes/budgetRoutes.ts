import { Router } from 'express';
import {
    getBudgets,
    getBudgetById,
    createBudget,
    updateBudget,
    deleteBudget,
    approveBudget,
    getBudgetYears,
    getManagerOptions,
    getPendingBudgetsForManager,
    createMassBudgets,
    approveBudgetGroup,
    rejectBudgetGroup
} from '../controllers/budgetController';
import { authMiddleware, roleCheck } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get budget years for filter dropdown
router.get('/years', getBudgetYears);

// Get users for manager select (used in budget form)
router.get('/manager-options', getManagerOptions);

// Get pending budgets for current user (manager)
router.get('/pending-approval', getPendingBudgetsForManager);

// Get all budgets (with role-based filtering in controller)
router.get('/', getBudgets);

// Get budget by ID
router.get('/:id', getBudgetById);

// Create budget - DIRECTOR or ADMIN
router.post('/', roleCheck(['DIRECTOR', 'ADMIN']), createBudget);

// Update budget - DIRECTOR or ADMIN
router.put('/:id', roleCheck(['DIRECTOR', 'ADMIN']), updateBudget);

// Delete budget - DIRECTOR or ADMIN
router.delete('/:id', roleCheck(['DIRECTOR', 'ADMIN']), deleteBudget);

// Approve/Reject budget (by assigned manager/leader)
router.patch('/:id/approve', approveBudget);

// Mass creation and Group management
router.post('/mass-create', roleCheck(['DIRECTOR', 'ADMIN']), createMassBudgets);
router.post('/group/:id/approve', approveBudgetGroup);
router.post('/group/:id/reject', rejectBudgetGroup);

export default router;
