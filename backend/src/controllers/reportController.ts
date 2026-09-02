import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';
import { generateExcelWorkbook } from '../services/excelService';
import { buildSupplierExportWhere } from '../utils/supplierExport';

export const exportRequirements = async (req: AuthRequest, res: Response) => {
    try {
        const userRole = req.user?.role || '';
        const userId = req.user?.id;
        const fullAccessRoles = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'AUDITOR', 'DEVELOPER'];

        const where: any = {};
        if (!fullAccessRoles.includes(userRole)) {
            // Restricted role: only their own requirements
            where.createdById = userId;
        }

        const requirements = await prisma.requirement.findMany({
            where,
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

        const rows = requirements.map((r: any) => ({
            id: r.groupId ? r.groupId.toString() : r.id.substring(0, 8).toUpperCase(),
            title: r.title,
            totalAmount: r.totalAmount ? parseFloat(r.totalAmount.toString()) : 0,
            procurementStatus: r.procurementStatus || 'PENDIENTE',
            projectName: r.project?.name || 'N/A',
            areaName: r.area?.name || 'N/A',
            leaderName: r.createdBy?.name || r.createdBy?.email || 'N/A',
            createdAt: new Date(r.createdAt).toLocaleDateString(),
        }));

        const workbook = await generateExcelWorkbook({
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
    } catch (error) {
        console.error('Error generating requirements report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

export const exportBudgets = async (req: AuthRequest, res: Response) => {
    try {
        const userRole = req.user?.role || '';
        const userId = req.user?.id;
        const fullAccessRoles = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'AUDITOR', 'DEVELOPER'];

        const where: any = {};
        if (!fullAccessRoles.includes(userRole)) {
            // Restricted role: only budgets they manage
            where.managerId = userId;
        }

        const budgets = await prisma.budget.findMany({
            where,
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

        const rows = budgets.map((b: any) => {
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

        const workbook = await generateExcelWorkbook({
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
    } catch (error) {
        console.error('Error generating budgets report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

export const exportSuppliers = async (req: AuthRequest, res: Response) => {
    try {
        const userRole = req.user?.role || '';
        const userId = req.user?.id;
        const where = buildSupplierExportWhere(userRole, userId, req.query);

        const suppliers = await prisma.supplier.findMany({
            where,
            orderBy: { name: 'asc' },
            select: {
                name: true,
                taxId: true,
                nit: true,
                contactName: true,
                contactEmail: true,
                contactPhone: true,
                email: true,
                phone: true,
                address: true,
                activity: true,
                supplierType: true,
                criticality: true,
                management: true,
                createdAt: true
            }
        });

        const columns = [
            { header: 'NOMBRE PROVEEDOR', key: 'name', width: 35 },
            { header: 'NIT / TAX ID', key: 'taxId', width: 20 },
            { header: 'CONTACTO', key: 'contactName', width: 25 },
            { header: 'CORREO CONTACTO', key: 'email', width: 30 },
            { header: 'TELÉFONO', key: 'phone', width: 20 },
            { header: 'DIRECCIÓN', key: 'address', width: 30 },
            { header: 'ACTIVIDAD', key: 'activity', width: 35 },
            { header: 'TIPO', key: 'supplierType', width: 22 },
            { header: 'CRITICIDAD', key: 'criticality', width: 15 },
            { header: 'GESTIÓN RESPONSABLE', key: 'management', width: 28 },
            { header: 'FECHA DE CREACIÓN', key: 'createdAt', width: 25 },
            { header: 'ESTADO', key: 'status', width: 15 },
        ];

        const rows = suppliers.map((s: any) => ({
            name: s.name,
            taxId: s.taxId || s.nit || 'N/A',
            contactName: s.contactName || 'N/A',
            email: s.email || s.contactEmail || 'N/A',
            phone: s.phone || s.contactPhone || 'N/A',
            address: s.address || 'N/A',
            activity: s.activity || 'N/A',
            supplierType: s.supplierType === 'SERVICE_PROVIDER' ? 'Prestador de servicio' : 'Proveedor',
            criticality: s.criticality === 'HIGH' ? 'Alta' : s.criticality === 'MEDIUM' ? 'Media' : 'Baja',
            management: s.management === 'COMMERCIAL'
                ? 'Gestión Comercial'
                : s.management === 'ADMINISTRATIVE_PURCHASING'
                    ? 'Compras Administrativas'
                    : s.management === 'PAYROLL'
                        ? 'Nómina'
                        : s.management === 'SHARED'
                            ? 'Gestión compartida'
                            : 'Sin clasificar',
            createdAt: s.createdAt
                ? new Date(s.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
                : 'N/A',
            status: 'ACTIVO',
        }));

        const workbook = await generateExcelWorkbook({
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
    } catch (error) {
        console.error('Error generating suppliers report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};
