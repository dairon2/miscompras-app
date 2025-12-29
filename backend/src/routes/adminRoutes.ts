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

// All routes require authentication and ADMIN or DIRECTOR role
router.use(authMiddleware);
router.use(roleCheck(['ADMIN', 'DIRECTOR']));

// Dashboard stats
router.get('/stats', getAdminStats);

// Areas CRUD
router.get('/areas', getAreas);
router.post('/areas', createArea);
router.put('/areas/:id', updateArea);
router.delete('/areas/:id', deleteArea);

// Projects CRUD
router.get('/projects', getProjects);
router.post('/projects', createProject);
router.put('/projects/:id', updateProject);
router.delete('/projects/:id', deleteProject);

// Categories CRUD
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Suppliers CRUD
router.get('/suppliers', getSuppliers);
router.post('/suppliers', createSupplier);
router.put('/suppliers/:id', updateSupplier);
router.delete('/suppliers/:id', deleteSupplier);

// Users Management
router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.patch('/users/toggle/:id', toggleUserStatus);
router.delete('/users/:id', deleteUser);

// System Config
router.get('/config', getSystemConfig);
router.patch('/config', updateSystemConfig);

export default router;
