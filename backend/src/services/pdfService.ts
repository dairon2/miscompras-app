import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Get the logo path
const LOGO_PATH = path.join(__dirname, '../../assets/logo.png');
const UPLOADS_DIR = path.join(__dirname, '../../uploads/pdfs');

// Ensure uploads directory exists with better error handling
const ensureUploadDir = () => {
    try {
        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
            console.log('[PDF Service] Created uploads directory:', UPLOADS_DIR);
        }
        return true;
    } catch (error) {
        console.error('[PDF Service] Failed to create uploads directory:', error);
        return false;
    }
};

// Initialize on load
ensureUploadDir();

// Format currency
const formatCurrency = (amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
};

// Format date
const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
};

// ==================== BUDGET DOCUMENT PDF ====================

interface BudgetData {
    code?: string;
    title: string;
    description?: string;
    amount: number;
    available: number;
    year: number;
    version: number;
    project: { name: string; code?: string };
    area: { name: string };
    category?: { name: string; code: string };
    manager?: { name: string };
    createdBy?: { name: string };
    approvedBy?: { name: string };
    approvedAt?: Date;
    createdAt: Date;
}

export const generateBudgetPDF = async (budget: BudgetData): Promise<string> => {
    console.log('[PDF Service] Starting budget PDF generation for:', budget.code || budget.title);

    return new Promise((resolve, reject) => {
        try {
            // Ensure directory exists before creating file
            if (!ensureUploadDir()) {
                console.error('[PDF Service] Upload directory not available, skipping PDF generation');
                reject(new Error('Upload directory not available'));
                return;
            }

            const fileName = `presupuesto_${budget.code || budget.title.replace(/\s/g, '_')}_${Date.now()}.pdf`;
            const filePath = path.join(UPLOADS_DIR, fileName);
            console.log('[PDF Service] Creating PDF at:', filePath);

            const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Header with logo
            const pageWidth = doc.page.width - 100;

            // Logo placeholder (left)
            doc.rect(50, 50, 80, 60).stroke();
            doc.fontSize(8).text('MUSEO DE', 55, 65, { width: 70, align: 'center' });
            doc.fontSize(8).text('ANTIOQUIA', 55, 78, { width: 70, align: 'center' });

            // Title (center)
            doc.fontSize(14).font('Helvetica-Bold')
                .text('PRESUPUESTO', 140, 55, { width: 300, align: 'center' });
            doc.fontSize(10).font('Helvetica')
                .text(`${budget.code || ''} ${budget.project?.name || ''}`, 140, 75, { width: 300, align: 'center' });
            doc.fontSize(9)
                .text(`Fecha de ejecución: ${formatDate(budget.createdAt)}`, 140, 92, { width: 300, align: 'center' });

            // Code box (right)
            doc.rect(450, 50, 110, 60).stroke();
            doc.fontSize(8).font('Helvetica-Bold').text('Código', 455, 55);
            doc.fontSize(9).font('Helvetica').text(budget.code || 'N/A', 455, 68);
            doc.fontSize(8).font('Helvetica-Bold').text('VERSIÓN:', 455, 82);
            doc.fontSize(9).font('Helvetica').text(`${budget.version}`, 505, 82);
            doc.fontSize(8).font('Helvetica-Bold').text('Año:', 455, 96);
            doc.fontSize(9).font('Helvetica').text(`${budget.year}`, 480, 96);

            // Line separator
            doc.moveTo(50, 125).lineTo(560, 125).stroke();

            // Budget summary
            doc.fontSize(11).font('Helvetica-Bold')
                .text(`${budget.code || ''} ${budget.title} Presupuesto total: ${formatCurrency(budget.amount)}`, 50, 140, { width: pageWidth, align: 'center' });

            // Table header
            const tableTop = 170;
            const col1 = 50, col2 = 250, col3 = 350, col4 = 450;

            doc.rect(50, tableTop, 510, 25).fillAndStroke('#f0f0f0', '#000');
            doc.fillColor('#000').fontSize(10).font('Helvetica-Bold');
            doc.text('Rubro', col1 + 5, tableTop + 8);
            doc.text('Presupuesto', col2 + 5, tableTop + 8);
            doc.text('Ejecutado', col3 + 5, tableTop + 8);
            doc.text('Saldo', col4 + 5, tableTop + 8);

            // Table row
            const rowY = tableTop + 25;
            const executed = Number(budget.amount) - Number(budget.available);

            doc.rect(50, rowY, 510, 25).stroke();
            doc.fontSize(9).font('Helvetica');
            doc.text(budget.category?.name || budget.title, col1 + 5, rowY + 8, { width: 190 });
            doc.text(formatCurrency(budget.amount), col2 + 5, rowY + 8);
            doc.text(formatCurrency(executed), col3 + 5, rowY + 8);
            doc.text(formatCurrency(budget.available), col4 + 5, rowY + 8);

            // Totals row
            const totalY = rowY + 25;
            doc.rect(50, totalY, 510, 25).stroke();
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Total:', col1 + 5, totalY + 8);
            doc.text(formatCurrency(budget.amount), col2 + 5, totalY + 8);
            doc.text(formatCurrency(executed), col3 + 5, totalY + 8);
            doc.text(formatCurrency(budget.available), col4 + 5, totalY + 8);

            // Line separator
            const sepY = totalY + 45;
            doc.moveTo(50, sepY).lineTo(560, sepY).stroke();

            // Financier section
            const finY = sepY + 15;
            doc.rect(50, finY, 260, 40).stroke();
            doc.rect(310, finY, 250, 40).stroke();
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('Financiador:', 55, finY + 5);
            doc.text('Valor:', 315, finY + 5);
            doc.fontSize(10).font('Helvetica');
            doc.text(budget.area?.name || 'N/A', 55, finY + 22, { width: 250, align: 'center' });
            doc.text(formatCurrency(budget.amount), 315, finY + 22, { width: 240, align: 'center' });

            // Signatures section
            const sigY = finY + 60;
            doc.fontSize(8).font('Helvetica-Bold');
            doc.text('Creado por:', 50, sigY);
            doc.text('Líder que aprobó:', 200, sigY);
            doc.text('Aprobado por Dirección:', 380, sigY);

            doc.font('Helvetica').fontSize(8);
            doc.text(budget.createdBy?.name || 'N/A', 50, sigY + 12);
            doc.text(budget.manager?.name || 'Pendiente', 200, sigY + 12);
            doc.text(budget.approvedBy?.name || 'Pendiente', 380, sigY + 12);

            // Footer with date
            const footerY = sigY + 50;
            doc.moveTo(50, footerY).lineTo(560, footerY).stroke();
            doc.fontSize(9).text(`Fecha de creación: ${formatDate(budget.createdAt)}`, 50, footerY + 10, { width: pageWidth, align: 'center' });

            // Approval stamp if approved
            if (budget.approvedBy && budget.approvedAt) {
                doc.save();
                doc.rotate(-25, { origin: [400, 400] });
                doc.fontSize(24).fillColor('#00aa00').font('Helvetica-Bold')
                    .text('APROBADO', 320, 380);
                doc.fontSize(10).fillColor('#00aa00')
                    .text(`Por: ${budget.approvedBy.name}`, 320, 410);
                doc.fontSize(9)
                    .text(formatDate(budget.approvedAt), 320, 425);
                doc.restore();
                doc.fillColor('#000');
            }

            doc.end();

            stream.on('finish', () => {
                resolve(`/uploads/pdfs/${fileName}`);
            });

            stream.on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
};

// ==================== ADJUSTMENT REQUEST PDF ====================

interface AdjustmentData {
    code?: string;
    type: 'INCREASE' | 'TRANSFER';
    requestedAmount: number;
    reason: string;
    status: string;
    budget: {
        title: string;
        code?: string;
        project: { name: string };
        area: { name: string };
        category?: { name: string; code: string };
    };
    sources?: Array<{
        budget: { title: string; category?: { name: string; code: string } };
        amount: number;
    }>;
    requestedBy: { name: string };
    reviewedBy?: { name: string };
    requestedAt: Date;
    reviewedAt?: Date;
}

export const generateAdjustmentPDF = async (adjustment: AdjustmentData): Promise<string> => {
    return new Promise((resolve, reject) => {
        try {
            const fileName = `ajuste_${adjustment.code || 'solicitud'}_${Date.now()}.pdf`;
            const filePath = path.join(UPLOADS_DIR, fileName);

            const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            const pageWidth = doc.page.width - 100;

            // Header with logo
            doc.rect(50, 50, 80, 60).stroke();
            doc.fontSize(8).text('MUSEO DE', 55, 65, { width: 70, align: 'center' });
            doc.fontSize(8).text('ANTIOQUIA', 55, 78, { width: 70, align: 'center' });

            // Title
            doc.fontSize(14).font('Helvetica-Bold')
                .text('AJUSTE', 140, 50, { width: 300, align: 'center' });
            doc.fontSize(12)
                .text('PRESUPUESTAL', 140, 68, { width: 300, align: 'center' });
            doc.fontSize(10).font('Helvetica')
                .text(`${adjustment.budget.code || ''} ${adjustment.budget.project?.name || ''}`, 140, 88, { width: 300, align: 'center' });

            // Code box
            doc.rect(450, 50, 110, 60).stroke();
            doc.fontSize(8).font('Helvetica-Bold').text('Código', 455, 55);
            doc.fontSize(9).font('Helvetica').text(adjustment.code || 'N/A', 455, 68);
            doc.fontSize(8).font('Helvetica-Bold').text('Tipo:', 455, 82);
            doc.fontSize(9).font('Helvetica').text(adjustment.type === 'INCREASE' ? 'Aumento' : 'Movimiento', 480, 82);

            // Line separator
            doc.moveTo(50, 125).lineTo(560, 125).stroke();

            // Request details
            let yPos = 140;
            doc.fontSize(10).font('Helvetica-Bold')
                .text(`Solicitud de aumento aprobada para el Rubro: ${adjustment.budget.category?.code || ''} ${adjustment.budget.category?.name || adjustment.budget.title}`, 50, yPos);

            yPos += 20;
            doc.font('Helvetica').fontSize(10);
            doc.text(`Fecha de solicitud: ${formatDate(adjustment.requestedAt)}`, 50, yPos);
            yPos += 15;
            doc.text(`Solicitado por: ${adjustment.requestedBy.name}`, 50, yPos);
            yPos += 15;
            doc.font('Helvetica-Bold')
                .text(`Cantidad a aumentar: ${formatCurrency(adjustment.requestedAmount)}`, 50, yPos);

            // If transfer, show sources table
            if (adjustment.type === 'TRANSFER' && adjustment.sources && adjustment.sources.length > 0) {
                yPos += 35;

                // Table header
                const col1 = 50, col2 = 250, col3 = 350, col4 = 450;
                doc.rect(50, yPos, 510, 25).fillAndStroke('#f0f0f0', '#000');
                doc.fillColor('#000').fontSize(10).font('Helvetica-Bold');
                doc.text('Rubro', col1 + 5, yPos + 8);
                doc.text('Presupuesto', col2 + 5, yPos + 8);
                doc.text('Ejecutado', col3 + 5, yPos + 8);
                doc.text('Disminuido', col4 + 5, yPos + 8);

                let totalDecrease = 0;
                yPos += 25;

                for (const source of adjustment.sources) {
                    doc.rect(50, yPos, 510, 25).stroke();
                    doc.fontSize(9).font('Helvetica');
                    doc.text(source.budget.category?.name || source.budget.title, col1 + 5, yPos + 8, { width: 190 });
                    doc.text('-', col2 + 5, yPos + 8);
                    doc.text('$0', col3 + 5, yPos + 8);
                    doc.text(formatCurrency(source.amount), col4 + 5, yPos + 8);
                    totalDecrease += Number(source.amount);
                    yPos += 25;
                }

                // Total row
                doc.rect(50, yPos, 510, 25).stroke();
                doc.fontSize(10).font('Helvetica-Bold');
                doc.text('Total a disminuir:', col1 + 5, yPos + 8);
                doc.text(formatCurrency(totalDecrease), col4 + 5, yPos + 8);
                yPos += 25;
            }

            // Reason section
            yPos += 20;
            doc.moveTo(50, yPos).lineTo(560, yPos).stroke();
            yPos += 15;
            doc.fontSize(10).font('Helvetica-Bold')
                .text('MOTIVO DEL AJUSTE PRESUPUESTAL:', 50, yPos);
            yPos += 15;
            doc.font('Helvetica').fontSize(10)
                .text(adjustment.reason, 50, yPos, { width: pageWidth });

            // Approval section
            yPos += 60;
            if (adjustment.reviewedBy && adjustment.status === 'APPROVED') {
                doc.font('Helvetica-Bold').fontSize(10)
                    .text(`Este documento fue aprobado por: ${adjustment.reviewedBy.name}`, 50, yPos);
                yPos += 20;
                if (adjustment.reviewedAt) {
                    doc.font('Helvetica').fontSize(10)
                        .text(`Fecha de aprobación: ${formatDate(adjustment.reviewedAt)}`, 50, yPos);
                }
            }

            // Footer
            yPos += 40;
            doc.moveTo(50, yPos).lineTo(560, yPos).stroke();
            yPos += 15;
            doc.fontSize(9).font('Helvetica-Bold')
                .text(`Creado por: ${adjustment.requestedBy.name}`, 50, yPos, { width: pageWidth, align: 'center' });
            yPos += 15;
            doc.fontSize(9).font('Helvetica')
                .text(`Fecha de creación: ${formatDate(adjustment.requestedAt)}`, 50, yPos, { width: pageWidth, align: 'center' });

            // Approval stamp if approved
            if (adjustment.status === 'APPROVED' && adjustment.reviewedBy) {
                doc.save();
                doc.rotate(-25, { origin: [400, 350] });
                doc.fontSize(24).fillColor('#00aa00').font('Helvetica-Bold')
                    .text('APROBADO', 320, 330);
                doc.fontSize(10).fillColor('#00aa00')
                    .text(`Por: ${adjustment.reviewedBy.name}`, 320, 360);
                doc.restore();
                doc.fillColor('#000');
            } else if (adjustment.status === 'REJECTED') {
                doc.save();
                doc.rotate(-25, { origin: [400, 350] });
                doc.fontSize(24).fillColor('#cc0000').font('Helvetica-Bold')
                    .text('RECHAZADO', 310, 330);
                doc.restore();
                doc.fillColor('#000');
            }

            doc.end();

            stream.on('finish', () => {
                resolve(`/uploads/pdfs/${fileName}`);
            });

            stream.on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
};
