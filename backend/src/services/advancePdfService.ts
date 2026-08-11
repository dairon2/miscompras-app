import PDFDocument from 'pdfkit';

type AdvancePdfData = {
    consecutive: number;
    requestDate: Date | string;
    beneficiaryType: string;
    beneficiaryDocument: string;
    beneficiaryName: string;
    purpose: string;
    amount: unknown;
    costCenter?: string | null;
    legalizationNotes?: string | null;
};

const NAVY = '#11138A';
const BLACK = '#111111';
const LIGHT_GRAY = '#F7F7F7';

const PAYROLL_AUTHORIZATION =
    'El Museo de Antioquia declara que el plazo para la legalización de anticipos es de quince (15) días calendario, contados a partir de la fecha de este documento de solicitud de anticipo. Por lo anterior, en mi calidad de empleado del Museo de Antioquia y por medio del presente escrito autorizo al Departamento de Nómina, para que descuente en una sola cuota, del valor de mi salario la suma correspondiente al monto total detallado en este documento; solo en el caso de que este no sea legalizado de mi parte en el plazo previsto. Autorizo igualmente al Museo de Antioquia, mi empleador, para que en el caso de que se dé por terminado mi contrato laboral por cualquier causa, dé por cumplido el plazo y haga exigible la totalidad de las obligaciones que por concepto de legalización de anticipos estén pendientes, para lo cual podrá deducir la totalidad del valor adeudado de mis salarios y prestaciones sociales.\n\nEn caso de que dichas sumas de dinero no sean suficientes para cubrir el monto de las obligaciones adquiridas, reconozco mérito ejecutivo a este documento para el cobro de las obligaciones que llegaren a quedar pendientes de mi parte.';

const formatDate = (value: Date | string) => new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC'
}).format(new Date(value));

const formatAmount = (value: unknown) => new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0
}).format(Number(value));

const drawMuseumMark = (document: PDFKit.PDFDocument, x: number, y: number) => {
    document.save().lineWidth(0.8).strokeColor(BLACK);
    document.moveTo(x, y + 24).lineTo(x + 116, y + 24).stroke();
    document.moveTo(x + 7, y + 22).lineTo(x + 7, y + 6).lineTo(x + 109, y + 6).lineTo(x + 109, y + 22).stroke();
    for (let column = 0; column < 9; column += 1) {
        const columnX = x + 13 + (column * 12);
        document.rect(columnX, y + 10, 5, 12).stroke();
    }
    document.font('Helvetica').fontSize(6.5).fillColor(BLACK)
        .text('M U S E O   D E   A N T I O Q U I A', x, y + 28, { width: 116, align: 'center' });
    document.restore();
};

const drawValueBox = (
    document: PDFKit.PDFDocument,
    value: string,
    x: number,
    y: number,
    width: number,
    height = 24,
    options: { bold?: boolean; align?: 'left' | 'center' | 'right'; fontSize?: number } = {}
) => {
    document.save().lineWidth(1).strokeColor(BLACK).rect(x, y, width, height).stroke();
    document.lineWidth(0.6).rect(x + 2, y + 2, width - 4, height - 4).stroke();
    document.font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(options.fontSize || 10)
        .fillColor(BLACK)
        .text(value, x + 6, y + Math.max(4, (height - (options.fontSize || 10)) / 2 - 1), {
            width: width - 12,
            height: height - 7,
            align: options.align || 'left',
            ellipsis: true
        });
    document.restore();
};

const drawLabeledField = (
    document: PDFKit.PDFDocument,
    label: string,
    value: string,
    y: number,
    boxX = 255,
    boxWidth = 300,
    height = 25
) => {
    document.font('Helvetica').fontSize(11).fillColor(NAVY).text(label, 62, y + 6, { width: boxX - 72 });
    drawValueBox(document, value, boxX, y, boxWidth, height, { fontSize: 10 });
};

