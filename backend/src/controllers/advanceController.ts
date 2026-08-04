import { Response } from 'express';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import fs from 'fs';
import { AdvanceStatus, Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';
import { processFileUploads } from '../services/blobStorageService';
import logger from '../services/logger';

const ADVANCE_VIEWER_ROLES = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER', 'AUDITOR'];
const ADVANCE_MANAGER_ROLES = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'];
const ADVANCE_APPROVER_ROLES = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'];

const advanceInclude = {
    supplier: { select: { id: true, name: true, nit: true, taxId: true } },
    requirement: { select: { id: true, title: true } },
    budget: { select: { id: true, title: true, code: true } },
    project: { select: { id: true, name: true, code: true } },
    area: { select: { id: true, name: true } },
    requestedBy: { select: { id: true, name: true, email: true } },
    approvedBy: { select: { id: true, name: true, email: true } },
    disbursedBy: { select: { id: true, name: true, email: true } },
    legalizedBy: { select: { id: true, name: true, email: true } },
    attachments: { orderBy: { createdAt: 'desc' as const } },
    auditLogs: { orderBy: { createdAt: 'desc' as const } }
};

const hasRole = (role: string | undefined, roles: string[]) => roles.includes(role || '');
const optionalString = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const normalizeDocument = (value: unknown) => String(value || '').replace(/[\s,]/g, '').trim();

const writeAudit = async (client: any, data: {
    advanceId: string;
    action: string;
    fromStatus?: any;
    toStatus?: any;
    details?: string;
    actorId?: string;
    actorEmail?: string;
}) => {
    await client.advanceAuditLog.create({ data });
};

const getAdvanceOrThrow = async (id: string) => {
    const advance = await prisma.advance.findUnique({ where: { id }, include: advanceInclude });
    if (!advance) throw new Error('Anticipo no encontrado');
    return advance;
};

const parseAdvanceRows = (filePath: string) => {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames.find(name => name.trim().toUpperCase() === '2026') || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error('No se encontró la hoja histórica de anticipos');
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:I1');
    range.s.c = 0;
    range.e.c = 8;
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, range });

    return rows.slice(1).map((row, index) => {
        const consecutive = Number(String(row[0] || '').replace(/[^0-9]/g, ''));
        const rawDate = row[1];
        const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
        const amount = Number(String(row[4] || '').replace(/[^0-9.-]/g, ''));
        const document = normalizeDocument(row[2]);
        const beneficiaryName = String(row[3] || '').trim();
        const purpose = String(row[6] || '').trim();
        const status = String(row[7] || row[8] || '').trim().toUpperCase();
        const year = !Number.isNaN(date.getTime()) ? date.getFullYear() : 2026;

        return {
            sourceRow: index + 2,
            consecutive,
            year,
            requestDate: date,
            beneficiaryDocument: document,
            beneficiaryName,
            amount,
            costCenter: optionalString(row[5]),
            purpose,
            sourceStatus: status,
            valid: Number.isInteger(consecutive) && consecutive > 0 && !Number.isNaN(date.getTime())
                && amount > 0 && Boolean(document) && Boolean(beneficiaryName) && Boolean(purpose)
        };
    }).filter(row => row.consecutive || row.beneficiaryName || row.purpose);
};

const historicalStatus = (sourceStatus: string) => sourceStatus === 'OK' ? 'LEGALIZED' : 'DISBURSED';

export const getAdvances = async (req: AuthRequest, res: Response) => {
    if (!hasRole(req.user?.role, ADVANCE_VIEWER_ROLES)) return res.status(403).json({ error: 'No tienes permiso para ver anticipos' });

    try {
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '50'), 10) || 50));
        const year = req.query.year ? Number(req.query.year) : undefined;
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const where: any = {};
        if (year) where.year = year;
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { beneficiaryName: { contains: search, mode: 'insensitive' } },
                { beneficiaryDocument: { contains: normalizeDocument(search), mode: 'insensitive' } },
                { purpose: { contains: search, mode: 'insensitive' } },
                { costCenter: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [data, total, grouped, pendingLegalization] = await Promise.all([
            prisma.advance.findMany({ where, include: advanceInclude, orderBy: [{ requestDate: 'desc' }, { consecutive: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
            prisma.advance.count({ where }),
            prisma.advance.groupBy({ by: ['status'], _count: { _all: true }, where: year ? { year } : undefined }),
            prisma.advance.count({ where: { ...(year ? { year } : {}), status: 'DISBURSED', legalizationDueDate: { lt: new Date() } } })
        ]);

        return res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize), summary: { byStatus: grouped, pendingLegalization } });
    } catch (error) {
        logger.error('Error listing advances:', error);
        return res.status(500).json({ error: 'No se pudieron cargar los anticipos' });
    }
};

