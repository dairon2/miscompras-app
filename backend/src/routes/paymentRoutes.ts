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
router.post('/:requirementId', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER', 'LEADER']), createPayment);
router.get('/:requirementId', getPaymentsByRequirement);
router.put('/update/:paymentId', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER', 'LEADER']), updatePayment);
router.delete('/delete/:paymentId', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER', 'LEADER']), deletePayment);
router.patch('/:requirementId/toggle-multiple', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER', 'LEADER']), toggleMultiplePayments);

export default router;
