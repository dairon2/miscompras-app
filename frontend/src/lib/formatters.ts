/**
 * Utility functions for consistent date formatting across the application
 */

const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Format a date to Spanish locale (DD/MM/YYYY)
 */
export const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Fecha inválida';

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();

    return `${day}/${month}/${year}`;
};

/**
 * Format a date with time to Spanish locale (DD/MM/YYYY HH:MM)
 */
export const formatDateTime = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Fecha inválida';

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
};

/**
 * Format a date in long Spanish format (Lunes, 1 de Enero de 2024)
 */
export const formatDateLong = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Fecha inválida';

    const dayName = DAYS_ES[d.getDay()];
    const day = d.getDate();
    const month = MONTHS_ES[d.getMonth()];
    const year = d.getFullYear();

    return `${dayName}, ${day} de ${month} de ${year}`;
};

/**
 * Format a date as month and year (Enero 2024)
 */
export const formatMonthYear = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Fecha inválida';

    return `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * Get relative time in Spanish (hace 5 minutos, hace 2 horas, etc.)
 */
export const formatRelativeTime = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Fecha inválida';

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return 'Hace un momento';
    if (diffMinutes < 60) return `Hace ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;

    return formatDate(d);
};

/**
 * Format currency in Colombian Pesos
 */
export const formatCurrency = (amount: number | string | null | undefined): string => {
    if (amount === null || amount === undefined) return '$0';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '$0';

    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
};
