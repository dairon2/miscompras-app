"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const reportController_1 = require("../controllers/reportController");
const router = (0, express_1.Router)();
// Todas las rutas de reportes requieren autenticación
router.get('/requirements', auth_1.authMiddleware, reportController_1.exportRequirements);
router.get('/budgets', auth_1.authMiddleware, reportController_1.exportBudgets);
router.get('/suppliers', auth_1.authMiddleware, reportController_1.exportSuppliers);
exports.default = router;
