import { rateLimit } from 'express-rate-limit';

const keyGenerator = (req: any) => req.user?.id || req.ip;

export const aiChatRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator,
    message: { error: 'Has enviado demasiados mensajes. Espera un minuto antes de continuar.' }
});
export const aiConfirmRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 8,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator,
    message: { error: 'Has confirmado demasiadas acciones. Espera un minuto antes de continuar.' }
});
