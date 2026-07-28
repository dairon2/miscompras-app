import { PrismaClient, InvoiceStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();
const EXCEL_PATH = 'C:\\Users\\Usuario\\Downloads\\LMaestro2026.xlsm';

function parseAmount(val: any): number {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const str = String(val).replace(/[\$\s]/g, '');
    if (!str) return 0;
    
    let cleaned = str;
    if (cleaned.includes(',') && cleaned.includes('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',') && !cleaned.includes('.')) {
        const parts = cleaned.split(',');
        if (parts[parts.length - 1].length === 2) {
            cleaned = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
        } else {
            cleaned = parts.join('');
        }
    } else if (cleaned.includes('.') && !cleaned.includes(',')) {
        const parts = cleaned.split('.');
        if (parts[parts.length - 1].length === 3) {
            cleaned = parts.join('');
        }
    }
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
}

function parseExcelDate(val: any): Date {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val === 'number' && val > 30000 && val < 60000) {
        // Excel base date 1899-12-30
        const date = new Date((val - (25567 + 2)) * 86400 * 1000);
        if (!isNaN(date.getTime())) return date;
    }
    if (typeof val === 'string') {
        const date = new Date(val);
        if (!isNaN(date.getTime())) return date;
    }
    return new Date();
}

function cleanString(val: any): string | null {
    if (val === undefined || val === null) return null;
    const str = String(val).trim();
    if (!str || str.toLowerCase() === 'none' || str === '#REF!') return null;
    return str;
}

async function runImport() {
    console.log(`Reading Excel file: ${EXCEL_PATH}...`);
    const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: true });
    
    // Find admin user for createdById
    let adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' }
    });
    if (!adminUser) {
        adminUser = await prisma.user.findFirst();
    }
    if (!adminUser) {
        throw new Error('No active user found in database to assign as creator');
    }

    console.log(`Using creator User: ${adminUser.name || adminUser.email} (${adminUser.id})`);

    // 1. Process Sheet 1 ("Base") suppliers if available
    const sheet1Name = workbook.SheetNames.find(s => s.trim().toLowerCase() === 'base') || workbook.SheetNames[0];
    const sheet1 = workbook.Sheets[sheet1Name];
    const baseRows: any[] = XLSX.utils.sheet_to_json(sheet1, { header: 1 });

    console.log(`Loaded Sheet "${sheet1Name}" with ${baseRows.length} rows.`);

    const supplierMap = new Map<string, string>(); // Key: nit/taxId, Value: supplier.id

    // Pre-load existing suppliers from database
    const existingSuppliers = await prisma.supplier.findMany();
    for (const sup of existingSuppliers) {
        if (sup.nit) supplierMap.set(sup.nit.trim().toLowerCase(), sup.id);
        if (sup.taxId) supplierMap.set(sup.taxId.trim().toLowerCase(), sup.id);
        if (sup.name) supplierMap.set(sup.name.trim().toLowerCase(), sup.id);
    }
    console.log(`Pre-loaded ${existingSuppliers.length} existing suppliers from DB.`);

    let createdSuppliersCount = 0;

    // Process Base sheet suppliers
    for (let i = 1; i < baseRows.length; i++) {
        const row = baseRows[i];
        if (!row || row.length === 0) continue;
        const nit = cleanString(row[0]);
        const name = cleanString(row[1]);
        if (!nit && !name) continue;

        const lookupKey = (nit || name!).toLowerCase();
        if (!supplierMap.has(lookupKey)) {
            try {
                const newSupplier = await prisma.supplier.create({
                    data: {
                        nit: nit || undefined,
                        taxId: nit || undefined,
                        name: name || nit || 'PROVEEDOR DESCONOCIDO'
                    }
                });
                createdSuppliersCount++;
                if (nit) supplierMap.set(nit.toLowerCase(), newSupplier.id);
                if (name) supplierMap.set(name.toLowerCase(), newSupplier.id);
            } catch (err: any) {
                // Ignore unique constraint collision
            }
        }
    }
    console.log(`Processed Base suppliers. Created ${createdSuppliersCount} new suppliers.`);

    // 2. Process Sheet 2 ("CONTROL FACTURAS ")
    const sheet2Name = workbook.SheetNames.find(s => s.trim().toUpperCase().includes('CONTROL FACTURAS')) || workbook.SheetNames[1];
    const sheet2 = workbook.Sheets[sheet2Name];
    const invoiceRowsRaw: any[] = XLSX.utils.sheet_to_json(sheet2, { header: 1 });

    console.log(`Loaded Sheet "${sheet2Name}" with ${invoiceRowsRaw.length} rows.`);

    let createdInvoicesCount = 0;
    let updatedInvoicesCount = 0;
    let skippedRowsCount = 0;

    for (let i = 1; i < invoiceRowsRaw.length; i++) {
        const row = invoiceRowsRaw[i];
        if (!row || row.length === 0) continue;

        const rawItem = cleanString(row[0]);
        const nit = cleanString(row[1]);
        const name = cleanString(row[2]);
        const invoiceNumber = cleanString(row[3]);
        const amount = parseAmount(row[4]);
        const issueDate = parseExcelDate(row[5]);
        const passToArea = cleanString(row[6]);
        const observations = cleanString(row[7]);
        const purchaseOrderNumber = cleanString(row[8]);
        const costCenterOrProject = cleanString(row[9]);
        const purchaseObservations = cleanString(row[10]);
        const commercialValidation = cleanString(row[11]);
        const legalValidation = cleanString(row[12]);
        const legalObservations = cleanString(row[13]);
        const causationNumber = cleanString(row[14]);
        const causationObservations = cleanString(row[15]);

        if (!nit && !name && !invoiceNumber && amount === 0) {
            skippedRowsCount++;
            continue;
        }

        // Match or Create Supplier
        let supplierId: string | undefined;
        if (nit && supplierMap.has(nit.toLowerCase())) {
            supplierId = supplierMap.get(nit.toLowerCase());
        } else if (name && supplierMap.has(name.toLowerCase())) {
            supplierId = supplierMap.get(name.toLowerCase());
        }

        if (!supplierId) {
            try {
                const newSupplier = await prisma.supplier.create({
                    data: {
                        nit: nit || undefined,
                        taxId: nit || undefined,
                        name: name || nit || 'PROVEEDOR VARIOS'
                    }
                });
                supplierId = newSupplier.id;
                createdSuppliersCount++;
                if (nit) supplierMap.set(nit.toLowerCase(), supplierId);
                if (name) supplierMap.set(name.toLowerCase(), supplierId);
            } catch (err) {
                const fallbackSup = await prisma.supplier.findFirst();
                supplierId = fallbackSup?.id;
            }
        }

        if (!supplierId) continue;

        const finalInvoiceNumber = invoiceNumber || `FAC-${rawItem || i}`;
        const itemNumber = rawItem && !isNaN(parseInt(rawItem)) ? parseInt(rawItem) : i;

        // Determine InvoiceStatus
        let status: InvoiceStatus = 'RECEIVED';
        if (causationObservations?.toLowerCase() === 'ok' || causationNumber) {
            status = 'PAID';
        } else if (commercialValidation?.toUpperCase() === 'APROBADO' || legalValidation?.toUpperCase() === 'APROBADO') {
            status = 'APPROVED';
        } else if (purchaseOrderNumber) {
            status = 'VERIFIED';
        }

        // Check if invoice exists
        const existingInvoice = await prisma.invoice.findFirst({
            where: {
                OR: [
                    { supplierId, invoiceNumber: finalInvoiceNumber },
                    { itemNumber }
                ]
            }
        });

        if (existingInvoice) {
            await prisma.invoice.update({
                where: { id: existingInvoice.id },
                data: {
                    passToArea: passToArea || existingInvoice.passToArea,
                    observations: observations || existingInvoice.observations,
                    purchaseOrderNumber: purchaseOrderNumber || existingInvoice.purchaseOrderNumber,
                    costCenterOrProject: costCenterOrProject || existingInvoice.costCenterOrProject,
                    purchaseObservations: purchaseObservations || existingInvoice.purchaseObservations,
                    commercialValidation: commercialValidation || existingInvoice.commercialValidation,
                    legalValidation: legalValidation || existingInvoice.legalValidation,
                    legalObservations: legalObservations || existingInvoice.legalObservations,
                    causationNumber: causationNumber || existingInvoice.causationNumber,
                    causationObservations: causationObservations || existingInvoice.causationObservations
                }
            });
            updatedInvoicesCount++;
        } else {
            await prisma.invoice.create({
                data: {
                    itemNumber,
                    invoiceNumber: finalInvoiceNumber,
                    supplierId,
                    amount,
                    issueDate,
                    status,
                    createdById: adminUser.id,
                    passToArea,
                    observations,
                    purchaseOrderNumber,
                    costCenterOrProject,
                    purchaseObservations,
                    commercialValidation,
                    legalValidation,
                    legalObservations,
                    causationNumber,
                    causationObservations
                }
            });
            createdInvoicesCount++;
        }

        if ((createdInvoicesCount + updatedInvoicesCount) % 250 === 0) {
            console.log(`Processed ${createdInvoicesCount + updatedInvoicesCount} invoices...`);
        }
    }

    console.log('\n====================================');
    console.log('IMPORT COMPLETE SUCCESSFULLY!');
    console.log(`- Created Suppliers: ${createdSuppliersCount}`);
    console.log(`- Created Invoices: ${createdInvoicesCount}`);
    console.log(`- Updated Invoices: ${updatedInvoicesCount}`);
    console.log(`- Skipped Empty Rows: ${skippedRowsCount}`);
    console.log('====================================');
}

runImport()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
