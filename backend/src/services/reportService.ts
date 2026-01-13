import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db';

export const generateUserRequirementsExcel = async (userId: string): Promise<string> => {
    // 1. Fetch Data
    const requirements = await prisma.requirement.findMany({
        where: { createdById: userId },
        orderBy: { createdAt: 'desc' },
        include: {
            project: { select: { name: true, code: true } },
            budget: { select: { title: true } },
            supplier: { select: { name: true } }
        }
    });

    // 2. Create Workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mis Requerimientos');

    // 3. Define Columns
    sheet.columns = [
        { header: 'Título', key: 'title', width: 30 },
        { header: 'Estado', key: 'status', width: 15 },
        { header: 'Monto Total', key: 'amount', width: 15 },
        { header: 'Proyecto', key: 'project', width: 25 },
        { header: 'Presupuesto', key: 'budget', width: 25 },
        { header: 'Proveedor', key: 'supplier', width: 25 },
        { header: 'Fecha', key: 'date', width: 15 },
        { header: 'Descripción', key: 'desc', width: 40 }
    ];

    // 4. Add Rows
    requirements.forEach(req => {
        sheet.addRow({
            title: req.title,
            status: req.status,
            amount: Number(req.totalAmount || 0),
            project: `${req.project.name} (${req.project.code})`,
            budget: req.budget?.title || 'N/A',
            supplier: req.supplier?.name || 'N/A',
            date: req.createdAt.toISOString().split('T')[0],
            desc: req.description
        });
    });

    // Format Currency Column
    sheet.getColumn('amount').numFmt = '"$"#,##0.00';

    // 5. Save File
    const uploadsDir = path.join(process.cwd(), 'uploads', 'reports');

    // Ensure directory exists
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `reporte_reqs_${userId}_${Date.now()}.xlsx`;
    const filePath = path.join(uploadsDir, fileName);

    await workbook.xlsx.writeFile(filePath);

    // 6. Return Public URL
    // Assuming /uploads is served statically
    const publicUrl = `/uploads/reports/${fileName}`;
    return publicUrl;
};
