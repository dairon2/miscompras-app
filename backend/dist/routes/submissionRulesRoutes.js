"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middlewares/auth");
const submissionRulesService_1 = require("../services/submissionRulesService");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Roles que pueden gestionar las reglas
const ADMIN_ROLES = ['ADMIN', 'DIRECTOR', 'LEADER'];
/**
 * GET /api/submission-rules/can-submit
 * Verifica si el usuario actual puede enviar requerimientos
 */
router.get('/can-submit', auth_1.authMiddleware, async (req, res) => {
    try {
        const userRole = req.user?.role || 'USER';
        const result = await (0, submissionRulesService_1.checkSubmissionAllowed)(userRole);
        res.json(result);
    }
    catch (error) {
        console.error('Error checking submission:', error);
        res.status(500).json({ error: 'Error verificando permisos de envío' });
    }
});
/**
 * GET /api/submission-rules
 * Obtiene todas las reglas de envío
 */
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const rules = await (0, submissionRulesService_1.getAllRules)();
        res.json(rules);
    }
    catch (error) {
        console.error('Error fetching rules:', error);
        res.status(500).json({ error: 'Error obteniendo reglas' });
    }
});
/**
 * POST /api/submission-rules
 * Crea una nueva regla de envío
 */
router.post('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const userRole = req.user?.role?.toUpperCase();
        if (!ADMIN_ROLES.includes(userRole || '')) {
            return res.status(403).json({ error: 'No tienes permiso para crear reglas' });
        }
        const { name, dayOfWeek, startTime, endTime, isHolidayRule, holidayShift, priority } = req.body;
        if (!name || dayOfWeek === undefined || !startTime || !endTime) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        const rule = await prisma.submissionRule.create({
            data: {
                name,
                dayOfWeek: parseInt(dayOfWeek),
                startTime,
                endTime,
                isHolidayRule: isHolidayRule || false,
                holidayShift: holidayShift ? parseInt(holidayShift) : null,
                priority: priority ? parseInt(priority) : 0
            }
        });
        res.status(201).json(rule);
    }
    catch (error) {
        console.error('Error creating rule:', error);
        res.status(500).json({ error: 'Error creando regla' });
    }
});
/**
 * PUT /api/submission-rules/:id
 * Actualiza una regla de envío
 */
router.put('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const userRole = req.user?.role?.toUpperCase();
        if (!ADMIN_ROLES.includes(userRole || '')) {
            return res.status(403).json({ error: 'No tienes permiso para editar reglas' });
        }
        const { id } = req.params;
        const { name, dayOfWeek, startTime, endTime, isHolidayRule, holidayShift, isActive, priority } = req.body;
        const rule = await prisma.submissionRule.update({
            where: { id },
            data: {
                name,
                dayOfWeek: dayOfWeek !== undefined ? parseInt(dayOfWeek) : undefined,
                startTime,
                endTime,
                isHolidayRule,
                holidayShift: holidayShift !== undefined ? parseInt(holidayShift) : undefined,
                isActive,
                priority: priority !== undefined ? parseInt(priority) : undefined
            }
        });
        res.json(rule);
    }
    catch (error) {
        console.error('Error updating rule:', error);
        res.status(500).json({ error: 'Error actualizando regla' });
    }
});
/**
 * DELETE /api/submission-rules/:id
 * Elimina una regla de envío
 */
router.delete('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const userRole = req.user?.role?.toUpperCase();
        if (!ADMIN_ROLES.includes(userRole || '')) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar reglas' });
        }
        const { id } = req.params;
        await prisma.submissionRule.delete({ where: { id } });
        res.json({ message: 'Regla eliminada exitosamente' });
    }
    catch (error) {
        console.error('Error deleting rule:', error);
        res.status(500).json({ error: 'Error eliminando regla' });
    }
});
/**
 * GET /api/submission-rules/holidays/:year
 * Obtiene los festivos de un año específico
 */
router.get('/holidays/:year', auth_1.authMiddleware, async (req, res) => {
    try {
        const year = parseInt(req.params.year);
        const holidays = await (0, submissionRulesService_1.getHolidaysByYear)(year);
        res.json(holidays);
    }
    catch (error) {
        console.error('Error fetching holidays:', error);
        res.status(500).json({ error: 'Error obteniendo festivos' });
    }
});
/**
 * POST /api/submission-rules/holidays/sync/:year
 * Sincroniza los festivos desde la API externa
 */
router.post('/holidays/sync/:year', auth_1.authMiddleware, async (req, res) => {
    try {
        const userRole = req.user?.role?.toUpperCase();
        if (!ADMIN_ROLES.includes(userRole || '')) {
            return res.status(403).json({ error: 'No tienes permiso para sincronizar festivos' });
        }
        const year = parseInt(req.params.year);
        const count = await (0, submissionRulesService_1.syncHolidaysForYear)(year);
        res.json({
            message: `Se sincronizaron ${count} festivos para el año ${year}`,
            count
        });
    }
    catch (error) {
        console.error('Error syncing holidays:', error);
        res.status(500).json({ error: 'Error sincronizando festivos' });
    }
});
/**
 * POST /api/submission-rules/seed
 * Crea las reglas por defecto (solo si no existen)
 */
router.post('/seed', auth_1.authMiddleware, async (req, res) => {
    try {
        const userRole = req.user?.role?.toUpperCase();
        if (!ADMIN_ROLES.includes(userRole || '')) {
            return res.status(403).json({ error: 'No tienes permiso para esta acción' });
        }
        await (0, submissionRulesService_1.seedDefaultRules)();
        res.json({ message: 'Reglas por defecto creadas exitosamente' });
    }
    catch (error) {
        console.error('Error seeding rules:', error);
        res.status(500).json({ error: 'Error creando reglas por defecto' });
    }
});
exports.default = router;
