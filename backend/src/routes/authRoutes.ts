import { Router } from 'express';
import { register, login, getUsers, forgotPassword, resetPassword, refreshToken, changePassword } from '../controllers/authController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);

// Protected routes
router.get('/users', authMiddleware, getUsers);
router.post('/change-password', authMiddleware, changePassword as any);

export default router;
