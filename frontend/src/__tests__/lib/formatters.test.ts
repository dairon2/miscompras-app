/**
 * Formatter Utilities Unit Tests
 */

import {
    formatDate,
    formatDateTime,
    formatDateLong,
    formatMonthYear,
    formatRelativeTime,
    formatCurrency
} from '../../lib/formatters';

describe('formatDate', () => {
    it('should format date as DD/MM/YYYY', () => {
        const date = new Date(2024, 0, 15); // January 15, 2024
        expect(formatDate(date)).toBe('15/01/2024');
    });

    it('should handle string dates', () => {
        expect(formatDate('2024-06-20')).toBe('20/06/2024');
    });

    it('should return N/A for null', () => {
        expect(formatDate(null)).toBe('N/A');
    });

    it('should return N/A for undefined', () => {
        expect(formatDate(undefined)).toBe('N/A');
    });

    it('should return Fecha inválida for invalid date', () => {
        expect(formatDate('invalid')).toBe('Fecha inválida');
    });
});

describe('formatDateTime', () => {
    it('should format date and time as DD/MM/YYYY HH:MM', () => {
        const date = new Date(2024, 5, 15, 14, 30); // June 15, 2024 14:30
        expect(formatDateTime(date)).toBe('15/06/2024 14:30');
    });

    it('should pad hours and minutes', () => {
        const date = new Date(2024, 0, 5, 8, 5); // January 5, 2024 08:05
        expect(formatDateTime(date)).toBe('05/01/2024 08:05');
    });
});

describe('formatDateLong', () => {
    it('should format date in long Spanish format', () => {
        const date = new Date(2024, 0, 15); // Monday, January 15, 2024
        const result = formatDateLong(date);
        expect(result).toContain('15');
        expect(result).toContain('Enero');
        expect(result).toContain('2024');
    });
});

describe('formatMonthYear', () => {
    it('should format as Month Year', () => {
        const date = new Date(2024, 5, 15); // June 2024
        expect(formatMonthYear(date)).toBe('Junio 2024');
    });
});

describe('formatRelativeTime', () => {
    it('should return "Hace un momento" for recent dates', () => {
        const date = new Date();
        expect(formatRelativeTime(date)).toBe('Hace un momento');
    });

    it('should return N/A for null', () => {
        expect(formatRelativeTime(null)).toBe('N/A');
    });
});

describe('formatCurrency', () => {
    it('should format number as Colombian Pesos', () => {
        const result = formatCurrency(1500000);
        expect(result).toContain('1.500.000');
    });

    it('should handle string numbers', () => {
        const result = formatCurrency('2500000');
        expect(result).toContain('2.500.000');
    });

    it('should return $0 for null', () => {
        expect(formatCurrency(null)).toBe('$0');
    });

    it('should return $0 for undefined', () => {
        expect(formatCurrency(undefined)).toBe('$0');
    });

    it('should return $0 for invalid number string', () => {
        expect(formatCurrency('invalid')).toBe('$0');
    });
});
