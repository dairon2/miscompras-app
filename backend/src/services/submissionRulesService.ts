import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// Roles que pueden enviar sin restricciones
const UNRESTRICTED_ROLES = ['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER', 'COORDINATOR'];

interface SubmissionCheckResult {
    canSubmit: boolean;
    message: string;
    isUnrestricted?: boolean;
    nextAvailable?: {
        day: string;
        date: string;
        startTime: string;
        endTime: string;
    };
    allRules?: any[];
    currentRule?: any;
}

/**
 * Obtiene los festivos colombianos desde la API de Nager.Date
 */
export const fetchColombianHolidays = async (year: number): Promise<{ date: string; name: string }[]> => {
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
        const response = await axios.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/CO`);
        return response.data.map((h: any) => ({
            date: h.date,
            name: h.localName || h.name
        }));
    } catch (error) {
        console.error('Error fetching Colombian holidays:', error);
        return [];
    }
};

/**
 * Sincroniza los festivos de un año desde la API externa
 */
export const syncHolidaysForYear = async (year: number): Promise<number> => {
    const holidays = await fetchColombianHolidays(year);
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
        } catch (e) {
            console.error(`Error syncing holiday ${holiday.name}:`, e);
        }
    }

    return count;
};

/**
 * Verifica si una fecha específica es festivo en Colombia
 */
export const isHoliday = async (date: Date): Promise<boolean> => {
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

/**
 * Obtiene el día anterior (ignorando fines de semana)
 */
const getPreviousWorkday = (date: Date): Date => {
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
const timeToMinutes = (time: string): number => {
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
export const checkSubmissionAllowed = async (userRole: string): Promise<SubmissionCheckResult> => {
    // Los roles privilegiados siempre pueden enviar
    if (UNRESTRICTED_ROLES.includes(userRole?.toUpperCase())) {
        return {
            canSubmit: true,
            isUnrestricted: true,
            message: 'Puedes enviar requerimientos en cualquier momento (sin restricciones para tu rol).'
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
    const wasPreviousDayHoliday = await isHoliday(previousDay);

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
            if (!wasPreviousDayHoliday) continue;
        } else {
            // Las reglas normales no aplican si el día anterior fue festivo
            // y hay reglas de festivo para este día
            if (wasPreviousDayHoliday) {
                const hasHolidayRuleForToday = rules.some(r =>
                    r.isHolidayRule && r.dayOfWeek === currentDay
                );
                if (hasHolidayRuleForToday) continue;
            }
        }

        // Verificar si aplica al día actual
        if (rule.dayOfWeek !== currentDay) continue;

        // Verificar horario
        const startMinutes = timeToMinutes(rule.startTime);
        const endMinutes = timeToMinutes(rule.endTime);

        if (currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes) {
            return {
                canSubmit: true,
                message: `Puedes enviar requerimientos hasta las ${rule.endTime}.`,
                allRules: rules,
                currentRule: rule
            };
        }
    }

    // No se encontró ninguna regla que permita enviar
    // Buscar el próximo horario disponible
    const nextAvailable = await findNextAvailableSlot(colombiaTime, rules);

    return {
        canSubmit: false,
        message: 'No puedes enviar requerimientos en este momento.',
        nextAvailable,
        allRules: rules
    };
};

/**
 * Encuentra el próximo horario disponible para enviar
 */
const findNextAvailableSlot = async (fromDate: Date, rules: any[]): Promise<{
    day: string;
    date: string;
    startTime: string;
    endTime: string;
} | undefined> => {
    const checkDate = new Date(fromDate);

    // Buscar en los próximos 7 días
    for (let i = 0; i < 7; i++) {
        if (i > 0) {
            checkDate.setDate(checkDate.getDate() + 1);
        }

        const dayOfWeek = checkDate.getDay();
        const previousDay = getPreviousWorkday(checkDate);
        const wasPreviousDayHoliday = await isHoliday(previousDay);

        for (const rule of rules) {
            if (rule.dayOfWeek !== dayOfWeek) continue;

            // Verificar si la regla aplica según condiciones de festivo
            if (rule.isHolidayRule && !wasPreviousDayHoliday) continue;
            if (!rule.isHolidayRule && wasPreviousDayHoliday) {
                const hasHolidayRuleForDay = rules.some(r =>
                    r.isHolidayRule && r.dayOfWeek === dayOfWeek
                );
                if (hasHolidayRuleForDay) continue;
            }

            // Si es hoy, verificar que no haya pasado el horario
            if (i === 0) {
                const currentMinutes = fromDate.getHours() * 60 + fromDate.getMinutes();
                const endMinutes = timeToMinutes(rule.endTime);
                if (currentMinutes > endMinutes) continue;
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
export const seedDefaultRules = async (): Promise<void> => {
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

/**
 * Obtiene todas las reglas de envío
 */
export const getAllRules = async () => {
    return prisma.submissionRule.findMany({
        orderBy: [{ dayOfWeek: 'asc' }, { priority: 'desc' }]
    });
};

/**
 * Obtiene todos los festivos de un año
 */
export const getHolidaysByYear = async (year: number) => {
    return prisma.colombianHoliday.findMany({
        where: { year },
        orderBy: { date: 'asc' }
    });
};
