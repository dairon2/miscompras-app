import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import {
    checkSubmissionAllowed,
    getAllRules,
    getHolidaysByYear,
    syncHolidaysForYear,
    seedDefaultRules
} from '../services/submissionRulesService';

const router = Router();
const prisma = new PrismaClient();

// Roles que pueden gestionar las reglas
const ADMIN_ROLES = ['ADMIN', 'DIRECTOR', 'LEADER'];

/**
 * GET /api/submission-rules/can-submit
 * Verifica si el usuario actual puede enviar requerimientos
 */
router.get('/can-submit', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userRole = req.user?.role || 'USER';
        console.log('[can-submit] Checking for role:', userRole);
        const result = await checkSubmissionAllowed(userRole);
        console.log('[can-submit] Result:', JSON.stringify(result, null, 2));
        res.json(result);
    } catch (error: any) {
        console.error('Error checking submission:', error);
        res.status(500).json({ error: 'Error verificando permisos de envío' });
    }
});

/**
 * GET /api/submission-rules
 * Obtiene todas las reglas de envío
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const rules = await getAllRules();
        res.json(rules);
    } catch (error: any) {
        console.error('Error fetching rules:', error);
        res.status(500).json({ error: 'Error obteniendo reglas' });
    }
});

/**
 * POST /api/submission-rules
 * Crea una nueva regla de envío
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userRole = req.user?.role?.toUpperCase();
        if (!ADMIN_ROLES.includes(userRole || '')) {
            return res.status(403).json({ error: 'No tienes permiso para crear reglas' });
        }

        const { name, dayOfWeek, startTime, endTime, isHolidayRule, holidayShift, priority } = req.body;
        const parsedIsHolidayRule = Boolean(isHolidayRule);

        if (!name || dayOfWeek === undefined || !startTime || !endTime) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        const rule = await prisma.submissionRule.create({
            data: {
                name,
                dayOfWeek: parseInt(dayOfWeek),
                startTime,
                endTime,
                isHolidayRule: parsedIsHolidayRule,
                holidayShift: parsedIsHolidayRule ? parseInt(holidayShift ?? '1') : null,
                priority: priority ? parseInt(priority) : 0
            }
        });

        res.status(201).json(rule);
    } catch (error: any) {
        console.error('Error creating rule:', error);
        res.status(500).json({ error: 'Error creando regla' });
    }
});

/**
 * PUT /api/submission-rules/:id
 * Actualiza una regla de envío
 */
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userRole = req.user?.role?.toUpperCase();
        if (!ADMIN_ROLES.includes(userRole || '')) {
            return res.status(403).json({ error: 'No tienes permiso para editar reglas' });
        }

        const { id } = req.params;
        const { name, dayOfWeek, startTime, endTime, isHolidayRule, holidayShift, isActive, priority } = req.body;
        const parsedIsHolidayRule = isHolidayRule !== undefined ? Boolean(isHolidayRule) : undefined;

        const rule = await prisma.submissionRule.update({
            where: { id },
            data: {
                name,
                dayOfWeek: dayOfWeek !== undefined ? parseInt(dayOfWeek) : undefined,
                startTime,
                endTime,
                isHolidayRule: parsedIsHolidayRule,
                holidayShift: parsedIsHolidayRule === false ? null : (holidayShift !== undefined ? parseInt(holidayShift) : undefined),
                isActive,
                priority: priority !== undefined ? parseInt(priority) : undefined
            }
        });

        res.json(rule);
    } catch (error: any) {
        console.error('Error updating rule:', error);
        res.status(500).json({ error: 'Error actualizando regla' });
    }
});

/**
 * DELETE /api/submission-rules/:id
 * Elimina una regla de envío
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userRole = req.user?.role?.toUpperCase();
        if (!ADMIN_ROLES.includes(userRole || '')) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar reglas' });
        }

        const { id } = req.params;
        await prisma.submissionRule.delete({ where: { id } });

        res.json({ message: 'Regla eliminada exitosamente' });
    } catch (error: any) {
        console.error('Error deleting rule:', error);
        res.status(500).json({ error: 'Error eliminando regla' });
    }
});

/**
 * GET /api/submission-rules/holidays/:year
 * Obtiene los festivos de un año específico
 */
router.get('/holidays/:year', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const year = parseInt(req.params.year);
        const holidays = await getHolidaysByYear(year);
        res.json(holidays);
    } catch (error: any) {
        console.error('Error fetching holidays:', error);
        res.status(500).json({ error: 'Error obteniendo festivos' });
    }
});

/**
 * POST /api/submission-rules/holidays/sync/:year
 * Sincroniza los festivos desde la API externa
 */
router.post('/holidays/sync/:year', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userRole = req.user?.role?.toUpperCase();
        if (!ADMIN_ROLES.includes(userRole || '')) {
            return res.status(403).json({ error: 'No tienes permiso para sincronizar festivos' });
        }

        const year = parseInt(req.params.year);
        const count = await syncHolidaysForYear(year);

        res.json({
            message: `Se sincronizaron ${count} festivos para el año ${year}`,
            count
        });
    } catch (error: any) {
        console.error('Error syncing holidays:', error);
        res.status(500).json({ error: 'Error sincronizando festivos' });
    }
});

/**
 * POST /api/submission-rules/seed
 * Crea las reglas por defecto (solo si no existen)
 */
router.post('/seed', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userRole = req.user?.role?.toUpperCase();
        if (!ADMIN_ROLES.includes(userRole || '')) {
            return res.status(403).json({ error: 'No tienes permiso para esta acción' });
        }

        await seedDefaultRules();
        res.json({ message: 'Reglas por defecto creadas exitosamente' });
    } catch (error: any) {
        console.error('Error seeding rules:', error);
        res.status(500).json({ error: 'Error creando reglas por defecto' });
    }
});

export default router;
