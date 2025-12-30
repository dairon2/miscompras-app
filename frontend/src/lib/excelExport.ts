import * as XLSX from 'xlsx';

interface ExportColumn {
    header: string;
    key: string;
    width?: number;
}

interface ExportOptions {
    filename: string;
    sheetName: string;
    columns: ExportColumn[];
    data: any[];
}

export const exportToExcel = ({ filename, sheetName, columns, data }: ExportOptions) => {
    try {
        // Crear los datos para la hoja
        const worksheetData = [
            // Encabezados
            columns.map(col => col.header),
            // Datos
            ...data.map(row => columns.map(col => row[col.key] !== undefined ? row[col.key] : ''))
        ];

        // Crear la hoja de cálculo
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

        // Configurar anchos de columna
        const columnWidths = columns.map(col => ({
            wch: col.width || 15
        }));
        worksheet['!cols'] = columnWidths;

        // Crear el libro de trabajo
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        // Generar el archivo binario
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

        // Crear un blob del buffer
        const blob = new Blob([excelBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        // Crear URL del blob y descargar
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.xlsx`;
        link.click();

        // Limpiar
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error en exportToExcel:', error);
        throw error;
    }
};

export const exportRequirements = (requirements: any[]) => {
    const columns: ExportColumn[] = [
        { header: 'NÚMERO DE REQUERIMIENTO', key: 'id', width: 20 },
        { header: 'TITULO REQUERIMIENTO', key: 'title', width: 45 },
        { header: 'VALOR DE LA COMPRA', key: 'value', width: 20 },
        { header: 'NÚMERO DE FACTURA', key: 'invoice', width: 20 },
        { header: 'NÚMERO DE ORDEN DE COMPRA', key: 'oc', width: 25 },
        { header: 'RUBRO', key: 'rubro', width: 35 },
        { header: 'PRESUPUESTO', key: 'budget', width: 30 },
        { header: 'PROYECTO', key: 'project', width: 30 },
        { header: 'PROVEEDOR', key: 'supplier', width: 30 },
        { header: 'ESTADO', key: 'status', width: 15 },
        { header: 'CATEGORÍA', key: 'category', width: 20 },
        { header: 'FECHA DE SOLICITUD', key: 'date', width: 25 }
    ];

    const data = requirements.map(r => ({
        id: r.id?.substring(0, 8).toUpperCase() || '',
        title: r.title || '',
        value: r.actualAmount ? `$${parseFloat(r.actualAmount).toLocaleString('es-CO')}` : r.estimatedAmount ? `$${parseFloat(r.estimatedAmount).toLocaleString('es-CO')}` : '$0',
        invoice: r.invoiceNumber || '',
        oc: r.purchaseOrderNumber || '',
        rubro: r.budget?.category ? `${r.budget.category.code || ''} ${r.budget.category.name || ''}`.trim() : 'Sin rubro',
        budget: r.budget?.title || 'Sin presupuesto',
        project: r.project?.name || 'Sin proyecto',
        supplier: r.supplier?.name || r.manualSupplierName || 'No definido',
        status: r.procurementStatus || 'PENDIENTE',
        category: r.reqCategory?.replace(/_/g, ' ') || 'REQUERIMIENTO',
        date: r.createdAt ? new Date(r.createdAt).toLocaleString('es-CO') : ''
    }));

    exportToExcel({
        filename: `Requerimientos_${new Date().toISOString().split('T')[0]}`,
        sheetName: 'Requerimientos',
        columns,
        data
    });
};

export const exportBudgets = (budgets: any[]) => {
    const columns: ExportColumn[] = [
        { header: 'Proyecto', key: 'projectName', width: 25 },
        { header: 'Área', key: 'areaName', width: 20 },
        { header: 'Monto Asignado', key: 'amount', width: 18 },
        { header: 'Disponible', key: 'available', width: 18 },
        { header: 'Ejecución %', key: 'percentage', width: 12 },
        { header: 'Líder', key: 'managerName', width: 25 }
    ];

    const data = budgets.map(b => {
        const amount = parseFloat(b.amount || 0);
        const available = parseFloat(b.available || 0);
        const percentage = amount > 0 ? ((amount - available) / amount * 100).toFixed(1) : '0';

        return {
            projectName: b.project?.name || 'N/A',
            areaName: b.area?.name || 'N/A',
            amount: `$${amount.toLocaleString('es-CO')}`,
            available: `$${available.toLocaleString('es-CO')}`,
            percentage: `${percentage}%`,
            managerName: b.manager?.name || 'N/A'
        };
    });

    exportToExcel({
        filename: `Reporte_Presupuestos_${new Date().toISOString().split('T')[0]}`,
        sheetName: 'Presupuestos',
        columns,
        data
    });
};

export const exportSuppliers = (suppliers: any[]) => {
    const columns: ExportColumn[] = [
        { header: 'Nombre', key: 'name', width: 30 },
        { header: 'NIT', key: 'taxId', width: 20 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Teléfono', key: 'phone', width: 20 },
        { header: 'Dirección', key: 'address', width: 35 }
    ];

    const data = suppliers.map(s => ({
        name: s.name || '',
        taxId: s.taxId || 'N/A',
        email: s.contactEmail || 'N/A',
        phone: s.contactPhone || 'N/A',
        address: s.address || 'N/A'
    }));

    exportToExcel({
        filename: `Reporte_Proveedores_${new Date().toISOString().split('T')[0]}`,
        sheetName: 'Proveedores',
        columns,
        data
    });
};
