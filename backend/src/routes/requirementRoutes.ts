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
    getRequirementGroups,
    getAvailableYears,
    getDashboardStats,
    updateMassRequirements,
    getPendingApprovalCount
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
router.get('/years', getAvailableYears);
router.get('/asientos', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getAsientos);
router.post('/asientos', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), upload.array('attachments'), createAsiento);

// Requirements Routes
router.get('/pending-count', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), getPendingApprovalCount);
router.put('/mass-update', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), updateMassRequirements);
router.post('/', upload.array('attachments'), createRequirement);
router.post('/mass-create', createMassRequirements);

router.get('/me', getMyRequirements);
router.get('/dashboard-stats', getDashboardStats);
router.get('/all', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getAllRequirements);
router.get('/groups', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getRequirementGroups);
router.get('/:id', getRequirementById);
router.put('/:id', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), upload.array('attachments'), updateRequirement);
router.patch('/:id/status', roleCheck(['DIRECTOR', 'COORDINATOR', 'DEVELOPER']), updateRequirementStatus);
router.post('/group/:id/approve', roleCheck(['COORDINATOR', 'DIRECTOR', 'DEVELOPER']), approveRequirementGroup);
router.post('/group/:id/reject', roleCheck(['COORDINATOR', 'DIRECTOR', 'DEVELOPER']), rejectRequirementGroup);
router.patch('/:id/observations', updateObservations);
router.delete('/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), deleteRequirement);

export default router;
