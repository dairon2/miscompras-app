"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportSuppliers = exports.exportBudgets = exports.exportRequirements = void 0;
const index_1 = require("../index");
const excelService_1 = require("../services/excelService");
const exportRequirements = async (req, res) => {
    try {
        const requirements = await index_1.prisma.requirement.findMany({
            include: {
                project: true,
                area: true,
                createdBy: true
            },
            orderBy: { createdAt: 'desc' }
        });
        const columns = [
            { header: 'NÚMERO DE REQUERIMIENTO', key: 'id', width: 25 },
            { header: 'DETALLES DEL REQUERIMIENTO', key: 'title', width: 40 },
            { header: 'VALOR DE LA COMPRA', key: 'totalAmount', width: 20 },
            { header: 'ESTADO TRÁMITE', key: 'procurementStatus', width: 20 },
            { header: 'PROYECTO', key: 'projectName', width: 30 },
            { header: 'ÁREA', key: 'areaName', width: 20 },
            { header: 'LÍDER', key: 'leaderName', width: 25 },
            { header: 'FECHA DE SOLICITUD', key: 'createdAt', width: 20 },
        ];
        const rows = requirements.map((r) => ({
            id: r.id.substring(0, 8).toUpperCase(),
            title: r.title,
            totalAmount: r.totalAmount ? parseFloat(r.totalAmount.toString()) : 0,
            procurementStatus: r.procurementStatus || 'PENDIENTE',
            projectName: r.project?.name || 'N/A',
            areaName: r.area?.name || 'N/A',
            leaderName: r.createdBy?.name || r.createdBy?.email || 'N/A',
            createdAt: new Date(r.createdAt).toLocaleDateString(),
        }));
        const workbook = await (0, excelService_1.generateExcelWorkbook)({
            title: 'Reporte de Requerimientos',
            subtitle: 'Proceso de Compras',
            columns,
            rows
        });
        const filename = `Reporte_Requerimientos_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        console.error('Error generating requirements report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};
exports.exportRequirements = exportRequirements;
const exportBudgets = async (req, res) => {
    try {
        const budgets = await index_1.prisma.budget.findMany({
            include: {
                project: true,
                area: true,
                manager: true
            },
            orderBy: { createdAt: 'desc' }
        });
        const columns = [
            { header: 'PROYECTO', key: 'projectName', width: 30 },
            { header: 'ÁREA', key: 'areaName', width: 20 },
            { header: 'MONTO ASIGNADO', key: 'amount', width: 20 },
            { header: 'MONTO DISPONIBLE', key: 'available', width: 20 },
            { header: 'EJECUCIÓN (%)', key: 'percentage', width: 15 },
            { header: 'LÍDER RESPONSABLE', key: 'managerName', width: 25 },
        ];
        const rows = budgets.map((b) => {
            const amount = b.amount ? parseFloat(b.amount.toString()) : 0;
            const available = b.available ? parseFloat(b.available.toString()) : 0;
            const percentage = amount > 0 ? ((amount - available) / amount * 100).toFixed(1) : "0.0";
            return {
                projectName: b.project?.name || 'N/A',
                areaName: b.area?.name || 'N/A',
                amount,
                available,
                percentage: `${percentage}%`,
                managerName: b.manager?.name || 'N/A',
            };
        });
        const workbook = await (0, excelService_1.generateExcelWorkbook)({
            title: 'Estado de Presupuestos',
            subtitle: 'Control Financiero',
            columns,
            rows
        });
        const filename = `Reporte_Presupuestos_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        console.error('Error generating budgets report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};
exports.exportBudgets = exportBudgets;
const exportSuppliers = async (req, res) => {
    try {
        const suppliers = await index_1.prisma.supplier.findMany({
            orderBy: { name: 'asc' }
        });
        const columns = [
            { header: 'NOMBRE PROVEEDOR', key: 'name', width: 35 },
            { header: 'NIT / TAX ID', key: 'taxId', width: 20 },
            { header: 'CORREO CONTACTO', key: 'email', width: 30 },
            { header: 'TELÉFONO', key: 'phone', width: 20 },
            { header: 'DIRECCIÓN', key: 'address', width: 30 },
            { header: 'ESTADO', key: 'status', width: 15 },
        ];
        const rows = suppliers.map((s) => ({
            name: s.name,
            taxId: s.taxId || 'N/A',
            email: s.contactEmail || 'N/A',
            phone: s.contactPhone || 'N/A',
            address: s.address || 'N/A',
            status: 'ACTIVO',
        }));
        const workbook = await (0, excelService_1.generateExcelWorkbook)({
            title: 'Catálogo de Proveedores',
            subtitle: 'Base de Datos de Aliados',
            columns,
            rows
        });
        const filename = `Reporte_Proveedores_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        console.error('Error generating suppliers report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};
exports.exportSuppliers = exportSuppliers;
