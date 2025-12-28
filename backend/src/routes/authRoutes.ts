import { Router } from 'express';
import { register, login, getUsers, forgotPassword, resetPassword, refreshToken } from '../controllers/authController';
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

export default router;
