import { Router } from 'express';
import {
    // Areas
    getAreas,
    createArea,
    updateArea,
    deleteArea,
    // Projects
    getProjects,
    createProject,
    updateProject,
    deleteProject,
    // Categories
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    // Suppliers
    getSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    // Users moved to userController
    // Config
    getSystemConfig,
    updateSystemConfig,
    // Stats
    getAdminStats
} from '../controllers/adminController';
import {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    toggleUserStatus,
    deleteUser,
    generatePassword
} from '../controllers/userController';
import { authMiddleware, roleCheck } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
// Note: individual role checks are applied below instead of a global one

// Dashboard stats - accessible by managers
router.get('/stats', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getAdminStats);

// Areas CRUD - Admin and Director global
router.get('/areas', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getAreas);
router.post('/areas', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), createArea);
router.put('/areas/:id', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), updateArea);
router.delete('/areas/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), deleteArea);

// Projects CRUD
router.get('/projects', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getProjects);
router.post('/projects', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), createProject);
router.put('/projects/:id', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), updateProject);
router.delete('/projects/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), deleteProject);

// Categories CRUD
router.get('/categories', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getCategories);
router.post('/categories', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), createCategory);
router.put('/categories/:id', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), updateCategory);
router.delete('/categories/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), deleteCategory);

// Suppliers CRUD - LEADER can manage suppliers as requested
router.get('/suppliers', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getSuppliers);
router.post('/suppliers', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), createSupplier);
router.put('/suppliers/:id', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), updateSupplier);
router.delete('/suppliers/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), deleteSupplier);

// Users Management
router.get('/users', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), getUsers);
router.get('/users/generate-password', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), generatePassword);
router.post('/users', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), createUser);
router.get('/users/:id', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), getUserById);
router.put('/users/:id', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), updateUser);
router.patch('/users/toggle/:id', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), toggleUserStatus);
router.delete('/users/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), deleteUser);

// System Config
router.get('/config', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), getSystemConfig);
router.patch('/config', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), updateSystemConfig);

export default router;
