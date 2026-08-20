import {
    canPerformAiAction,
    hasGlobalAiReadAccess,
    requirementVisibilityWhere,
    signAiAction,
    verifyAiAction
} from '../../services/aiSecurityService';

describe('AI security policy', () => {
    it('uses explicit global-read roles instead of granting access to every non-user role', () => {
        expect(hasGlobalAiReadAccess('ADMIN')).toBe(true);
        expect(hasGlobalAiReadAccess('AUDITOR')).toBe(true);
        expect(hasGlobalAiReadAccess('INVOICE_VALIDATOR')).toBe(false);
        expect(hasGlobalAiReadAccess('LEADER')).toBe(false);
    });

    it('keeps mutation permissions action-specific', () => {
        expect(canPerformAiAction('USER', 'CREATE_REQ')).toBe(true);
        expect(canPerformAiAction('USER', 'APPROVE_REQ')).toBe(false);
        expect(canPerformAiAction('AUDITOR', 'ASSIGN_SUPPLIER')).toBe(false);
        expect(canPerformAiAction('COORDINATOR', 'ASSIGN_SUPPLIER')).toBe(true);
    });

    it('scopes non-global requirement access to ownership and leadership relations', () => {
        const where = requirementVisibilityWhere({ id: 'user-1', email: 'user@example.com', role: 'USER' });
        expect(where).toEqual(expect.objectContaining({
            OR: expect.arrayContaining([
                { createdById: 'user-1' },
                { currentOwnerId: 'user-1' }
            ])
        }));
        expect(requirementVisibilityWhere({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' })).toEqual({});
    });

    it('signs short-lived actions with their user and request identity', () => {
        const token = signAiAction({ requestId: 'request-1', userId: 'user-1', action: 'CREATE_REQ', params: { title: 'Prueba' } });
        expect(verifyAiAction(token)).toEqual(expect.objectContaining({
            requestId: 'request-1',
            userId: 'user-1',
            action: 'CREATE_REQ'
        }));
    });
});
