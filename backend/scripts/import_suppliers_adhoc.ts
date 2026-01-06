
import { PrismaClient, SupplierType, Criticality } from '@prisma/client';
import ExcelJS from 'exceljs';
import fs from 'fs';

const prisma = new PrismaClient();
const filePath = 'C:\\Users\\Usuario\\Downloads\\Libro4.xlsx';

async function main() {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    console.log("Reading file...");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1); // First sheet

    if (!worksheet) {
        console.error("No worksheet found");
        process.exit(1);
    }

    let successes = 0;
    let errors = 0;

    // Iterate rows starting from 2 (skip header)
    // worksheet.eachRow includeEmpty: false
    // But better to loop manually to control start row
    const rowCount = worksheet.rowCount;
    console.log(`Found ${rowCount} rows (including header)`);

    for (let i = 2; i <= rowCount; i++) {
        const row = worksheet.getRow(i);
        if (!row.hasValues) continue;

        // Extract values (ExcelJS is 1-based, but accessing by cell index or key if columns defined)
        // Since we don't have columns defined, we use getCell(colIndex)
        // 1: Nit, 2: Nombre, 3: Télefono, 4: Nombre contacto, 5: Actividad, 6: Tipo, 7: Ciudad, 8: Dirección, 9: Email, 10: Criticidad

        const nit = row.getCell(1).text?.trim();
        const name = row.getCell(2).text?.trim();
        const phone = row.getCell(3).text?.trim();
        const contactName = row.getCell(4).text?.trim();
        const activity = row.getCell(5).text?.trim();
        const typeRaw = row.getCell(6).text?.trim();
        const city = row.getCell(7).text?.trim();
        const addressRaw = row.getCell(8).text?.trim();
        const contactEmail = row.getCell(9).text?.trim();
        const criticalityRaw = row.getCell(10).text?.trim();

        if (!name) {
            console.warn(`Row ${i}: Missing name, skipping.`);
            errors++;
            continue;
        }

        // Address composition
        const address = city ? `${addressRaw || ''}, ${city}` : addressRaw;

        // Map Enums
        let supplierType: SupplierType = 'SUPPLIER';
        if (typeRaw?.toLowerCase().includes('servicio')) {
            supplierType = 'SERVICE_PROVIDER';
        }

        let criticality: Criticality = 'LOW';
        if (criticalityRaw) {
            const c = criticalityRaw.toLowerCase();
            if (c.includes('media') || c.includes('medium')) criticality = 'MEDIUM';
            if (c.includes('alta') || c.includes('high')) criticality = 'HIGH';
        }

        try {
            // Upsert based on NIT if present
            if (nit) {
                // Check if exists by NIT
                const existing = await prisma.supplier.findUnique({ where: { nit } });
                if (existing) {
                    await prisma.supplier.update({
                        where: { id: existing.id },
                        data: {
                            name,
                            phone,
                            contactName,
                            activity,
                            supplierType,
                            address,
                            contactEmail,
                            criticality,
                            // Ensure taxId is also synced if we treat nit as taxId
                            taxId: nit
                        }
                    });
                    // console.log(`Updated supplier: ${name} (${nit})`);
                } else {
                    // Also check by taxId just in case
                    const existingTax = await prisma.supplier.findUnique({ where: { taxId: nit } });
                    if (existingTax) {
                        await prisma.supplier.update({
                            where: { id: existingTax.id },
                            data: { name, phone, contactName, activity, supplierType, address, contactEmail, criticality, nit }
                        });
                    } else {
                        await prisma.supplier.create({
                            data: {
                                name,
                                nit,
                                taxId: nit,
                                phone,
                                contactName,
                                activity,
                                supplierType,
                                address,
                                contactEmail,
                                criticality
                            }
                        });
                        // console.log(`Created supplier: ${name} (${nit})`);
                    }
                }
            } else {
                // No NIT, just create? Or skip?
                // Probably create, but risk duplicates.
                // Assuming Name is not unique in DB (it isn't), but name might be key.
                // Let's create.
                await prisma.supplier.create({
                    data: {
                        name,
                        phone,
                        contactName,
                        activity,
                        supplierType,
                        address,
                        contactEmail,
                        criticality
                    }
                });
            }
            successes++;
            if (successes % 10 === 0) process.stdout.write('.');
        } catch (error) {
            console.error(`Error processing row ${i} (${name}):`, error);
            errors++;
        }
    }

    console.log(`\nImport completed.`);
    console.log(`Success: ${successes}`);
    console.log(`Errors: ${errors}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
