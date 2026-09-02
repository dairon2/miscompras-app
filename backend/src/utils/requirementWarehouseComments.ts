const WAREHOUSE_COMMENT_EDITOR_ROLES = new Set([
    'ADMIN',
    'DIRECTOR',
    'COORDINATOR',
    'DEVELOPER'
]);

export const MAX_WAREHOUSE_COMMENT_LENGTH = 4000;

export const canEditWarehouseComments = (role?: string): boolean =>
    WAREHOUSE_COMMENT_EDITOR_ROLES.has(role || '');

export const normalizeWarehouseComments = (value: unknown): {
    value?: string | null;
    error?: string;
} => {
    if (value === undefined) return { value: undefined };
    if (value === null || value === 'null') return { value: null };
    if (typeof value !== 'string') {
        return { error: 'Comentarios de Bodega debe ser texto' };
    }

    const normalizedValue = value.trim();
    if (normalizedValue.length > MAX_WAREHOUSE_COMMENT_LENGTH) {
        return {
            error: `Comentarios de Bodega no puede superar ${MAX_WAREHOUSE_COMMENT_LENGTH} caracteres`
        };
    }

    return { value: normalizedValue || null };
};