export const getAdvanceById = async (req: AuthRequest, res: Response) => {
    if (!hasRole(req.user?.role, ADVANCE_VIEWER_ROLES)) return res.status(403).json({ error: 'No tienes permiso para ver anticipos' });
    try {
        return res.json(await getAdvanceOrThrow(req.params.id));
    } catch (error: any) {
        return res.status(404).json({ error: error.message || 'Anticipo no encontrado' });
    }
};

export const exportAdvancesExcel = async (req: AuthRequest, res: Response) => {
    if (!hasRole(req.user?.role, ADVANCE_VIEWER_ROLES)) return res.status(403).json({ error: 'No tienes permiso para exportar anticipos' });
    try {
        const year = req.query.year ? Number(req.query.year) : undefined;
        const requestedStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
        const status = Object.values(AdvanceStatus).includes(requestedStatus as AdvanceStatus) ? requestedStatus as AdvanceStatus : undefined;
        const where: Prisma.AdvanceWhereInput = { ...(year ? { year } : {}), ...(status ? { status } : {}) };
        const advances = await prisma.advance.findMany({
            where,
            orderBy: [{ requestDate: 'desc' }, { consecutive: 'desc' }]
        });
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(`Anticipos ${year || 'Histórico'}`);
        sheet.columns = [
            { header: 'Nro', key: 'consecutive', width: 12 }, { header: 'Fecha Anticipo', key: 'requestDate', width: 16 },
            { header: 'Identificación', key: 'document', width: 20 }, { header: 'Nombre', key: 'name', width: 35 },
            { header: 'Valor', key: 'amount', width: 16 }, { header: 'Centro de costos', key: 'costCenter', width: 28 },
            { header: 'Objeto del anticipo', key: 'purpose', width: 48 }, { header: 'Estado', key: 'status', width: 18 },
            { header: 'Fecha máxima legalización', key: 'dueDate', width: 24 }
        ];
        advances.forEach(advance => sheet.addRow({
            consecutive: advance.consecutive, requestDate: advance.requestDate, document: advance.beneficiaryDocument,
            name: advance.beneficiaryName, amount: Number(advance.amount), costCenter: advance.costCenter || '',
            purpose: advance.purpose, status: advance.status, dueDate: advance.legalizationDueDate || ''
        }));
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
        sheet.getColumn('amount').numFmt = '$#,##0';
        sheet.getColumn('requestDate').numFmt = 'yyyy-mm-dd';
        sheet.getColumn('dueDate').numFmt = 'yyyy-mm-dd';
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Anticipos_${year || 'Historico'}.xlsx"`);
        await workbook.xlsx.write(res);
        return res.end();
    } catch (error) {
        logger.error('Error exporting advances:', error);
        return res.status(500).json({ error: 'No se pudo generar el reporte de anticipos' });
    }
};

