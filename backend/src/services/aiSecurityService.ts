import jwt from 'jsonwebtoken';

export const AI_GLOBAL_READ_ROLES = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER', 'AUDITOR'] as const;
export const AI_EXECUTIVE_ROLES = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'] as const;

export type AiMutableAction = 'CREATE_REQ' | 'ASSIGN_SUPPLIER' | 'APPROVE_REQ' | 'SEND_QUOTE' | 'GENERATE_CONTRACT';

export type AiActor = {
    id: string;
    email: string;
    role: string;
    areaId?: string | null;
    invoiceValidationScope?: string | null;
};

export type AiActionPayload = {
    requestId: string;
    userId: string;
    action: AiMutableAction;
    params: Record<string, unknown>;
};

const ACTION_ROLES: Record<AiMutableAction, string[]> = {
    CREATE_REQ: ['USER', 'ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'],
    ASSIGN_SUPPLIER: ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'],
    APPROVE_REQ: ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'],
    SEND_QUOTE: ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'],
    GENERATE_CONTRACT: ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER']
};

export const hasGlobalAiReadAccess = (role: string) => AI_GLOBAL_READ_ROLES.includes(role as typeof AI_GLOBAL_READ_ROLES[number]);
export const hasExecutiveAiAccess = (role: string) => AI_EXECUTIVE_ROLES.includes(role as typeof AI_EXECUTIVE_ROLES[number]);
export const canPerformAiAction = (role: string, action: AiMutableAction) => ACTION_ROLES[action].includes(role);

export const requirementVisibilityWhere = (actor: AiActor) => {
    if (hasGlobalAiReadAccess(actor.role)) return {};

    return {
        OR: [
            { createdById: actor.id },
            { currentOwnerId: actor.id },
            { project: { is: { OR: [{ leaderId: actor.id }, { subLeaderId: actor.id }] } } },
            { area: { is: { directorId: actor.id } } }
        ]
    };
};

export const invoiceVisibilityWhere = (actor: AiActor) => {
    if (hasGlobalAiReadAccess(actor.role)) return {};
    if (actor.role === 'INVOICE_VALIDATOR') {
        const route = actor.invoiceValidationScope === 'LEGAL'
            ? 'JUR'
            : actor.invoiceValidationScope === 'ACCOUNTING' ? 'CONTAB' : 'COMERCIAL';
        return { passToArea: { contains: route, mode: 'insensitive' as const } };
    }
    return { OR: [{ createdById: actor.id }, { leaderResponsibleId: actor.id }] };
};

export const advanceVisibilityWhere = (actor: AiActor) => hasGlobalAiReadAccess(actor.role)
    ? {}
    : { requestedById: actor.id };

const actionSecret = () => {
    const secret = process.env.AI_ACTION_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error('AI_ACTION_SECRET or JWT_SECRET must be configured');
    return secret;
};

export const signAiAction = (payload: AiActionPayload) => jwt.sign(payload, actionSecret(), {
    expiresIn: '10m',
    issuer: 'miscompras-ai',
    audience: 'miscompras-ai-actions'
});

export const verifyAiAction = (token: string): AiActionPayload => jwt.verify(token, actionSecret(), {
    issuer: 'miscompras-ai',
    audience: 'miscompras-ai-actions'
}) as AiActionPayload;
