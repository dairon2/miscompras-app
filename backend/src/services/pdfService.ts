import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { uploadToBlobStorage, isBlobStorageAvailable } from './blobStorageService';

// Get the logo path
const LOGO_PATH = path.join(__dirname, '../../assets/logo.png');
const UPLOADS_DIR = path.join(__dirname, '../../uploads/pdfs');

// Backend URL for constructing full file URLs
const BACKEND_URL = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:3001';

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

            // Title (center) - Only project name, no code
            doc.fontSize(14).font('Helvetica-Bold')
                .text('PRESUPUESTO', 140, 55, { width: 300, align: 'center' });
            doc.fontSize(10).font('Helvetica')
                .text(budget.project?.name || budget.title, 140, 75, { width: 300, align: 'center' });
            doc.fontSize(9)
                .text(`Fecha de ejecución: ${formatDate(budget.createdAt)}`, 140, 92, { width: 300, align: 'center' });

            // Code box (right) - Format: Código, Versión, Año (with month)
            doc.rect(450, 50, 110, 60).stroke();
            doc.fontSize(8).font('Helvetica-Bold').text('Código:', 455, 55);
            doc.fontSize(9).font('Helvetica').text(budget.code || 'FA-4.5-01', 455, 66);
            doc.fontSize(8).font('Helvetica-Bold').text('Versión:', 455, 78);
            doc.fontSize(9).font('Helvetica').text(`${budget.version}`, 495, 78);
            doc.fontSize(8).font('Helvetica-Bold').text('Año:', 455, 90);
            // Format year with month name
            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const yearMonth = `${monthNames[budget.createdAt.getMonth()]} ${budget.year}`;
            doc.fontSize(9).font('Helvetica').text(yearMonth, 475, 90);

            // Line separator
            doc.moveTo(50, 125).lineTo(560, 125).stroke();

            // Budget summary - Title and total (no code)
            doc.fontSize(11).font('Helvetica-Bold')
                .text(`${budget.title} - Presupuesto total: ${formatCurrency(budget.amount)}`, 50, 140, { width: pageWidth, align: 'center' });

            // Table header
            const tableTop = 170;
            const col1 = 50, col2 = 250, col3 = 350, col4 = 450;

            doc.rect(50, tableTop, 510, 25).fillAndStroke('#f0f0f0', '#000');
            doc.fillColor('#000').fontSize(10).font('Helvetica-Bold');
            doc.text('Categoría', col1 + 5, tableTop + 8);
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

            // Financier section - Shows Project name
            const finY = sepY + 15;
            doc.rect(50, finY, 260, 40).stroke();
            doc.rect(310, finY, 250, 40).stroke();
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('Financiador:', 55, finY + 5);
            doc.text('Valor:', 315, finY + 5);
            doc.fontSize(10).font('Helvetica');
            doc.text(budget.project?.name || 'N/A', 55, finY + 22, { width: 250, align: 'center' });
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

            stream.on('finish', async () => {
                const localPath = `/uploads/pdfs/${fileName}`;
                const fullLocalUrl = `${BACKEND_URL}${localPath}`;
                if (isBlobStorageAvailable()) {
                    try {
                        const blobUrl = await uploadToBlobStorage(filePath, `budgets/${fileName}`);
                        if (blobUrl) {
                            console.log('[PDF Service] Budget PDF uploaded to Blob:', blobUrl);
                            resolve(blobUrl);
                            return;
                        }
                    } catch (e) { console.error('[PDF Service] Blob upload failed:', e); }
                }
                console.log('[PDF Service] Budget PDF generated locally:', localPath);
                resolve(localPath);
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

// ==================== REQUIREMENT GROUP PDF ====================

interface RequirementGroupData {
    id: number;
    code?: string;
    version?: number;
    creator: { name: string; email: string };
    createdAt: Date;
    project?: { name: string; code?: string };
    status?: string;
    approvedBy?: { name: string };
    approvedAt?: Date;
    requirements: Array<{
        title: string;
        description: string;
        quantity?: string;
        budget?: { title: string; code?: string };
        supplier?: { name: string };
        comments?: string;
        area: { name: string };
    }>;
}

export const generateRequirementGroupPDF = async (group: RequirementGroupData): Promise<string> => {
    console.log('[PDF Service] Starting Requirement Group PDF generation for ID:', group.id);

    return new Promise((resolve, reject) => {
        try {
            if (!ensureUploadDir()) {
                reject(new Error('Upload directory not available'));
                return;
            }

            const fileName = `requerimiento_${group.id}_${Date.now()}.pdf`;
            const filePath = path.join(UPLOADS_DIR, fileName);

            const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            const pageWidth = doc.page.width - 100;

            // ===== HEADER =====
            // Logo placeholder (left)
            doc.rect(50, 50, 100, 60).stroke();
            doc.fontSize(7).font('Helvetica-Bold').text('MUSEO DE', 55, 65, { width: 90, align: 'center' });
            doc.fontSize(7).text('ANTIOQUIA', 55, 75, { width: 90, align: 'center' });

            // Title (center)
            doc.fontSize(12).font('Helvetica-Bold')
                .text('REQUERIMIENTO DE BIENES Y SERVICIOS', 160, 55, { width: 280, align: 'center' });
            doc.fontSize(9).font('Helvetica')
                .text(group.project?.name || 'Museo de Antioquia', 160, 75, { width: 280, align: 'center' });

            // Code box (right)
            doc.rect(450, 50, 110, 60).stroke();
            doc.fontSize(8).font('Helvetica-Bold').text('Código', 455, 55);
            doc.fontSize(9).font('Helvetica').text(group.code || `REQ-${group.id}`, 455, 66);
            doc.fontSize(8).font('Helvetica-Bold').text('VERSIÓN:', 455, 78);
            doc.fontSize(9).font('Helvetica').text(`${group.version || '01'}`, 500, 78);
            // Format date with month name and year only (e.g., "Enero 2026")
            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const dateStr = `${monthNames[group.createdAt.getMonth()]} ${group.createdAt.getFullYear()}`;
            doc.fontSize(8).text(dateStr, 455, 92);

            // ===== REQUESTER INFO =====
            doc.moveTo(50, 125).lineTo(560, 125).stroke();

            doc.fontSize(9).font('Helvetica');
            doc.text(`Fecha de impresión: ${formatDate(new Date())} ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`, 50, 135);
            doc.text(`Solicita: ${group.creator.name}`, 50, 150);
            doc.fontSize(10).font('Helvetica-Bold').text(`Requerimiento N°: ${group.id}`, 50, 165);

            // ===== TABLE =====
            let yPos = 195;
            const col1 = 50, col2 = 200, col3 = 300, col4 = 400, col5 = 510;

            // Table header
            doc.rect(50, yPos, 510, 30).fillAndStroke('#f3f4f6', '#000');
            doc.fillColor('#000').fontSize(8).font('Helvetica-Bold');
            doc.text('Detalles del\nRequerimiento', col1 + 5, yPos + 5, { width: 140 });
            doc.text('Presupuesto', col2 + 5, yPos + 10);
            doc.text('Comentarios', col3 + 5, yPos + 10);
            doc.text('Proveedor\nSugerido', col4 + 5, yPos + 5, { width: 80 });
            doc.text('Cantidad', col5 + 5, yPos + 10);

            yPos += 30;

            // Table rows
            for (const req of group.requirements) {
                if (yPos > 600) {
                    doc.addPage();
                    yPos = 50;
                }

                const rowHeight = 40;
                doc.rect(50, yPos, 510, rowHeight).stroke();
                doc.fillColor('#000').fontSize(8).font('Helvetica');

                // Column 1: Details (Title + Area)
                doc.font('Helvetica-Bold').text(req.title, col1 + 5, yPos + 5, { width: 140 });
                doc.font('Helvetica').fontSize(7).text(req.area?.name || '', col1 + 5, yPos + 20, { width: 140 });

                // Column 2: Budget
                doc.fontSize(8).text(req.budget?.code || req.budget?.title || '', col2 + 5, yPos + 15, { width: 90 });

                // Column 3: Comments
                doc.text(req.comments || '', col3 + 5, yPos + 10, { width: 90, height: 30 });

                // Column 4: Supplier
                doc.text(req.supplier?.name || '', col4 + 5, yPos + 15, { width: 80 });

                // Column 5: Quantity
                doc.text(req.quantity || '1', col5 + 5, yPos + 15, { width: 40, align: 'center' });

                yPos += rowHeight;
            }

            // ===== STATUS NOTE =====
            yPos += 20;
            const statusText = group.status === 'APPROVED'
                ? 'Este documento ha sido aprobado.'
                : group.status === 'REJECTED'
                    ? 'Este documento ha sido rechazado.'
                    : 'Este documento se envió a Compras y a financiera para buscar su aprobación.';

            doc.rect(50, yPos, 510, 30).fillAndStroke('#fff9e6', '#e6d800');
            doc.fillColor('#666').fontSize(9).font('Helvetica')
                .text(statusText, 55, yPos + 10, { width: 500, align: 'center' });

            // ===== APPROVAL STAMP (if approved) =====
            if (group.approvedBy && group.approvedAt) {
                doc.save();
                doc.rotate(-25, { origin: [400, 400] });
                doc.fontSize(24).fillColor('#00aa00').font('Helvetica-Bold')
                    .text('APROBADO', 320, 380);
                doc.fontSize(10).fillColor('#00aa00')
                    .text(`Por: ${group.approvedBy.name}`, 320, 410);
                doc.fontSize(9)
                    .text(formatDate(group.approvedAt), 320, 425);
                doc.restore();
                doc.fillColor('#000');
            }

            // ===== FOOTER =====
            yPos += 60;
            doc.fillColor('#000').fontSize(9).font('Helvetica')
                .text(`© ${new Date().getFullYear()} Museo de Antioquia. Proceso de Compras.`, 50, yPos, { width: pageWidth, align: 'center' });

            doc.end();

            stream.on('finish', async () => {
                const localPath = `/uploads/pdfs/${fileName}`;
                const fullLocalUrl = `${BACKEND_URL}${localPath}`;
                if (isBlobStorageAvailable()) {
                    try {
                        const blobUrl = await uploadToBlobStorage(filePath, `requirements/${fileName}`);
                        if (blobUrl) {
                            console.log('[PDF Service] Requirement PDF uploaded to Blob:', blobUrl);
                            resolve(blobUrl);
                            return;
                        }
                    } catch (e) { console.error('[PDF Service] Blob upload failed:', e); }
                }
                console.log('[PDF Service] Requirement PDF generated locally:', localPath);
                resolve(localPath);
            });

            stream.on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
};