export const createAdvance = async (req: AuthRequest, res: Response) => {
    if (!hasRole(req.user?.role, ADVANCE_MANAGER_ROLES) || !req.user?.id) return res.status(403).json({ error: 'No tienes permiso para registrar anticipos' });

    const files = (req.files || []) as Express.Multer.File[];
    try {
        const amount = Number(req.body.amount);
        const requestDate = req.body.requestDate ? new Date(req.body.requestDate) : new Date();
        const beneficiaryType = req.body.beneficiaryType === 'EMPLOYEE' ? 'EMPLOYEE' : 'SUPPLIER';
        const supplierId = optionalString(req.body.supplierId);
        if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'El valor del anticipo debe ser mayor a cero' });
        if (Number.isNaN(requestDate.getTime())) return res.status(400).json({ error: 'La fecha del anticipo no es válida' });

        const [supplier, requirement, budget, attachments] = await Promise.all([
            supplierId ? prisma.supplier.findUnique({ where: { id: supplierId } }) : null,
            optionalString(req.body.requirementId) ? prisma.requirement.findUnique({ where: { id: String(req.body.requirementId) } }) : null,
            optionalString(req.body.budgetId) ? prisma.budget.findUnique({ where: { id: String(req.body.budgetId) } }) : null,
            processFileUploads(files, 'advances')
        ]);
        if (supplierId && !supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });
        if (req.body.requirementId && !requirement) return res.status(404).json({ error: 'Requerimiento no encontrado' });
        if (req.body.budgetId && !budget) return res.status(404).json({ error: 'Presupuesto no encontrado' });

        const beneficiaryDocument = normalizeDocument(req.body.beneficiaryDocument || supplier?.nit || supplier?.taxId);
        const beneficiaryName = optionalString(req.body.beneficiaryName) || supplier?.name || null;
        const purpose = optionalString(req.body.purpose);
        if (!beneficiaryDocument || !beneficiaryName || !purpose) {
            return res.status(400).json({ error: 'Identificación, beneficiario y objeto son obligatorios' });
        }

        const year = requestDate.getFullYear();
        const legalizationDueDate = new Date(requestDate);
        legalizationDueDate.setDate(legalizationDueDate.getDate() + 15);
        const advance = await prisma.$transaction(async tx => {
            const sequence = await tx.advanceSequence.upsert({
                where: { year },
                create: { year, nextConsecutive: 2 },
                update: { nextConsecutive: { increment: 1 } }
            });
            const created = await tx.advance.create({
                data: {
                    consecutive: sequence.nextConsecutive - 1,
                    year,
                    requestDate,
                    beneficiaryType,
                    beneficiaryDocument,
                    beneficiaryName,
                    supplierId,
                    costCenter: optionalString(req.body.costCenter),
                    costCenterCode: optionalString(req.body.costCenterCode),
                    purpose,
                    amount,
                    legalizationDueDate,
                    requirementId: optionalString(req.body.requirementId),
                    budgetId: optionalString(req.body.budgetId),
                    projectId: optionalString(req.body.projectId),
                    areaId: optionalString(req.body.areaId),
                    requestedById: req.user!.id,
                    attachments: attachments.length ? { create: attachments } : undefined
                },
                include: advanceInclude
            });
            await writeAudit(tx, {
                advanceId: created.id,
                action: 'ADVANCE_CREATED',
                toStatus: 'REQUESTED',
                details: `Anticipo ${created.consecutive}/${year} registrado`,
                actorId: req.user!.id,
                actorEmail: req.user!.email
            });
            return created;
        });
        return res.status(201).json(advance);
    } catch (error: any) {
        logger.error('Error creating advance:', error);
        return res.status(400).json({ error: error.message || 'No se pudo registrar el anticipo' });
    }
};

export const updateAdvanceStatus = async (req: AuthRequest, res: Response) => {
    if (!hasRole(req.user?.role, ADVANCE_APPROVER_ROLES) || !req.user?.id) return res.status(403).json({ error: 'No tienes permiso para actualizar anticipos' });
    const targetStatus = String(req.body?.status || '').toUpperCase();
    const allowedTransitions: Record<string, string[]> = {
        REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
        APPROVED: ['DISBURSED', 'CANCELLED'],
        DISBURSED: ['LEGALIZED', 'CANCELLED']
    };

    try {
        const current = await getAdvanceOrThrow(req.params.id);
        if (!allowedTransitions[current.status]?.includes(targetStatus)) {
            return res.status(400).json({ error: `No se puede cambiar de ${current.status} a ${targetStatus}` });
        }
        const update: any = { status: targetStatus };
        if (targetStatus === 'APPROVED') Object.assign(update, { approvedById: req.user.id, approvedAt: new Date() });
        if (targetStatus === 'DISBURSED') Object.assign(update, { disbursedById: req.user.id, disbursedAt: new Date() });
        if (targetStatus === 'LEGALIZED') Object.assign(update, { legalizedById: req.user.id, legalizedAt: new Date(), legalizationNotes: optionalString(req.body.legalizationNotes) });
        if (targetStatus === 'CANCELLED') Object.assign(update, { cancelledAt: new Date(), cancellationReason: optionalString(req.body.cancellationReason) });

        const updated = await prisma.$transaction(async tx => {
            const record = await tx.advance.update({ where: { id: current.id }, data: update, include: advanceInclude });
            await writeAudit(tx, {
                advanceId: current.id,
                action: `ADVANCE_${targetStatus}`,
                fromStatus: current.status,
                toStatus: targetStatus,
                details: optionalString(req.body.legalizationNotes) || optionalString(req.body.cancellationReason) || undefined,
                actorId: req.user!.id,
                actorEmail: req.user!.email
            });
            return record;
        });
        return res.json(updated);
    } catch (error: any) {
        return res.status(400).json({ error: error.message || 'No se pudo actualizar el anticipo' });
    }
};

