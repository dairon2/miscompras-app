import { confirmAiAction, proposeAiAction } from '../../services/aiActionService';
import { signAiAction } from '../../services/aiSecurityService';

describe('AI action safety', () => {
    const user = { id: 'user-1', email: 'user@example.com', role: 'USER' };

    it('never allows supplier deletion through the chatbot', async () => {
        await expect(proposeAiAction('DELETE_SUPPLIER', { name: 'Proveedor' }, user)).resolves.toEqual(expect.objectContaining({
            reply: expect.stringContaining('no elimina proveedores')
        }));
    });

    it('does not let ordinary users prepare administrative mutations', async () => {
        await expect(proposeAiAction('APPROVE_REQ', { groupId: 1 }, user)).resolves.toEqual(expect.objectContaining({
            reply: expect.stringContaining('No tienes permisos')
        }));
    });

    it('rejects a confirmation token issued to another user before accessing data', async () => {
        const token = signAiAction({ requestId: 'request-2', userId: 'user-2', action: 'CREATE_REQ', params: {} });
        await expect(confirmAiAction(token, user, {})).rejects.toThrow('otro usuario');
    });
});
