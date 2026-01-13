"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHolidaysByYear = exports.getAllRules = exports.seedDefaultRules = exports.checkSubmissionAllowed = exports.isHoliday = exports.syncHolidaysForYear = exports.fetchColombianHolidays = void 0;
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const prisma = new client_1.PrismaClient();
// Roles que pueden enviar sin restricciones
const UNRESTRICTED_ROLES = ['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER', 'COORDINATOR'];
/**
 * Obtiene los festivos colombianos desde la API de Nager.Date
 */
const fetchColombianHolidays = async (year) => {
    // Manual override for 2026 to ensure correctness as per user request
    if (year === 2026) {
        return [
            { date: '2026-01-01', name: 'Año Nuevo' },
            { date: '2026-01-12', name: 'Día de los Reyes Magos' },
            { date: '2026-03-23', name: 'Día de San José' },
            { date: '2026-04-02', name: 'Jueves Santo' },
            { date: '2026-04-03', name: 'Viernes Santo' },
            { date: '2026-05-01', name: 'Día del Trabajo' },
            { date: '2026-05-18', name: 'Día de la Ascensión' },
            { date: '2026-06-08', name: 'Corpus Christi' },
            { date: '2026-06-15', name: 'Sagrado Corazón' },
            { date: '2026-06-29', name: 'San Pedro y San Pablo' },
            { date: '2026-07-20', name: 'Día de la Independencia' },
            { date: '2026-08-07', name: 'Batalla de Boyacá' },
            { date: '2026-08-17', name: 'La Asunción de la Virgen' },
            { date: '2026-10-12', name: 'Día de la Raza' },
            { date: '2026-11-02', name: 'Todos los Santos' },
            { date: '2026-11-16', name: 'Independencia de Cartagena' },
            { date: '2026-12-08', name: 'Inmaculada Concepción' },
            { date: '2026-12-25', name: 'Navidad' }
        ];
    }
    try {
        const response = await axios_1.default.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/CO`);
        return response.data.map((h) => ({
            date: h.date,
            name: h.localName || h.name
        }));
    }
    catch (error) {
        console.error('Error fetching Colombian holidays:', error);
        return [];
    }
};
exports.fetchColombianHolidays = fetchColombianHolidays;
/**
 * Sincroniza los festivos de un año desde la API externa
 */
const syncHolidaysForYear = async (year) => {
    const holidays = await (0, exports.fetchColombianHolidays)(year);
    let count = 0;
    for (const holiday of holidays) {
        try {
            await prisma.colombianHoliday.upsert({
                where: { date: new Date(holiday.date) },
                update: { name: holiday.name, year },
                create: {
                    date: new Date(holiday.date),
                    name: holiday.name,
                    year
                }
            });
            count++;
        }
        catch (e) {
            console.error(`Error syncing holiday ${holiday.name}:`, e);
        }
    }
    return count;
};
exports.syncHolidaysForYear = syncHolidaysForYear;
/**
 * Verifica si una fecha específica es festivo en Colombia
 */
const isHoliday = async (date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    const holiday = await prisma.colombianHoliday.findFirst({
        where: {
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        }
    });
    return !!holiday;
};
exports.isHoliday = isHoliday;
/**
 * Obtiene el día anterior (ignorando fines de semana)
 */
const getPreviousWorkday = (date) => {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    // Si es domingo, retroceder a viernes
    if (prev.getDay() === 0) {
        prev.setDate(prev.getDate() - 2);
    }
    // Si es sábado, retroceder a viernes
    else if (prev.getDay() === 6) {
        prev.setDate(prev.getDate() - 1);
    }
    return prev;
};
/**
 * Convierte hora string "HH:MM" a minutos desde medianoche
 */
const timeToMinutes = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};
/**
 * Nombres de días en español
 */
const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/**
 * Verifica si un usuario puede enviar requerimientos en este momento
 */
const checkSubmissionAllowed = async (userRole) => {
    // Los roles privilegiados siempre pueden enviar
    if (UNRESTRICTED_ROLES.includes(userRole?.toUpperCase())) {
        return {
            canSubmit: true,
            message: 'Puedes enviar requerimientos en cualquier momento.'
        };
    }
    const now = new Date();
    // Ajustar a la zona horaria de Colombia (UTC-5)
    const colombiaOffset = -5 * 60; // minutos
    const localOffset = now.getTimezoneOffset();
    const colombiaTime = new Date(now.getTime() + (localOffset - colombiaOffset) * 60000);
    const currentDay = colombiaTime.getDay();
    const currentHour = colombiaTime.getHours();
    const currentMinute = colombiaTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    // Verificar si el día anterior fue festivo
    const previousDay = getPreviousWorkday(colombiaTime);
    const wasPreviousDayHoliday = await (0, exports.isHoliday)(previousDay);
    // Obtener las reglas activas
    const rules = await prisma.submissionRule.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' }
    });
    if (rules.length === 0) {
        // Si no hay reglas configuradas, permitir siempre
        return {
            canSubmit: true,
            message: 'No hay restricciones de horario configuradas.'
        };
    }
    // Buscar una regla que aplique
    for (const rule of rules) {
        // Verificar si es una regla de festivo y si aplica
        if (rule.isHolidayRule) {
            // Esta regla solo aplica si el día anterior fue festivo
            if (!wasPreviousDayHoliday)
                continue;
        }
        else {
            // Las reglas normales no aplican si el día anterior fue festivo
            // y hay reglas de festivo para este día
            if (wasPreviousDayHoliday) {
                const hasHolidayRuleForToday = rules.some(r => r.isHolidayRule && r.dayOfWeek === currentDay);
                if (hasHolidayRuleForToday)
                    continue;
            }
        }
        // Verificar si aplica al día actual
        if (rule.dayOfWeek !== currentDay)
            continue;
        // Verificar horario
        const startMinutes = timeToMinutes(rule.startTime);
        const endMinutes = timeToMinutes(rule.endTime);
        if (currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes) {
            return {
                canSubmit: true,
                message: `Puedes enviar requerimientos hasta las ${rule.endTime}.`
            };
        }
    }
    // No se encontró ninguna regla que permita enviar
    // Buscar el próximo horario disponible
    const nextAvailable = await findNextAvailableSlot(colombiaTime, rules);
    return {
        canSubmit: false,
        message: 'No puedes enviar requerimientos en este momento.',
        nextAvailable
    };
};
exports.checkSubmissionAllowed = checkSubmissionAllowed;
/**
 * Encuentra el próximo horario disponible para enviar
 */
const findNextAvailableSlot = async (fromDate, rules) => {
    const checkDate = new Date(fromDate);
    // Buscar en los próximos 7 días
    for (let i = 0; i < 7; i++) {
        if (i > 0) {
            checkDate.setDate(checkDate.getDate() + 1);
        }
        const dayOfWeek = checkDate.getDay();
        const previousDay = getPreviousWorkday(checkDate);
        const wasPreviousDayHoliday = await (0, exports.isHoliday)(previousDay);
        for (const rule of rules) {
            if (rule.dayOfWeek !== dayOfWeek)
                continue;
            // Verificar si la regla aplica según condiciones de festivo
            if (rule.isHolidayRule && !wasPreviousDayHoliday)
                continue;
            if (!rule.isHolidayRule && wasPreviousDayHoliday) {
                const hasHolidayRuleForDay = rules.some(r => r.isHolidayRule && r.dayOfWeek === dayOfWeek);
                if (hasHolidayRuleForDay)
                    continue;
            }
            // Si es hoy, verificar que no haya pasado el horario
            if (i === 0) {
                const currentMinutes = fromDate.getHours() * 60 + fromDate.getMinutes();
                const endMinutes = timeToMinutes(rule.endTime);
                if (currentMinutes > endMinutes)
                    continue;
            }
            return {
                day: dayNames[dayOfWeek],
                date: checkDate.toLocaleDateString('es-CO'),
                startTime: rule.startTime,
                endTime: rule.endTime
            };
        }
    }
    return undefined;
};
/**
 * Crea las reglas por defecto si no existen
 */
const seedDefaultRules = async () => {
    const existingRules = await prisma.submissionRule.count();
    if (existingRules > 0) {
        console.log('Submission rules already exist, skipping seed.');
        return;
    }
    const defaultRules = [
        // Reglas normales
        {
            name: 'Lunes regular',
            dayOfWeek: 1, // Lunes
            startTime: '08:00',
            endTime: '16:00',
            isHolidayRule: false,
            priority: 1
        },
        {
            name: 'Martes regular',
            dayOfWeek: 2, // Martes
            startTime: '08:00',
            endTime: '12:00',
            isHolidayRule: false,
            priority: 1
        },
        // Reglas cuando lunes es festivo
        {
            name: 'Martes (cuando lunes es festivo)',
            dayOfWeek: 2, // Martes
            startTime: '08:00',
            endTime: '16:00',
            isHolidayRule: true,
            holidayShift: 1,
            priority: 2
        },
        {
            name: 'Miércoles (cuando lunes es festivo)',
            dayOfWeek: 3, // Miércoles
            startTime: '08:00',
            endTime: '12:00',
            isHolidayRule: true,
            holidayShift: 1,
            priority: 2
        }
    ];
    for (const rule of defaultRules) {
        await prisma.submissionRule.create({ data: rule });
    }
    console.log('Default submission rules created.');
};
exports.seedDefaultRules = seedDefaultRules;
/**
 * Obtiene todas las reglas de envío
 */
const getAllRules = async () => {
    return prisma.submissionRule.findMany({
        orderBy: [{ dayOfWeek: 'asc' }, { priority: 'desc' }]
    });
};
exports.getAllRules = getAllRules;
/**
 * Obtiene todos los festivos de un año
 */
const getHolidaysByYear = async (year) => {
    return prisma.colombianHoliday.findMany({
        where: { year },
        orderBy: { date: 'asc' }
    });
};
exports.getHolidaysByYear = getHolidaysByYear;
