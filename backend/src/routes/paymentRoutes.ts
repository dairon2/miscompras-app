import { Router } from 'express';
import {
    createPayment,
    getPaymentsByRequirement,
    updatePayment,
    deletePayment,
    toggleMultiplePayments
} from '../controllers/paymentController';
import { authMiddleware, roleCheck } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

// Payment routes
router.post('/:requirementId', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), createPayment);
router.get('/:requirementId', getPaymentsByRequirement);
router.put('/update/:paymentId', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), updatePayment);
router.delete('/delete/:paymentId', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), deletePayment);
router.patch('/:requirementId/toggle-multiple', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), toggleMultiplePayments);

export default router;
