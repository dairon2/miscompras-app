"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adjustmentController_1 = require("../controllers/adjustmentController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authMiddleware);
// Create adjustment request (any authenticated user)
router.post('/', adjustmentController_1.createAdjustment);
// Get my adjustment requests
router.get('/my', adjustmentController_1.getMyAdjustments);
// Get pending adjustments - DIRECTOR only
router.get('/pending', (0, auth_1.roleCheck)(['DIRECTOR']), adjustmentController_1.getPendingAdjustments);
// Get all adjustments (for history/filtering)
router.get('/', adjustmentController_1.getAllAdjustments);
// Get adjustment by ID
router.get('/:id', adjustmentController_1.getAdjustmentById);
// Approve adjustment - DIRECTOR only
router.patch('/:id/approve', (0, auth_1.roleCheck)(['DIRECTOR']), adjustmentController_1.approveAdjustment);
// Reject adjustment - DIRECTOR only
router.patch('/:id/reject', (0, auth_1.roleCheck)(['DIRECTOR']), adjustmentController_1.rejectAdjustment);
exports.default = router;
