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
router.post('/:requirementId', createPayment);
router.get('/:requirementId', getPaymentsByRequirement);
router.put('/update/:paymentId', updatePayment);
router.delete('/delete/:paymentId', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER']), deletePayment);
router.patch('/:requirementId/toggle-multiple', toggleMultiplePayments);

export default router;
