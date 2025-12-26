import { Router } from 'express';
import { createRequirement, getMyRequirements, getRequirementById, updateRequirementStatus, updateRequirement } from '../controllers/requirementController';
import { authMiddleware, roleCheck } from '../middlewares/auth';
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

const router = Router();

router.use(authMiddleware);

router.post('/', authMiddleware, upload.array('attachments'), createRequirement);
router.get('/me', authMiddleware, getMyRequirements);
router.get('/:id', authMiddleware, getRequirementById);
router.put('/:id', authMiddleware, roleCheck(['ADMIN', 'DIRECTOR', 'LEADER']), updateRequirement);
router.patch('/:id/status', authMiddleware, roleCheck(['LEADER', 'DIRECTOR', 'ADMIN']), updateRequirementStatus);

export default router;
