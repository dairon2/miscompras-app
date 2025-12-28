"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentController_1 = require("../controllers/paymentController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// Payment routes
router.post('/:requirementId', paymentController_1.createPayment);
router.get('/:requirementId', paymentController_1.getPaymentsByRequirement);
router.put('/update/:paymentId', paymentController_1.updatePayment);
router.delete('/delete/:paymentId', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER']), paymentController_1.deletePayment);
router.patch('/:requirementId/toggle-multiple', paymentController_1.toggleMultiplePayments);
exports.default = router;
