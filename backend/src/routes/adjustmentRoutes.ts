import { Router } from 'express';
import {
    createAdjustment,
    getMyAdjustments,
    getPendingAdjustments,
    getAllAdjustments,
    approveAdjustment,
    rejectAdjustment,
    getAdjustmentById
} from '../controllers/adjustmentController';
import { authMiddleware, roleCheck } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Create adjustment request (any authenticated user)
router.post('/', createAdjustment);

// Get my adjustment requests
router.get('/my', getMyAdjustments);

// Get pending adjustments - DIRECTOR only
router.get('/pending', roleCheck(['DIRECTOR']), getPendingAdjustments);

// Get all adjustments (for history/filtering)
router.get('/', getAllAdjustments);

// Get adjustment by ID
router.get('/:id', getAdjustmentById);

// Approve adjustment - DIRECTOR only
router.patch('/:id/approve', roleCheck(['DIRECTOR']), approveAdjustment);

// Reject adjustment - DIRECTOR only
router.patch('/:id/reject', roleCheck(['DIRECTOR']), rejectAdjustment);

export default router;
