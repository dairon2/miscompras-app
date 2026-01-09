"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const requirementController_1 = require("../controllers/requirementController");
const auth_1 = require("../middlewares/auth");
const multer_1 = __importDefault(require("multer"));
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = (0, multer_1.default)({ storage });
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// Asientos Routes (must be before /:id to avoid conflicts)
// Asientos Routes (must be before /:id to avoid conflicts)
router.get('/years', requirementController_1.getAvailableYears);
router.get('/asientos', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), requirementController_1.getAsientos);
router.post('/asientos', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), upload.array('attachments'), requirementController_1.createAsiento);
// Requirements Routes
router.get('/pending-count', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), requirementController_1.getPendingApprovalCount);
router.put('/mass-update', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), requirementController_1.updateMassRequirements);
router.post('/', (0, auth_1.roleCheck)(['USER', 'ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), upload.array('attachments'), requirementController_1.createRequirement);
router.post('/mass-create', (0, auth_1.roleCheck)(['USER', 'ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), upload.any(), requirementController_1.createMassRequirements);
router.get('/me', requirementController_1.getMyRequirements);
router.get('/dashboard-stats', requirementController_1.getDashboardStats);
router.get('/all', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), requirementController_1.getAllRequirements);
router.get('/groups', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), requirementController_1.getRequirementGroups);
router.get('/:id', requirementController_1.getRequirementById);
router.put('/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), upload.array('attachments'), requirementController_1.updateRequirement);
router.patch('/:id/status', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER', 'USER']), requirementController_1.updateRequirementStatus); // LEADER removed
router.post('/group/:id/approve', (0, auth_1.roleCheck)(['COORDINATOR', 'DIRECTOR', 'DEVELOPER']), requirementController_1.approveRequirementGroup);
router.post('/group/:id/reject', (0, auth_1.roleCheck)(['COORDINATOR', 'DIRECTOR', 'DEVELOPER']), requirementController_1.rejectRequirementGroup);
router.patch('/:id/observations', requirementController_1.updateObservations);
router.delete('/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), requirementController_1.deleteRequirement);
exports.default = router;
