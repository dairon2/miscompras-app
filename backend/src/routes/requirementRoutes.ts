import { NextFunction, Request, Response, Router } from 'express';
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

const MAX_ATTACHMENT_SIZE_MB = 20;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
const MAX_ATTACHMENTS_PER_REQUEST = 100;

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

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_ATTACHMENT_SIZE_BYTES,
        files: MAX_ATTACHMENTS_PER_REQUEST
    }
});

const handleUploadError = (err: any, res: Response) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                error: 'Archivo demasiado grande',
                message: `Cada adjunto debe pesar máximo ${MAX_ATTACHMENT_SIZE_MB} MB.`
            });
        }

        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(413).json({
                error: 'Demasiados archivos',
                message: `Puedes enviar máximo ${MAX_ATTACHMENTS_PER_REQUEST} adjuntos por solicitud.`
            });
        }

        return res.status(400).json({
            error: 'No se pudieron procesar los adjuntos',
            message: 'Revisa los archivos seleccionados e intenta nuevamente.'
        });
    }

    console.error('Upload middleware error:', err);
    return res.status(500).json({
        error: 'Error al adjuntar archivos',
        message: 'No pudimos procesar los adjuntos. Intenta nuevamente o contacta soporte si el problema continúa.'
    });
};

const uploadAttachments = (req: Request, res: Response, next: NextFunction) => {
    upload.array('attachments')(req, res, (err: any) => {
        if (err) return handleUploadError(err, res);
        next();
    });
};

const uploadAnyAttachments = (req: Request, res: Response, next: NextFunction) => {
    upload.any()(req, res, (err: any) => {
        if (err) return handleUploadError(err, res);
        next();
    });
};

const router = Router();

router.use(authMiddleware);

// Asientos Routes (must be before /:id to avoid conflicts)
// Asientos Routes (must be before /:id to avoid conflicts)
router.get('/years', getAvailableYears);
router.get('/asientos', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getAsientos);
router.post('/asientos', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), uploadAttachments, createAsiento);

// Requirements Routes
router.get('/submission-status', roleCheck(['USER', 'ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), checkSubmissionStatus);
router.get('/pending-count', roleCheck(['DIRECTOR', 'COORDINATOR']), getPendingApprovalCount);
router.put('/mass-update', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), updateMassRequirements);
router.post('/', roleCheck(['USER', 'ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), uploadAttachments, createRequirement);
router.post('/mass-create', roleCheck(['USER', 'ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), uploadAnyAttachments, createMassRequirements);

router.get('/me', getMyRequirements);
router.get('/dashboard-stats', getDashboardStats);
router.get('/all', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getAllRequirements);
router.get('/groups', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getRequirementGroups);
router.get('/:id', getRequirementById);
router.put('/:id', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER', 'USER', 'LEADER']), uploadAttachments, updateRequirement);
router.patch('/:id/status', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER', 'USER']), updateRequirementStatus); // LEADER removed
router.post('/group/:id/approve', roleCheck(['COORDINATOR', 'DIRECTOR', 'DEVELOPER']), approveRequirementGroup);
router.post('/group/:id/reject', roleCheck(['COORDINATOR', 'DIRECTOR', 'DEVELOPER']), rejectRequirementGroup);
router.patch('/:id/observations', updateObservations);
router.delete('/:id', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), deleteRequirement);

export default router;
