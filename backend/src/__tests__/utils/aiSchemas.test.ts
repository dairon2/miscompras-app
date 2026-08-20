import { aiChatRequestSchema, aiConfirmRequestSchema, aiExtractRequestSchema } from '../../utils/aiSchemas';

describe('AI request schemas', () => {
    it('accepts a bounded text conversation', () => {
        const result = aiChatRequestSchema.safeParse({
            message: '¿Cuál es mi presupuesto?',
            history: [{ role: 'user', content: 'Consulta anterior' }, { role: 'model', content: 'Respuesta anterior' }]
        });
        expect(result.success).toBe(true);
    });

    it('rejects unsupported attachments and unbounded history', () => {
        expect(aiChatRequestSchema.safeParse({ message: '', image: 'abc', mimeType: 'application/zip' }).success).toBe(false);
        expect(aiChatRequestSchema.safeParse({
            message: 'Hola',
            history: Array.from({ length: 17 }, () => ({ role: 'user', content: 'x' }))
        }).success).toBe(false);
    });

    it('requires a substantial signed confirmation token', () => {
        expect(aiConfirmRequestSchema.safeParse({ token: 'short' }).success).toBe(false);
        expect(aiConfirmRequestSchema.safeParse({ token: 'x'.repeat(80) }).success).toBe(true);
    });

    it('bounds requirement extraction text', () => {
        expect(aiExtractRequestSchema.safeParse({ text: 'Compra de papelería' }).success).toBe(true);
        expect(aiExtractRequestSchema.safeParse({ text: 'x'.repeat(5001) }).success).toBe(false);
    });
});
