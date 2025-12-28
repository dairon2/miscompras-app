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
    // Stats
    getAdminStats
} from '../controllers/adminController';
import { authMiddleware, roleCheck } from '../middlewares/auth';

const router = Router();

// All routes require authentication and ADMIN role
router.use(authMiddleware);
router.use(roleCheck(['ADMIN']));

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

export default router;
