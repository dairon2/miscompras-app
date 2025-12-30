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
    createAsiento,
    createMassRequirements,
    approveRequirementGroup,
    rejectRequirementGroup,
    getRequirementGroups
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
router.get('/asientos', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getAsientos);
router.post('/asientos', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), upload.array('attachments'), createAsiento);

// Requirements Routes
router.post('/', upload.array('attachments'), createRequirement);
router.post('/mass-create', createMassRequirements);
router.get('/me', getMyRequirements);
router.get('/all', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getAllRequirements);
router.get('/:id', getRequirementById);
router.put('/:id', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), upload.array('attachments'), updateRequirement);
router.patch('/:id/status', roleCheck(['LEADER', 'DIRECTOR', 'ADMIN', 'COORDINATOR', 'DEVELOPER']), updateRequirementStatus);
router.post('/group/:id/approve', roleCheck(['LEADER', 'COORDINATOR', 'DIRECTOR', 'ADMIN', 'DEVELOPER']), approveRequirementGroup);
router.post('/group/:id/reject', roleCheck(['LEADER', 'COORDINATOR', 'DIRECTOR', 'ADMIN', 'DEVELOPER']), rejectRequirementGroup);
router.get('/groups', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getRequirementGroups);
router.patch('/:id/observations', updateObservations);
router.delete('/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), deleteRequirement);

export default router;
