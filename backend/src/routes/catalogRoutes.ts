import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, roleCheck, AuthRequest } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

// Helper for Mock check
const isDemoMode = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

// Projects
router.get('/projects', async (req: Request, res: Response) => {
    if (isDemoMode) {
        return res.json([
            { id: 'proj-1', name: 'Exposición Botero', code: 'BOT-2024' },
            { id: 'proj-2', name: 'Modernización IT', code: 'IT-2024' },
            { id: 'proj-3', name: 'Conservación Textil', code: 'CONS-2024' }
        ]);
    }
    try {
        const projects = await prisma.project.findMany();
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Areas
router.get('/areas', async (req: Request, res: Response) => {
    if (isDemoMode) {
        return res.json([
            { id: 'area-1', name: 'Curaduría' },
            { id: 'area-2', name: 'Tecnología' },
            { id: 'area-3', name: 'Administración' }
        ]);
    }
    try {
        const areas = await prisma.area.findMany();
        res.json(areas);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch areas' });
    }
});

// Suppliers route removed to avoid conflict with index.ts demo implementation

// Budgets routes removed to avoid conflict with index.ts demo implementation

export default router;
