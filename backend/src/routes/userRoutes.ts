import { Router } from 'express';
import {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    toggleUserStatus,
    deleteUser,
    changePassword,
    updateProfile,
    getProfile,
    generatePassword
} from '../controllers/userController';
import { authMiddleware, roleCheck } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

// User management routes (requires auth)
router.get('/', getUsers);
router.get('/me', getProfile);
router.patch('/me/password', changePassword);
router.patch('/me/profile', updateProfile);
router.get('/generate-password', generatePassword);

// Admin-only routes
router.get('/:id', getUserById);
router.post('/', roleCheck(['ADMIN']), createUser);
router.put('/:id', roleCheck(['ADMIN']), updateUser);
router.patch('/:id/toggle-status', roleCheck(['ADMIN']), toggleUserStatus);
router.delete('/:id', roleCheck(['ADMIN']), deleteUser);

export default router;
