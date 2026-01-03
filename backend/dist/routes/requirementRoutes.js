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
router.get('/years', requirementController_1.getAvailableYears);
router.get('/asientos', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), requirementController_1.getAsientos);
router.post('/asientos', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), upload.array('attachments'), requirementController_1.createAsiento);
// Requirements Routes
router.post('/', upload.array('attachments'), requirementController_1.createRequirement);
router.post('/mass-create', requirementController_1.createMassRequirements);
router.get('/me', requirementController_1.getMyRequirements);
router.get('/all', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), requirementController_1.getAllRequirements);
router.get('/groups', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), requirementController_1.getRequirementGroups);
router.get('/:id', requirementController_1.getRequirementById);
router.put('/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), upload.array('attachments'), requirementController_1.updateRequirement);
router.patch('/:id/status', (0, auth_1.roleCheck)(['LEADER', 'DIRECTOR', 'ADMIN', 'COORDINATOR', 'DEVELOPER']), requirementController_1.updateRequirementStatus);
router.post('/group/:id/approve', (0, auth_1.roleCheck)(['LEADER', 'COORDINATOR', 'DIRECTOR', 'ADMIN', 'DEVELOPER']), requirementController_1.approveRequirementGroup);
router.post('/group/:id/reject', (0, auth_1.roleCheck)(['LEADER', 'COORDINATOR', 'DIRECTOR', 'ADMIN', 'DEVELOPER']), requirementController_1.rejectRequirementGroup);
router.patch('/:id/observations', requirementController_1.updateObservations);
router.delete('/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'DEVELOPER']), requirementController_1.deleteRequirement);
exports.default = router;
