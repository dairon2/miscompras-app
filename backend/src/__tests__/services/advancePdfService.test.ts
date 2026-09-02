import { ADVANCE_FORMAT_METADATA, renderAdvancePdf } from '../../services/advancePdfService';

type CapturedCalls = {
    images: unknown[][];
    texts: unknown[][];
};

const createDocumentMock = () => {
    const calls: CapturedCalls = { images: [], texts: [] };
    let documentMock: PDFKit.PDFDocument;

    const proxy = new Proxy({}, {
        get: (_target, property) => (...args: unknown[]) => {
            if (property === 'image') calls.images.push(args);
            if (property === 'text') calls.texts.push(args);
            return documentMock;
        }
    });

    documentMock = proxy as PDFKit.PDFDocument;
    return { documentMock, calls };
};

describe('renderAdvancePdf', () => {
    it('uses the official museum logo and the current format metadata', () => {
        const { documentMock, calls } = createDocumentMock();

        renderAdvancePdf(documentMock, {
            consecutive: 4634,
            requestDate: '2026-08-02T00:00:00.000Z',
            beneficiaryType: 'EMPLOYEE',
            beneficiaryDocument: '1000000000',
            beneficiaryName: 'Persona de prueba',
            purpose: 'Anticipo de prueba',
            amount: 100000,
            costCenter: 'Administración'
        });

        expect(calls.images).toHaveLength(1);
        expect(Buffer.isBuffer(calls.images[0][0])).toBe(true);
        expect((calls.images[0][0] as Buffer).subarray(1, 4).toString('ascii')).toBe('PNG');
        expect(calls.images[0].slice(1)).toEqual([
            66,
            57,
            { fit: [140, 62], align: 'center', valign: 'center' }
        ]);
        expect(calls.texts.some(([text]) => text === ADVANCE_FORMAT_METADATA)).toBe(true);
        expect(ADVANCE_FORMAT_METADATA).toContain('VERSIÓN: 03');
        expect(ADVANCE_FORMAT_METADATA).toContain('2 de agosto de 2026');
    });
});
