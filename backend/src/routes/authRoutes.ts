import { Router } from 'express';
import { register, login, getUsers, forgotPassword, resetPassword, refreshToken, changePassword } from '../controllers/authController';
import { authMiddleware, roleCheck } from '../middlewares/auth';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);

// Protected routes
router.get('/users', authMiddleware, roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getUsers);
router.post('/change-password', authMiddleware, changePassword as any);

export default router;