export const addAdvanceAttachments = async (req: AuthRequest, res: Response) => {
    if (!hasRole(req.user?.role, ADVANCE_MANAGER_ROLES) || !req.user?.id) return res.status(403).json({ error: 'No tienes permiso para adjuntar soportes' });
    const files = (req.files || []) as Express.Multer.File[];
    if (files.length === 0) return res.status(400).json({ error: 'Selecciona al menos un soporte' });
    try {
        await getAdvanceOrThrow(req.params.id);
        const attachments = await processFileUploads(files, 'advances');
        const updated = await prisma.$transaction(async tx => {
            const record = await tx.advance.update({
                where: { id: req.params.id },
                data: { attachments: { create: attachments } },
                include: advanceInclude
            });
            await writeAudit(tx, {
                advanceId: record.id,
                action: 'ADVANCE_ATTACHMENTS_ADDED',
                details: `${attachments.length} soporte(s) adjuntado(s)`,
                actorId: req.user!.id,
                actorEmail: req.user!.email
            });
            return record;
        });
        return res.json(updated);
    } catch (error: any) {
        return res.status(400).json({ error: error.message || 'No se pudieron adjuntar los soportes' });
    }
};

export const findAdvanceBeneficiaries = async (req: AuthRequest, res: Response) => {
    if (!hasRole(req.user?.role, ADVANCE_VIEWER_ROLES)) return res.status(403).json({ error: 'No tienes permiso para consultar beneficiarios' });
    const search = String(req.query.search || '').trim();
    if (search.length < 2) return res.json([]);
    try {
        const suppliers = await prisma.supplier.findMany({
            where: { OR: [{ name: { contains: search, mode: 'insensitive' } }, { nit: { contains: search, mode: 'insensitive' } }, { taxId: { contains: search, mode: 'insensitive' } }] },
            select: { id: true, name: true, nit: true, taxId: true }, take: 15, orderBy: { name: 'asc' }
        });
        return res.json(suppliers);
    } catch (error) {
        logger.error('Error finding advance beneficiaries:', error);
        return res.status(500).json({ error: 'No se pudieron consultar los beneficiarios' });
    }
};

