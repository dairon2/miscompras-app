import { Router } from 'express';
import {
    createRequirement,
    getMyRequirements,
    getAllRequirements,
    getRequirementById,
    updateRequirementStatus,
    updateRequirement,
    updateObservations,
    deleteRequirement,
    getAsientos,
    createAsiento
} from '../controllers/requirementController';
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

// Asientos Routes (must be before /:id to avoid conflicts)
router.get('/asientos', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER']), getAsientos);
router.post('/asientos', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER']), upload.array('attachments'), createAsiento);

// Requirements Routes
router.post('/', upload.array('attachments'), createRequirement);
router.get('/me', getMyRequirements);
router.get('/all', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER']), getAllRequirements);
router.get('/:id', getRequirementById);
router.put('/:id', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER']), updateRequirement);
router.patch('/:id/status', roleCheck(['LEADER', 'DIRECTOR', 'ADMIN']), updateRequirementStatus);
router.patch('/:id/observations', updateObservations);
router.delete('/:id', roleCheck(['ADMIN', 'DIRECTOR']), deleteRequirement);

export default router;
