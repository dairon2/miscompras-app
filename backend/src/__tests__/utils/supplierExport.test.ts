import { buildSupplierExportWhere } from '../../utils/supplierExport';

describe('supplier export filters', () => {
    it('applies all filters for a global access role', () => {
        const where = buildSupplierExportWhere('ADMIN', 'admin-id', {
            search: '  papeleria  ',
            supplierType: 'SUPPLIER',
            management: 'ADMINISTRATIVE_PURCHASING'
        });

        expect(where).toMatchObject({
            supplierType: 'SUPPLIER',
            management: 'ADMINISTRATIVE_PURCHASING'
        });
        expect(where.requirements).toBeUndefined();
        expect(where.AND[0].OR).toEqual(expect.arrayContaining([
            { name: { contains: 'papeleria', mode: 'insensitive' } }
        ]));
    });

    it('preserves USER visibility while applying the filters', () => {
        const where = buildSupplierExportWhere('USER', 'user-id', {
            management: 'COMMERCIAL'
        });

        expect(where.management).toBe('COMMERCIAL');
        expect(where.requirements).toEqual({
            some: {
                OR: [
                    { createdById: 'user-id' },
                    {
                        budget: {
                            OR: [
                                { managerId: 'user-id' },
                                { subLeaders: { some: { userId: 'user-id' } } }
                            ]
                        }
                    }
                ]
            }
        });
    });

    it('matches the supplier list visibility for non-USER roles', () => {
        const where = buildSupplierExportWhere('INVOICE_VALIDATOR', 'validator-id', {
            management: 'COMMERCIAL'
        });

        expect(where).toEqual({ management: 'COMMERCIAL' });
    });

    it('ignores unsupported filter values', () => {
        const where = buildSupplierExportWhere('USER', 'user-id', {
            supplierType: 'INVALID',
            management: 'INVALID',
            search: '   '
        });

        expect(where.supplierType).toBeUndefined();
        expect(where.management).toBeUndefined();
        expect(where.AND).toBeUndefined();
    });
});
