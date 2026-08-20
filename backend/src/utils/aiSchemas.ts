import { z } from 'zod';

const historyItemSchema = z.object({
    role: z.enum(['user', 'model']),
    content: z.string().trim().min(1).max(4000)
});

export const aiChatRequestSchema = z.object({
    message: z.string().trim().max(3000).default(''),
    history: z.array(historyItemSchema).max(16).default([]),
    image: z.string().max(7_500_000).optional(),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']).optional()
}).superRefine((value, context) => {
    if (!value.message && !value.image) {
        context.addIssue({ code: 'custom', path: ['message'], message: 'Escribe un mensaje o adjunta un archivo' });
    }
    if (Boolean(value.image) !== Boolean(value.mimeType)) {
        context.addIssue({ code: 'custom', path: ['image'], message: 'El archivo y su tipo deben enviarse juntos' });
    }
});

export const aiConfirmRequestSchema = z.object({
    token: z.string().min(40).max(5000)
});

export const aiExtractRequestSchema = z.object({
    text: z.string().trim().min(3).max(5000)
});

export const aiIntentSchema = z.object({
    action: z.string().trim().min(1).max(50),
    params: z.record(z.string(), z.unknown()).default({}),
    explanation: z.string().max(500).optional()
});