const drawSignatureSection = (document: PDFKit.PDFDocument) => {
    const x = 56;
    const y = 630;
    const width = 500;
    const cellWidth = width / 3;
    const labels = ['Aprobado por', 'Funcionario', 'Contabilidad'];

    labels.forEach((label, index) => {
        const cellX = x + (index * cellWidth);
        document.lineWidth(0.8).strokeColor(BLACK).rect(cellX, y, cellWidth, 62).stroke();
        document.moveTo(cellX + 14, y + 39).lineTo(cellX + cellWidth - 14, y + 39).strokeColor('#777777').stroke();
        document.font('Helvetica-Bold').fontSize(8).fillColor(BLACK)
            .text(label, cellX + 4, y + 46, { width: cellWidth - 8, align: 'center' });
    });
};

export const renderAdvancePdf = (document: PDFKit.PDFDocument, advance: AdvancePdfData) => {
    const pageX = 48;
    const pageY = 44;
    const pageWidth = 516;

    document.lineWidth(1.4).strokeColor(BLACK).rect(pageX, pageY, pageWidth, 660).stroke();

    document.lineWidth(1).rect(56, 52, 500, 72).stroke();
    document.moveTo(216, 52).lineTo(216, 124).stroke();
    document.moveTo(486, 52).lineTo(486, 124).stroke();
    drawMuseumMark(document, 78, 69);

    document.font('Times-Bold').fontSize(15).fillColor(BLACK)
        .text('SOLICITUD DE ANTICIPOS', 224, 78, { width: 254, align: 'center' });
    document.font('Helvetica').fontSize(7.2).fillColor(BLACK)
        .text('CÓDIGO:\nFA_4.1_01\nVERSIÓN: 02\nFebrero 24 de 2021', 491, 58, { width: 60, lineGap: 1 });

    document.font('Helvetica').fontSize(9.5).fillColor(NAVY).text('Nro Anticipo', 365, 132, { width: 110 });
    drawValueBox(document, String(advance.consecutive), 486, 127, 70, 22, { align: 'center', fontSize: 10 });
    document.font('Helvetica').fontSize(9.5).fillColor(NAVY).text('Fecha del Anticipo', 365, 160, { width: 110 });
    drawValueBox(document, formatDate(advance.requestDate), 486, 155, 70, 22, { align: 'center', fontSize: 9 });

    drawLabeledField(document, 'Centro de Costos:', advance.costCenter || '-', 192);
    drawLabeledField(document, 'Cédula o NIT:', advance.beneficiaryDocument, 228, 255, 220);
    drawLabeledField(document, 'Nombre del Funcionario o Empresa:', advance.beneficiaryName, 264);
    drawLabeledField(document, 'Motivo del Anticipo:', advance.purpose, 300, 205, 350, 42);

    document.font('Helvetica').fontSize(10).fillColor(BLACK).text('Vr Anticipo', 350, 358, { width: 92, align: 'right' });
    drawValueBox(document, `$  ${formatAmount(advance.amount)}`, 450, 350, 106, 30, { bold: true, align: 'right', fontSize: 13 });

    if (advance.beneficiaryType === 'EMPLOYEE') {
        document.fillColor(LIGHT_GRAY).rect(56, 394, 500, 188).fill();
        document.lineWidth(0.8).strokeColor(BLACK).rect(56, 394, 500, 188).stroke();
        document.font('Helvetica-Bold').fontSize(8).fillColor(BLACK)
            .text('AUTORIZACIÓN PARA DESCUENTO POR NÓMINA DE ANTICIPOS NO LEGALIZADOS.', 61, 401, { width: 490, align: 'center' });
        document.font('Helvetica').fontSize(7.2).fillColor(BLACK)
            .text(PAYROLL_AUTHORIZATION, 62, 419, { width: 488, height: 156, align: 'justify', lineGap: 0.8 });
    } else {
        document.lineWidth(0.8).strokeColor(BLACK).rect(56, 394, 500, 188).stroke();
        document.font('Helvetica-Bold').fontSize(8).fillColor(BLACK).text('OBSERVACIONES', 61, 401, { width: 490 });
        document.moveTo(56, 416).lineTo(556, 416).stroke();
        if (advance.legalizationNotes) {
            document.font('Helvetica').fontSize(8.5).fillColor(BLACK)
                .text(advance.legalizationNotes, 62, 424, { width: 488, height: 150 });
        }
    }

    drawSignatureSection(document);
};
