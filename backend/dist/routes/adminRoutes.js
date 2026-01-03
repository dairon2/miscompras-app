"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authMiddleware);
// Note: individual role checks are applied below instead of a global one
// Dashboard stats - accessible by managers
router.get('/stats', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), adminController_1.getAdminStats);
// Areas CRUD - Admin and Director global
router.get('/areas', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), adminController_1.getAreas);
router.post('/areas', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), adminController_1.createArea);
router.put('/areas/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), adminController_1.updateArea);
router.delete('/areas/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'DEVELOPER']), adminController_1.deleteArea);
// Projects CRUD
router.get('/projects', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), adminController_1.getProjects);
router.post('/projects', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), adminController_1.createProject);
router.put('/projects/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), adminController_1.updateProject);
router.delete('/projects/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'DEVELOPER']), adminController_1.deleteProject);
// Categories CRUD
router.get('/categories', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), adminController_1.getCategories);
router.post('/categories', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), adminController_1.createCategory);
router.put('/categories/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), adminController_1.updateCategory);
router.delete('/categories/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'DEVELOPER']), adminController_1.deleteCategory);
// Suppliers CRUD - LEADER can manage suppliers as requested
router.get('/suppliers', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), adminController_1.getSuppliers);
router.post('/suppliers', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), adminController_1.createSupplier);
router.put('/suppliers/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), adminController_1.updateSupplier);
router.delete('/suppliers/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'DEVELOPER']), adminController_1.deleteSupplier);
// Users Management
router.get('/users', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), userController_1.getUsers);
router.get('/users/generate-password', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), userController_1.generatePassword);
router.post('/users', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), userController_1.createUser);
router.get('/users/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), userController_1.getUserById);
router.put('/users/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), userController_1.updateUser);
router.patch('/users/toggle/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), userController_1.toggleUserStatus);
router.delete('/users/:id', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'DEVELOPER']), userController_1.deleteUser);
// System Config
router.get('/config', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), adminController_1.getSystemConfig);
router.patch('/config', (0, auth_1.roleCheck)(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), adminController_1.updateSystemConfig);
exports.default = router;
