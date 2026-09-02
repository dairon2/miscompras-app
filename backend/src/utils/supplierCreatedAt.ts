const SUPPLIER_CREATED_AT_EDIT_ROLES = new Set(['ADMIN', 'DEVELOPER']);

export const canEditSupplierCreatedAt = (role: string | undefined): boolean =>
    Boolean(role && SUPPLIER_CREATED_AT_EDIT_ROLES.has(role));

export const parseSupplierCreatedAt = (
    value: unknown,
    now: Date = new Date()
): Date | null => {
    if (typeof value !== 'string' || !value.trim()) return null;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;

    const clockToleranceMs = 5 * 60 * 1000;
    if (parsed.getTime() > now.getTime() + clockToleranceMs) return null;

    return parsed;
};
