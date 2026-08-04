import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db';
import logger from './logger';

// Auto-siembra directa en Cloud al arrancar el servidor (0 timeouts de Gateway / 0 fallos de Payload Proxy)
export const runAutoSeedInCloud = async () => {
    try {
        const seedFilePath = path.join(__dirname, '../seeds/LMaestro2026_Limpio.xlsx');
        if (!fs.existsSync(seedFilePath)) {
            logger.info('Archivo de seed LMaestro2026 no encontrado, saltando auto-sincronización en arranque.');
            return;
        }

        logger.info('⚡ INICIANDO AUTO-SINCRONIZACIÓN MAESTRA (Cloud Seed) desde archivo local...');

        const workbook = XLSX.readFile(seedFilePath, { cellDates: true });

        // Encontrar al admin genérico para adjudicarle la auditoría
        const fallbackAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } }) || await prisma.user.findFirst();
        const creatorId = fallbackAdmin?.id;

        const cleanStr = (val: any): string | null => {
            if (val === undefined || val === null) return null;
            const str = String(val).trim();
            return (!str || str.toLowerCase() === 'none' || str === '#ref!' || str === '#valor!' || str === '#div/0!') ? null : str;
        };

        const parseAmt = (val: any): number => {
            if (val === undefined || val === null || val === '') return 0;
            if (typeof val === 'number') return isNaN(val) ? 0 : val;
            let str = String(val).replace(/[\$\s]/g, '').trim();
            if (!str || str.includes('#')) return 0;
            if (str.includes(',') && str.includes('.')) str = str.replace(/\./g, '').replace(',', '.');
            else if (str.includes(',') && !str.includes('.')) str = str.replace(',', '.');
            const parsed = parseFloat(str);
            return isNaN(parsed) ? 0 : parsed;
        };

        const parseDt = (val: any): Date => {
            const def = new Date(2026, 0, 1);
            if (!val) return def;
            if (val instanceof Date && !isNaN(val.getTime())) {
                if (val.getFullYear() < 2015 || val.getFullYear() > 2035) return def;
                return val;
            }
            if (typeof val === 'number' && val > 30000 && val < 70000) {
                const d = new Date((val - (25567 + 2)) * 86400 * 1000);
                if (!isNaN(d.getTime())) return d;
            }
            if (typeof val === 'string') {
                const d = new Date(val);
                if (!isNaN(d.getTime())) return d;
            }
            return def;
        };

        // 1. CARGA RÁPIDA DE PROVEEDORES (Hoja "Base")
        const sheet1 = workbook.Sheets['Base'] || workbook.Sheets[workbook.SheetNames[0]];
        const baseRows: any[] = XLSX.utils.sheet_to_json(sheet1, { header: 1 });

        const supplierMap = new Map<string, string>(); // NIT/Nombre minúscula -> ID
        const existingSuppliers = await prisma.supplier.findMany({ select: { id: true, nit: true, taxId: true, name: true } });
        for (const sup of existingSuppliers) {
            if (sup.nit) supplierMap.set(sup.nit.trim().toLowerCase(), sup.id);
            if (sup.taxId) supplierMap.set(sup.taxId.trim().toLowerCase(), sup.id);
            if (sup.name) supplierMap.set(sup.name.trim().toLowerCase(), sup.id);
        }

        const suppliersToCreate: any[] = [];
        const seenNewSuppliers = new Set<string>();

        for (let i = 1; i < baseRows.length; i++) {
            const row = baseRows[i];
            if (!row || row.length === 0) continue;
            const nit = cleanStr(row[0]);
            const name = cleanStr(row[1]);
            if (!nit && !name) continue;

            const key = (nit || name!).toLowerCase();
            if (!supplierMap.has(key) && !seenNewSuppliers.has(key)) {
                seenNewSuppliers.add(key);
                suppliersToCreate.push({
                    nit: nit || undefined,
                    taxId: nit || undefined,
                    name: (name || nit || 'PROVEEDOR LMAESTRO').toUpperCase(),
                    criticality: 'LOW',
                    supplierType: 'SUPPLIER'
                });
            }
        }

        if (suppliersToCreate.length > 0) {
            await prisma.supplier.createMany({ data: suppliersToCreate, skipDuplicates: true });
            const allSuppliers = await prisma.supplier.findMany({ select: { id: true, nit: true, taxId: true, name: true } });
            for (const sup of allSuppliers) {
                if (sup.nit) supplierMap.set(sup.nit.trim().toLowerCase(), sup.id);
                if (sup.taxId) supplierMap.set(sup.taxId.trim().toLowerCase(), sup.id);
                if (sup.name) supplierMap.set(sup.name.trim().toLowerCase(), sup.id);
            }
        }

        // 2. CARGA ULTRARRÁPIDA DE FACTURAS IN-MEMORY (Hoja "CONTROL FACTURAS")
        const sheet2Name = workbook.SheetNames.find(s => s.trim().toUpperCase().includes('CONTROL FACTURAS')) || workbook.SheetNames[1];
        if (!sheet2Name) return;
        const sheet2 = workbook.Sheets[sheet2Name];
        const invoiceRows: any[] = XLSX.utils.sheet_to_json(sheet2, { header: 1 });

        const existingInvoices = await prisma.invoice.findMany({ select: { id: true, invoiceNumber: true, supplierId: true, itemNumber: true } });
        const existingInvMap = new Map<string, string>(); // key -> id
        for (const inv of existingInvoices) {
            if (inv.supplierId && inv.invoiceNumber) existingInvMap.set(`${inv.supplierId}-${inv.invoiceNumber.toLowerCase()}`, inv.id);
            if (inv.itemNumber) existingInvMap.set(`item-${inv.itemNumber}`, inv.id);
        }

        const invoicesToCreate: any[] = [];
        const seenInvoicesInFile = new Set<string>();

        let defaultSupplierId = supplierMap.get('varios') || supplierMap.get('sinf-000');
        if (!defaultSupplierId) {
            let defSup = await prisma.supplier.findFirst({ where: { OR: [{ nit: 'SINF-000' }, { name: 'PROVEEDORES VARIOS LMAESTRO' }] } });
            if (!defSup) {
                defSup = await prisma.supplier.create({
                    data: { nit: 'SINF-000', name: 'PROVEEDORES VARIOS LMAESTRO', criticality: 'LOW', supplierType: 'SUPPLIER' }
                });
            }
            defaultSupplierId = defSup.id;
            supplierMap.set('sinf-000', defaultSupplierId);
        }

        for (let i = 1; i < invoiceRows.length; i++) {
            const row = invoiceRows[i];
            if (!row || row.length === 0) continue;

            const rawItem = cleanStr(row[0]);
            const nit = cleanStr(row[1]);
            const name = cleanStr(row[2]);
            const invoiceNumber = cleanStr(row[3]);
            const amount = parseAmt(row[4]);

            if (!nit && !name && !invoiceNumber && amount === 0) continue;
            if (name && (name.toUpperCase().includes('TOTALES') || name.toUpperCase().includes('GRAN TOTAL'))) continue;

            let supplierId: string | undefined;
            if (nit && supplierMap.has(nit.toLowerCase())) supplierId = supplierMap.get(nit.toLowerCase());
            else if (name && supplierMap.has(name.toLowerCase())) supplierId = supplierMap.get(name.toLowerCase());
            if (!supplierId) supplierId = defaultSupplierId;

            const itemNum = rawItem && !isNaN(parseInt(rawItem)) ? parseInt(rawItem) : i;
            let finalNumber = invoiceNumber || `FAC-${itemNum}-${i}`;

            const fileKey = `${supplierId}-${finalNumber.toLowerCase()}`;
            if (seenInvoicesInFile.has(fileKey)) finalNumber = `${finalNumber}-R${i}`;
            seenInvoicesInFile.add(`${supplierId}-${finalNumber.toLowerCase()}`);

            const issueDate = parseDt(row[5]);
            let status: any = 'RECEIVED';
            const cauObs = cleanStr(row[15]);
            const cauNum = cleanStr(row[14]);
            if (cauObs?.toLowerCase() === 'ok' || cauNum) status = 'PAID';
            else if (cleanStr(row[11])?.toUpperCase() === 'APROBADO' || cleanStr(row[12])?.toUpperCase() === 'APROBADO') status = 'APPROVED';
            else if (cleanStr(row[8])) status = 'VERIFIED';

            const payload = {
                itemNumber: itemNum,
                invoiceNumber: finalNumber,
                supplierId,
                amount,
                issueDate,
                status,
                passToArea: cleanStr(row[6]),
                observations: cleanStr(row[7]),
                purchaseOrderNumber: cleanStr(row[8]),
                costCenterOrProject: cleanStr(row[9]),
                purchaseObservations: cleanStr(row[10]),
                commercialValidation: cleanStr(row[11]),
                legalValidation: cleanStr(row[12]),
                legalObservations: cleanStr(row[13]),
                causationNumber: cauNum,
                causationObservations: cauObs,
                budgetId: null, requirementId: null, commercialAreaId: null,
                createdById: creatorId
            };

            const existingId = existingInvMap.get(`${supplierId}-${finalNumber.toLowerCase()}`) || existingInvMap.get(`item-${itemNum}`);
            if (!existingId) invoicesToCreate.push(payload);
        }

        if (invoicesToCreate.length > 0) {
            const CHUNK_SIZE = 500;
            for (let c = 0; c < invoicesToCreate.length; c += CHUNK_SIZE) {
                const chunk = invoicesToCreate.slice(c, c + CHUNK_SIZE);
                await prisma.invoice.createMany({ data: chunk, skipDuplicates: true });
            }
            logger.info(`✨ ¡Auto-Seed finalizado en Azure con 0 timeouts! Se subieron ${invoicesToCreate.length} facturas resguardando relaciones.`);
        } else {
            logger.info(`✅ Auto-Seed evaluado, no se detectaron facturas nuevas por cargar.`);
        }

    } catch (error) {
        logger.error('❌ Error fatal al correr el Auto-Seed de Cloud:', error);
    }
};
