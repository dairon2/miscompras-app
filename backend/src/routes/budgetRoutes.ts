import { Router } from 'express';
import {
    getBudgets,
    getBudgetById,
    createBudget,
    updateBudget,
    deleteBudget,
    approveBudget,
    getBudgetYears,
    getManagerOptions
} from '../controllers/budgetController';
import { authMiddleware, roleCheck } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get budget years for filter dropdown
router.get('/years', getBudgetYears);

// Get users for manager select (used in budget form)
router.get('/manager-options', getManagerOptions);

// Get all budgets (with role-based filtering in controller)
router.get('/', getBudgets);

// Get budget by ID
router.get('/:id', getBudgetById);

// Create budget - DIRECTOR only
router.post('/', roleCheck(['DIRECTOR']), createBudget);

// Update budget - DIRECTOR only
router.put('/:id', roleCheck(['DIRECTOR']), updateBudget);

// Delete budget - DIRECTOR only
router.delete('/:id', roleCheck(['DIRECTOR']), deleteBudget);

// Approve/Reject budget (by assigned manager/leader)
router.patch('/:id/approve', approveBudget);

export default router;
