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
    getPendingApprovalCount,
    checkSubmissionStatus
} from '../controllers/requirementController';
import { authMiddleware, roleCheck } from '../middlewares/auth';
import multer from 'multer';
import path from 'path';

// Sanitize filename: remove accents/diacritics and replace spaces
const sanitizeFilename = (name: string): string => {
    return name
        .normalize('NFD')                    // Decompose accented characters (é → e + ́)
        .replace(/[\u0300-\u036f]/g, '')     // Remove combining diacritical marks
        .replace(/\s+/g, '_')               // Replace spaces with underscores
        .replace(/[^a-zA-Z0-9._-]/g, '');   // Remove any remaining special characters
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + sanitizeFilename(file.originalname));
    }
});

const upload = multer({ storage });

const router = Router();

router.use(authMiddleware);

// Asientos Routes (must be before /:id to avoid conflicts)
// Asientos Routes (must be before /:id to avoid conflicts)
router.get('/years', getAvailableYears);
router.get('/asientos', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getAsientos);
router.post('/asientos', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), upload.array('attachments'), createAsiento);

// Requirements Routes
router.get('/submission-status', roleCheck(['USER', 'ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), checkSubmissionStatus);
router.get('/pending-count', roleCheck(['DIRECTOR', 'COORDINATOR']), getPendingApprovalCount);
router.put('/mass-update', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), updateMassRequirements);
router.post('/', roleCheck(['USER', 'ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), upload.array('attachments'), createRequirement);
router.post('/mass-create', roleCheck(['USER', 'ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), upload.any(), createMassRequirements);

router.get('/me', getMyRequirements);
router.get('/dashboard-stats', getDashboardStats);
router.get('/all', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getAllRequirements);
router.get('/groups', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getRequirementGroups);
router.get('/:id', getRequirementById);
router.put('/:id', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER', 'USER', 'LEADER']), upload.array('attachments'), updateRequirement);
router.patch('/:id/status', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER', 'USER']), updateRequirementStatus); // LEADER removed
router.post('/group/:id/approve', roleCheck(['COORDINATOR', 'DIRECTOR', 'DEVELOPER']), approveRequirementGroup);
router.post('/group/:id/reject', roleCheck(['COORDINATOR', 'DIRECTOR', 'DEVELOPER']), rejectRequirementGroup);
router.patch('/:id/observations', updateObservations);
router.delete('/:id', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), deleteRequirement);

export default router;
