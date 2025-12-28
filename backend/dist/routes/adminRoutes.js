"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// All routes require authentication and ADMIN role
router.use(auth_1.authMiddleware);
router.use((0, auth_1.roleCheck)(['ADMIN']));
// Dashboard stats
router.get('/stats', adminController_1.getAdminStats);
// Areas CRUD
router.get('/areas', adminController_1.getAreas);
router.post('/areas', adminController_1.createArea);
router.put('/areas/:id', adminController_1.updateArea);
router.delete('/areas/:id', adminController_1.deleteArea);
// Projects CRUD
router.get('/projects', adminController_1.getProjects);
router.post('/projects', adminController_1.createProject);
router.put('/projects/:id', adminController_1.updateProject);
router.delete('/projects/:id', adminController_1.deleteProject);
// Categories CRUD
router.get('/categories', adminController_1.getCategories);
router.post('/categories', adminController_1.createCategory);
router.put('/categories/:id', adminController_1.updateCategory);
router.delete('/categories/:id', adminController_1.deleteCategory);
// Suppliers CRUD
router.get('/suppliers', adminController_1.getSuppliers);
router.post('/suppliers', adminController_1.createSupplier);
router.put('/suppliers/:id', adminController_1.updateSupplier);
router.delete('/suppliers/:id', adminController_1.deleteSupplier);
exports.default = router;
