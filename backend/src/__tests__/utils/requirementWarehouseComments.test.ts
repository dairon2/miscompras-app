import {
    MAX_WAREHOUSE_COMMENT_LENGTH,
    canEditWarehouseComments,
    normalizeWarehouseComments
} from '../../utils/requirementWarehouseComments';

describe('requirement warehouse comments', () => {
    it.each(['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'])(
        'allows the trusted role %s to edit warehouse comments',
        (role) => {
            expect(canEditWarehouseComments(role)).toBe(true);
        }
    );

    it.each(['USER', 'LEADER', 'AUDITOR', 'INVOICE_VALIDATOR', undefined])(
        'denies warehouse comment edits for %s',
        (role) => {
            expect(canEditWarehouseComments(role)).toBe(false);
        }
    );

    it('normalizes blank and explicit null values', () => {
        expect(normalizeWarehouseComments('   ')).toEqual({ value: null });
        expect(normalizeWarehouseComments('null')).toEqual({ value: null });
    });

    it('trims valid comments without changing their content', () => {
        expect(normalizeWarehouseComments('  Recibido sin novedades.  ')).toEqual({
            value: 'Recibido sin novedades.'
        });
    });

    it('rejects oversized comments', () => {
        expect(normalizeWarehouseComments('a'.repeat(MAX_WAREHOUSE_COMMENT_LENGTH + 1))).toEqual({
            error: `Comentarios de Bodega no puede superar ${MAX_WAREHOUSE_COMMENT_LENGTH} caracteres`
        });
    });
});
