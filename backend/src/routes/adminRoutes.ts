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
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    bulkImportSuppliers,
    // Users moved to userController
    // Config
    getSystemConfig,
    updateSystemConfig,
    getSystemHealth,
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
router.post('/areas', roleCheck(['DIRECTOR', 'DEVELOPER']), createArea);
router.put('/areas/:id', roleCheck(['DIRECTOR', 'DEVELOPER']), updateArea);
router.delete('/areas/:id', roleCheck(['DIRECTOR', 'DEVELOPER']), deleteArea);

// Projects CRUD
router.get('/projects', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getProjects);
router.post('/projects', roleCheck(['DIRECTOR', 'DEVELOPER']), createProject);
router.put('/projects/:id', roleCheck(['DIRECTOR', 'DEVELOPER']), updateProject);
router.delete('/projects/:id', roleCheck(['DIRECTOR', 'DEVELOPER']), deleteProject);

// Categories CRUD
router.get('/categories', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getCategories);
router.post('/categories', roleCheck(['DIRECTOR', 'DEVELOPER']), createCategory);
router.put('/categories/:id', roleCheck(['DIRECTOR', 'DEVELOPER']), updateCategory);
router.delete('/categories/:id', roleCheck(['DIRECTOR', 'DEVELOPER']), deleteCategory);

// Suppliers CRUD - LEADER can manage suppliers as requested
router.get('/suppliers', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR']), getSuppliers);
router.get('/suppliers/:id', authMiddleware, getSupplierById); // Open to all authenticated users
router.post('/suppliers', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), createSupplier);
router.put('/suppliers/:id', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), updateSupplier);
router.delete('/suppliers/:id', roleCheck(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']), deleteSupplier);
router.post('/suppliers/bulk-import', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), bulkImportSuppliers);

// Users Management
router.get('/users', roleCheck(['DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), getUsers); // Leader sees list? Maybe needed
router.get('/users/generate-password', roleCheck(['DIRECTOR', 'COORDINATOR', 'DEVELOPER']), generatePassword);
router.post('/users', roleCheck(['DIRECTOR', 'COORDINATOR', 'DEVELOPER']), createUser);
router.get('/users/:id', roleCheck(['DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), getUserById);
router.put('/users/:id', roleCheck(['DIRECTOR', 'COORDINATOR', 'DEVELOPER']), updateUser);
router.patch('/users/toggle/:id', roleCheck(['DIRECTOR', 'COORDINATOR', 'DEVELOPER']), toggleUserStatus);
router.delete('/users/:id', roleCheck(['DIRECTOR', 'DEVELOPER']), deleteUser);

// System Config
router.get('/config', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), getSystemConfig);
router.patch('/config', roleCheck(['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER']), updateSystemConfig);
router.get('/health', roleCheck(['DEVELOPER']), getSystemHealth);

export default router;
