import { Router } from 'express';
import { register, login, getUsers } from '../controllers/authController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/users', authMiddleware, getUsers);

export default router;