export const previewAdvanceImport = async (req: AuthRequest, res: Response) => {
    if (!hasRole(req.user?.role, ADVANCE_MANAGER_ROLES)) return res.status(403).json({ error: 'No tienes permiso para importar anticipos' });
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Selecciona el archivo de anticipos' });
    try {
        const rows = parseAdvanceRows(file.path);
        const valid = rows.filter(row => row.valid);
        const existing = valid.length ? await prisma.advance.findMany({ where: { OR: valid.map(row => ({ year: row.year, consecutive: row.consecutive })) }, select: { year: true, consecutive: true } }) : [];
        const existingKeys = new Set(existing.map(row => `${row.year}-${row.consecutive}`));
        return res.json({ totalRows: rows.length, validRows: valid.length, invalidRows: rows.length - valid.length, existingRows: valid.filter(row => existingKeys.has(`${row.year}-${row.consecutive}`)).length, sample: valid.slice(0, 10) });
    } catch (error: any) {
        return res.status(400).json({ error: error.message || 'No se pudo leer el archivo de anticipos' });
    } finally {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
};

export const importAdvances = async (req: AuthRequest, res: Response) => {
    if (!hasRole(req.user?.role, ADVANCE_MANAGER_ROLES) || !req.user?.id) return res.status(403).json({ error: 'No tienes permiso para importar anticipos' });
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Selecciona el archivo de anticipos' });
    try {
        const parsedRows = parseAdvanceRows(file.path);
        const sourceRows = parsedRows.filter(row => row.valid);
        const uniqueRows = [...new Map(sourceRows.map(row => [`${row.year}-${row.consecutive}`, row])).values()];
        const existing = uniqueRows.length ? await prisma.advance.findMany({ where: { OR: uniqueRows.map(row => ({ year: row.year, consecutive: row.consecutive })) }, select: { year: true, consecutive: true } }) : [];
        const existingKeys = new Set(existing.map(row => `${row.year}-${row.consecutive}`));
        const rowsToCreate = uniqueRows.filter(row => !existingKeys.has(`${row.year}-${row.consecutive}`));
        const supplierRows = await prisma.supplier.findMany({ select: { id: true, nit: true, taxId: true } });
        const suppliersByDocument = new Map<string, string>();
        supplierRows.forEach(supplier => {
            if (supplier.nit) suppliersByDocument.set(normalizeDocument(supplier.nit), supplier.id);
            if (supplier.taxId) suppliersByDocument.set(normalizeDocument(supplier.taxId), supplier.id);
        });

        await prisma.$transaction(async tx => {
            for (const row of rowsToCreate) {
                const status = historicalStatus(row.sourceStatus);
                const dueDate = new Date(row.requestDate);
                dueDate.setDate(dueDate.getDate() + 15);
                const advance = await tx.advance.create({
                    data: {
                        consecutive: row.consecutive,
                        year: row.year,
                        requestDate: row.requestDate,
                        beneficiaryType: suppliersByDocument.has(row.beneficiaryDocument) ? 'SUPPLIER' : 'EMPLOYEE',
                        beneficiaryDocument: row.beneficiaryDocument,
                        beneficiaryName: row.beneficiaryName,
                        supplierId: suppliersByDocument.get(row.beneficiaryDocument) || null,
                        costCenter: row.costCenter,
                        purpose: row.purpose,
                        amount: row.amount,
                        status,
                        legalizationDueDate: dueDate,
                        legalizedAt: status === 'LEGALIZED' ? row.requestDate : null,
                        requestedById: req.user!.id
                    }
                });
                await writeAudit(tx, {
                    advanceId: advance.id,
                    action: 'ADVANCE_IMPORTED',
                    toStatus: status,
                    details: `Importado desde fila ${row.sourceRow} del libro histórico`,
                    actorId: req.user!.id,
                    actorEmail: req.user!.email
                });
            }
            const maxByYear = new Map<number, number>();
            uniqueRows.forEach(row => maxByYear.set(row.year, Math.max(maxByYear.get(row.year) || 0, row.consecutive)));
            for (const [year, maxConsecutive] of maxByYear) {
                const current = await tx.advanceSequence.findUnique({ where: { year } });
                const nextConsecutive = maxConsecutive + 1;
                if (!current) await tx.advanceSequence.create({ data: { year, nextConsecutive } });
                else if (current.nextConsecutive < nextConsecutive) await tx.advanceSequence.update({ where: { year }, data: { nextConsecutive } });
            }
        }, { timeout: 60000 });
        return res.json({ success: true, imported: rowsToCreate.length, skippedExisting: uniqueRows.length - rowsToCreate.length, invalidRows: parsedRows.length - sourceRows.length });
    } catch (error: any) {
        logger.error('Error importing advances:', error);
        return res.status(400).json({ error: error.message || 'No se pudieron importar los anticipos' });
    } finally {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
};

export const downloadAdvancePdf = async (req: AuthRequest, res: Response) => {
    if (!hasRole(req.user?.role, ADVANCE_VIEWER_ROLES)) return res.status(403).json({ error: 'No tienes permiso para descargar el formato' });
    try {
        const advance = await getAdvanceOrThrow(req.params.id);
        const document = new PDFDocument({ margin: 48, size: 'LETTER' });
        const date = new Intl.DateTimeFormat('es-CO').format(new Date(advance.requestDate));
        const amount = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(advance.amount));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Solicitud_Anticipo_${advance.year}_${advance.consecutive}.pdf"`);
        document.pipe(res);
        document.rect(48, 46, 510, 58).stroke();
        document.font('Helvetica-Bold').fontSize(15).text('SOLICITUD DE ANTICIPOS', 160, 60, { width: 230, align: 'center' });
        document.font('Helvetica').fontSize(8).text('Museo de Antioquia', 160, 80, { width: 230, align: 'center' });
        document.fontSize(8).text('CÓDIGO: FA_4.1_01\nVERSIÓN: 02', 442, 60, { width: 100, align: 'right' });
        let y = 130;
        const fields = [
            ['Nro. Anticipo', `${advance.consecutive}`], ['Fecha del anticipo', date], ['Estado', advance.status],
            ['Centro de costos', advance.costCenter || '-'], ['Cédula o NIT', advance.beneficiaryDocument],
            ['Funcionario o empresa', advance.beneficiaryName], ['Motivo del anticipo', advance.purpose], ['Valor del anticipo', amount]
        ];
        fields.forEach(([label, value]) => {
            document.font('Helvetica-Bold').fontSize(9).text(label, 55, y, { width: 155 });
            document.font('Helvetica').fontSize(10).text(value, 215, y, { width: 325 });
            document.moveTo(55, y + 19).lineTo(540, y + 19).strokeColor('#D1D5DB').stroke();
            y += 33;
        });
        if (advance.beneficiaryType === 'EMPLOYEE') {
            document.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text('AUTORIZACIÓN PARA DESCUENTO POR NÓMINA', 55, y + 15);
            document.font('Helvetica').fontSize(8).text('El plazo para legalizar este anticipo es de quince (15) días calendario. En caso de no legalización, el beneficiario autoriza el descuento correspondiente conforme a las políticas vigentes.', 55, y + 33, { width: 485, align: 'justify' });
        }
        document.fontSize(8).fillColor('#6B7280').text(`Generado desde MisCompras el ${new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, 55, 715, { width: 485, align: 'center' });
        document.end();
    } catch (error: any) {
        return res.status(404).json({ error: error.message || 'No se pudo generar el formato' });
    }
};
