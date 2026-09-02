import {
    canEditSupplierCreatedAt,
    parseSupplierCreatedAt
} from '../../utils/supplierCreatedAt';

describe('supplier creation date editing', () => {
    it('allows only administrators and developers to edit the date', () => {
        expect(canEditSupplierCreatedAt('ADMIN')).toBe(true);
        expect(canEditSupplierCreatedAt('DEVELOPER')).toBe(true);
        expect(canEditSupplierCreatedAt('DIRECTOR')).toBe(false);
        expect(canEditSupplierCreatedAt('COORDINATOR')).toBe(false);
        expect(canEditSupplierCreatedAt('LEADER')).toBe(false);
    });

    it('parses a valid ISO date', () => {
        const parsed = parseSupplierCreatedAt(
            '2026-07-30T07:21:22.000Z',
            new Date('2026-09-02T12:00:00.000Z')
        );

        expect(parsed?.toISOString()).toBe('2026-07-30T07:21:22.000Z');
    });

    it('rejects invalid and future dates', () => {
        const now = new Date('2026-09-02T12:00:00.000Z');

        expect(parseSupplierCreatedAt('not-a-date', now)).toBeNull();
        expect(parseSupplierCreatedAt('2026-09-03T12:00:00.000Z', now)).toBeNull();
    });
});
