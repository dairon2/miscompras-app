export interface RequirementPurchaseOrderUpdate {
    purchaseOrderNumber: string | null | undefined;
    purchaseOrderDate: Date | null | undefined;
    changed: boolean;
}

export const normalizeRequirementPurchaseOrderNumber = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null || value === 'null') return null;

    const normalized = String(value).trim();
    return normalized || null;
};

export const buildRequirementPurchaseOrderUpdate = (
    currentNumber: string | null | undefined,
    incomingNumber: unknown,
    now: Date = new Date()
): RequirementPurchaseOrderUpdate => {
    const normalizedCurrent = normalizeRequirementPurchaseOrderNumber(currentNumber) ?? null;
    const normalizedIncoming = normalizeRequirementPurchaseOrderNumber(incomingNumber);

    if (normalizedIncoming === undefined || normalizedIncoming === normalizedCurrent) {
        return {
            purchaseOrderNumber: undefined,
            purchaseOrderDate: undefined,
            changed: false
        };
    }

    return {
        purchaseOrderNumber: normalizedIncoming,
        purchaseOrderDate: normalizedIncoming ? now : null,
        changed: true
    };
};
