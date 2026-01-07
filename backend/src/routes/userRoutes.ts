import { Router } from 'express';
import multer from 'multer';
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
    generatePassword,
    uploadProfilePhoto
} from '../controllers/userController';
import { authMiddleware, roleCheck } from '../middlewares/auth';

const router = Router();

// Configure multer for memory storage (for profile photos)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.use(authMiddleware);

// User management routes (requires auth)
router.get('/', getUsers);
router.get('/me', getProfile);
router.patch('/me/password', changePassword);
router.patch('/me/profile', updateProfile);
router.post('/me/photo', upload.single('photo'), uploadProfilePhoto);
router.get('/generate-password', generatePassword);

// Admin-only routes
router.get('/:id', getUserById);
router.post('/', roleCheck(['ADMIN']), createUser);
router.put('/:id', roleCheck(['ADMIN']), updateUser);
router.patch('/:id/toggle-status', roleCheck(['ADMIN']), toggleUserStatus);
router.delete('/:id', roleCheck(['ADMIN']), deleteUser);

export default router;
