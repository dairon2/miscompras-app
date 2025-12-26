import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import {
    exportRequirements,
    exportBudgets,
    exportSuppliers
} from '../controllers/reportController';

const router = Router();

// Todas las rutas de reportes requieren autenticación
router.get('/requirements', authMiddleware, exportRequirements);
router.get('/budgets', authMiddleware, exportBudgets);
router.get('/suppliers', authMiddleware, exportSuppliers);

export default router;
