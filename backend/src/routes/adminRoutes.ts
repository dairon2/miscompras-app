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
    // Users
    getUsers,
    updateUser,
    toggleUserStatus,
    deleteUser,
    // Config
    getSystemConfig,
    updateSystemConfig,
    // Stats
    getAdminStats
} from '../controllers/adminController';
import { authMiddleware, roleCheck } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
// Note: individual role checks are applied below instead of a global one

// Dashboard stats - accessible by managers
router.get('/stats', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getAdminStats);

// Areas CRUD - Admin and Director global
router.get('/areas', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER', 'AUDITOR']), getAreas);
router.post('/areas', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), createArea);
router.put('/areas/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), updateArea);
router.delete('/areas/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), deleteArea);

// Projects CRUD
router.get('/projects', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getProjects);
router.post('/projects', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), createProject);
router.put('/projects/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), updateProject);
router.delete('/projects/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), deleteProject);

// Categories CRUD
router.get('/categories', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getCategories);
router.post('/categories', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), createCategory);
router.put('/categories/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), updateCategory);
router.delete('/categories/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), deleteCategory);

// Suppliers CRUD - LEADER can manage suppliers as requested
router.get('/suppliers', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getSuppliers);
router.post('/suppliers', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER']), createSupplier);
router.put('/suppliers/:id', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER']), updateSupplier);
router.delete('/suppliers/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), deleteSupplier);

// Users Management - Admin/Director only
router.get('/users', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), getUsers);
router.put('/users/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), updateUser);
router.patch('/users/toggle/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), toggleUserStatus);
router.delete('/users/:id', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), deleteUser);

// System Config - Admin/Director only
router.get('/config', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), getSystemConfig);
router.patch('/config', roleCheck(['ADMIN', 'DIRECTOR', 'DEVELOPER']), updateSystemConfig);

export default router;
