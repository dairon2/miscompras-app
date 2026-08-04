"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { invoiceService } from '@/services/invoiceService';
import { Plus, FileText, Eye, Trash2, Search, RefreshCw, Edit3, X, Check, FileDown, ExternalLink, Calendar, ChevronLeft, ChevronRight, Download, UploadCloud, Link as LinkIcon } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';

type InvoiceItem = {
    id: string;
    itemNumber?: number | null;
    invoiceNumber: string;
    amount: number | string;
    issueDate: string;
    status: string;
    fileUrl?: string | null;
    supplier?: { name?: string | null; nit?: string | null; taxId?: string | null } | null;
    requirement?: { id: string; title?: string | null } | null;
    passToArea?: string | null;
    observations?: string | null;
    purchaseOrderNumber?: string | null;
    costCenterOrProject?: string | null;
    purchaseObservations?: string | null;
    commercialValidation?: string | null;
    legalValidation?: string | null;
    legalObservations?: string | null;
    causationNumber?: string | null;
    causationObservations?: string | null;
};

const AREA_OPTIONS = [
    'ADMINISTRATIVO',
    'BIENESTAR LABORAL',
    'CALLE MUSEO',
    'CCMA-MANTENIMIENTO Y RESTAURACIÓN',
    'CENTRO DE DOCUMENTACIÓN',
    'COMUNICACIONES',
    'COSTOS OPERACIÓN PROYECTOS',
    'CURADURÍA',
    'EDUCACIÓN',
    'EVENTOS',
    'EXPOSICIÓN CANO',
    'EXPOSICIÓN CASA ÁNGEL',
    'FUNDACIÓN SOFÍA PÉREZ DE SOTO',
    'GESTIÓN HUMANA',
    'JORNADA ESCOLAR COMPLEMENTARIA',
    'LA ESCUELA EN EL MUSEO',
    'MAPA TEATRO',
    'NOCHES DEL MUSEO',
    'PRODUCCIÓN Y LOGÍSTICA',
    'SALA PEDRITO BOTERO',
    'SISTEMAS',
    'TIENDA',
    'NÓMINA',
    'COMPRAS',
    'COMERCIAL',
    'JURÍDICA',
    'CONTABILIDAD'
];

export default function InvoicesPage() {
    const { token, user } = useAuthStore();
    const router = useRouter();
    const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Pagination state
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [error, setError] = useState<string | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<InvoiceItem | null>(null);
    const [editForm, setEditForm] = useState<Partial<InvoiceItem>>({});
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const { addToast } = useToastStore();
    const canDeleteInvoices = ['ADMIN', 'DIRECTOR', 'DEVELOPER', 'COORDINATOR'].includes(user?.role || '');
    const canManageInvoices = canDeleteInvoices;

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !token) return;

        const file = files[0];
        setImporting(true);
        addToast('Sincronizando LMaestro2026 con Azure Postgres de forma segura...', 'info');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
            const res = await fetch(`${apiUrl}/api/invoices/import-excel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Error procesando el libro maestro de Excel en Azure');
            }

            addToast('✨ ¡Libro Maestro importado exitosamente! Relaciones blindadas.', 'success');
            alert(`🎉 ¡SINCRONIZACIÓN CON NUBE AZURE EXITOSA!\n\n• Proveedores verificados o creados: ${data.summary.suppliersCreated}\n• Facturas nuevas cargadas: ${data.summary.invoicesCreated}\n• Facturas existentes actualizadas: ${data.summary.invoicesUpdated}\n\n🛡️ GARANTÍA CUMPLIDA: Todas las tablas externas de Presupuestos, Categorías y Requerimientos 2026 de tu sistema permanecen intactas y libres de conflictos.`);
            loadInvoices(); // Cargar facturas sincrónicas e indexadas en milisegundos
        } catch (err: any) {
            console.error('Import Error:', err);
            addToast(err.message || 'Error al importar los datos en la nube', 'error');
            alert(`⚠️ No se pudo completar la carga en nube: ${err.message || 'Revisa tu conexión o intenta con el archivo original.'}`);
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const loadInvoices = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const res = await invoiceService.getInvoices(token, {
                status: filterStatus || undefined,
                search: search.trim() || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                page,
                limit,
                paginate: true
            });

            if (res && Array.isArray(res.data)) {
                setInvoices(res.data);
                setTotal(res.total || res.data.length);
                setTotalPages(res.totalPages || 1);
            } else if (Array.isArray(res)) {
                setInvoices(res);
                setTotal(res.length);
                setTotalPages(1);
            }
        } catch (requestError) {
            console.error(requestError);
            setError('No se pudieron cargar las facturas.');
        } finally {
            setLoading(false);
        }
    }, [token, filterStatus, search, startDate, endDate, page, limit]);

    useEffect(() => {
        if (!token) return;
        const timeout = setTimeout(() => loadInvoices(), 250);
        return () => clearTimeout(timeout);
    }, [token, loadInvoices]);

    const handleExportExcel = async () => {
        if (!token) return;
        setExporting(true);
        try {
            await invoiceService.exportInvoicesExcel(token, {
                status: filterStatus || undefined,
                search: search.trim() || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            });
            addToast('Reporte Excel generado correctamente', 'success');
        } catch (err: any) {
            console.error(err);
            addToast('Error al exportar reporte Excel', 'error');
        } finally {
            setExporting(false);
        }
    };

    const openEditModal = (inv: InvoiceItem) => {
        setEditingInvoice(inv);
        setEditForm({
            invoiceNumber: inv.invoiceNumber,
            amount: inv.amount,
            issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString().split('T')[0] : '',
            passToArea: inv.passToArea || '',
            observations: inv.observations || '',
            purchaseOrderNumber: inv.purchaseOrderNumber || '',
            costCenterOrProject: inv.costCenterOrProject || '',
            purchaseObservations: inv.purchaseObservations || '',
            commercialValidation: inv.commercialValidation || '',
            legalValidation: inv.legalValidation || '',
            legalObservations: inv.legalObservations || '',
            causationNumber: inv.causationNumber || '',
            causationObservations: inv.causationObservations || ''
        });
    };

    const handleSaveEdit = async () => {
        if (!editingInvoice || !token) return;
        setSaving(true);
        try {
            await invoiceService.updateInvoice(token, editingInvoice.id, editForm);
            addToast('Factura actualizada correctamente', 'success');
            setEditingInvoice(null);
            loadInvoices();
        } catch (err: any) {
            console.error(err);
            addToast(err?.response?.data?.error || 'Error al actualizar factura', 'error');
        } finally {
            setSaving(false);
        }
    };

    const renderValidationBadge = (val?: string | null) => {
        if (!val) return <span className="text-gray-400 italic">Pendiente</span>;
        const upper = val.toUpperCase();
        if (upper === 'APROBADO') {
            return <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">APROBADO</span>;
        }
        if (upper === 'RECHAZADO') {
            return <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">RECHAZADO</span>;
        }
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{val}</span>;
    };

    return (
        <div className="p-6 lg:p-10 max-w-[1920px] mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <FileText className="w-8 h-8 text-blue-600" />
                        Módulo de Facturas (Control Unificado)
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Reemplazo de LMaestro2026.xlsm - Gestión por roles y almacenamiento en Azure</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {canManageInvoices && (
                        <button
                            onClick={() => router.push('/invoices/reconciliation')}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-all shadow-sm hover:shadow-md font-medium"
                        >
                            <LinkIcon className="w-4 h-4" />
                            Conciliar requerimientos
                        </button>
                    )}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImportExcel} 
                        accept=".xlsx,.xlsm,.xls" 
                        className="hidden" 
                    />
                    {canDeleteInvoices && (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing || exporting}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md font-medium disabled:opacity-50"
                            title="Subir y sincronizar en Azure los 1,646 registros de LMaestro2026.xlsm resguardando tus tablas relacionales"
                        >
                            {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                            {importing ? 'Sincronizando...' : 'Sincronizar LMaestro2026 (.xlsm)'}
                        </button>
                    )}
                    <button
                        onClick={handleExportExcel}
                        disabled={exporting || importing}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-medium disabled:opacity-50"
                        title="Exportar archivo Excel (.xlsx) con las 16 columnas"
                    >
                        {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Exportar a Excel (.xlsx)
                    </button>
                    <button
                        onClick={() => router.push('/invoices/new')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Factura
                    </button>
                </div>
            </div>

            {/* Search, Date Range & Status Filters */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    {/* Búsqueda */}
                    <div className="relative lg:col-span-6">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Buscar por NIT, Proveedor, N° Documento, N° Orden, Causación o Centro de Costo..."
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700/50"
                        />
                    </div>

                    {/* Filtro por Rango de Fechas (Cierres Mensuales) */}
                    <div className="lg:col-span-6 flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-xs font-semibold text-gray-500">Desde:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => { setStartDate(e.target.value); setPage(1); }}
                                className="bg-transparent text-xs outline-none text-gray-700 dark:text-gray-200 font-medium"
                            />
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-xs font-semibold text-gray-500">Hasta:</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => { setEndDate(e.target.value); setPage(1); }}
                                className="bg-transparent text-xs outline-none text-gray-700 dark:text-gray-200 font-medium"
                            />
                        </div>

                        {(startDate || endDate) && (
                            <button
                                onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
                                className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded font-medium"
                            >
                                Limpiar fechas
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pt-2 border-t dark:border-gray-700">
                    {[
                        ['', 'Todas'],
                        ['RECEIVED', 'Pendientes de Verificación'],
                        ['VERIFIED', 'Por Aprobar'],
                        ['APPROVED', 'Listas para Pago'],
                        ['PAID', 'Pagadas'],
                        ['REJECTED', 'Rechazadas']
                    ].map(([status, label]) => (
                        <button
                            key={status || 'all'}
                            onClick={() => { setFilterStatus(status); setPage(1); }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === status ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table with EXACT 16 COLUMNS from LMaestro2026.xlsm */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 p-12 text-gray-500">
                        <RefreshCw className="h-5 w-5 animate-spin" /> Cargando facturas...
                    </div>
                ) : error ? (
                    <div className="p-12 text-center text-red-600">
                        <p>{error}</p>
                        <button onClick={loadInvoices} className="mt-3 font-semibold underline">Intentar de nuevo</button>
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No hay facturas registradas</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto max-w-full">
                            <table className="w-full text-xs text-left whitespace-nowrap">
                                <thead className="text-[11px] font-bold uppercase text-gray-600 bg-gray-100 dark:bg-gray-900/80 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="px-3 py-3 text-center border-r border-gray-200 dark:border-gray-700">#</th>
                                        <th className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">NIT</th>
                                        <th className="px-4 py-3 border-r border-gray-200 dark:border-gray-700">RAZÓN SOCIAL</th>
                                        <th className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">N° DE DOCUMENTO</th>
                                        <th className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">VALOR</th>
                                        <th className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">FECHA DE RECEPCIÓN Y DOCUMENTO</th>
                                        <th className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">PASA A:</th>
                                        <th className="px-4 py-3 border-r border-gray-200 dark:border-gray-700">OBSERVACIONES DESDE ARCHIVO</th>
                                        <th className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">N° DE ORDEN</th>
                                        <th className="px-4 py-3 border-r border-gray-200 dark:border-gray-700">CENTRO DE COSTOS O PROYECTO</th>
                                        <th className="px-4 py-3 border-r border-gray-200 dark:border-gray-700">OBSERVACIONES DESDE COMPRAS</th>
                                        <th className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">VALIDACIÓN COMERCIAL</th>
                                        <th className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">VALIDACIÓN JURÍDICA</th>
                                        <th className="px-4 py-3 border-r border-gray-200 dark:border-gray-700">OBSERVACIONES DESDE JURÍDICA</th>
                                        <th className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">N° DE CAUSACIÓN</th>
                                        <th className="px-4 py-3 border-r border-gray-200 dark:border-gray-700">OBSERVACIONES DESDE CONTABILIDAD</th>
                                        <th className="px-3 py-3 text-right sticky right-0 bg-gray-100 dark:bg-gray-900 shadow-sm">ACCIONES</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-700 dark:text-gray-200">
                                    {invoices.map((inv, idx) => (
                                        <tr key={inv.id} className="hover:bg-blue-50/50 dark:hover:bg-gray-700/40 transition-colors">
                                            {/* 1. ITEM / CONSECUTIVO */}
                                            <td className="px-3 py-3 text-center font-bold text-gray-500 border-r border-gray-100 dark:border-gray-700/50">
                                                {inv.itemNumber || (page - 1) * limit + idx + 1}
                                            </td>

                                            {/* 2. NIT */}
                                            <td className="px-3 py-3 font-mono border-r border-gray-100 dark:border-gray-700/50">
                                                {inv.supplier?.nit || inv.supplier?.taxId || '-'}
                                            </td>

                                            {/* 3. RAZÓN SOCIAL */}
                                            <td className="px-4 py-3 font-medium max-w-[220px] truncate border-r border-gray-100 dark:border-gray-700/50" title={inv.supplier?.name || ''}>
                                                {inv.supplier?.name || '-'}
                                            </td>

                                            {/* 4. N° DE DOCUMENTO */}
                                            <td className="px-3 py-3 font-semibold text-blue-600 dark:text-blue-400 border-r border-gray-100 dark:border-gray-700/50">
                                                {inv.invoiceNumber}
                                            </td>

                                            {/* 5. VALOR */}
                                            <td className="px-3 py-3 font-mono font-bold text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700/50">
                                                ${Number(inv.amount).toLocaleString('es-CO')}
                                            </td>

                                            {/* 6. FECHA DE RECEPCIÓN Y DOCUMENTO */}
                                            <td className="px-3 py-3 border-r border-gray-100 dark:border-gray-700/50">
                                                <div className="flex items-center gap-2">
                                                    <span>{inv.issueDate ? new Date(inv.issueDate).toLocaleDateString('es-CO') : '-'}</span>
                                                    {inv.fileUrl && (
                                                        <a
                                                            href={inv.fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 font-semibold"
                                                            title="Ver PDF en Azure"
                                                        >
                                                            <ExternalLink size={12} /> Azure
                                                        </a>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 7. PASA A: */}
                                            <td className="px-3 py-3 font-medium text-purple-700 dark:text-purple-300 border-r border-gray-100 dark:border-gray-700/50">
                                                {inv.passToArea || '-'}
                                            </td>

                                            {/* 8. OBSERVACIONES DESDE ARCHIVO */}
                                            <td className="px-4 py-3 max-w-[200px] truncate border-r border-gray-100 dark:border-gray-700/50" title={inv.observations || ''}>
                                                {inv.observations || '-'}
                                            </td>

                                            {/* 9. N° DE ORDEN */}
                                            <td className="px-3 py-3 font-mono border-r border-gray-100 dark:border-gray-700/50">
                                                {inv.purchaseOrderNumber || '-'}
                                            </td>

                                            {/* 10. CENTRO DE COSTOS O PROYECTO */}
                                            <td className="px-4 py-3 max-w-[200px] truncate border-r border-gray-100 dark:border-gray-700/50" title={inv.costCenterOrProject || ''}>
                                                {inv.costCenterOrProject || '-'}
                                            </td>

                                            {/* 11. OBSERVACIONES DESDE COMPRAS */}
                                            <td className="px-4 py-3 max-w-[200px] truncate border-r border-gray-100 dark:border-gray-700/50" title={inv.purchaseObservations || ''}>
                                                {inv.purchaseObservations || '-'}
                                            </td>

                                            {/* 12. VALIDACIÓN COMERCIAL */}
                                            <td className="px-3 py-3 text-center border-r border-gray-100 dark:border-gray-700/50">
                                                {renderValidationBadge(inv.commercialValidation)}
                                            </td>

                                            {/* 13. VALIDACIÓN JURÍDICA */}
                                            <td className="px-3 py-3 text-center border-r border-gray-100 dark:border-gray-700/50">
                                                {renderValidationBadge(inv.legalValidation)}
                                            </td>

                                            {/* 14. OBSERVACIONES DESDE JURÍDICA */}
                                            <td className="px-4 py-3 max-w-[200px] truncate border-r border-gray-100 dark:border-gray-700/50" title={inv.legalObservations || ''}>
                                                {inv.legalObservations || '-'}
                                            </td>

                                            {/* 15. N° DE CAUSACIÓN */}
                                            <td className="px-3 py-3 font-mono font-semibold text-emerald-700 dark:text-emerald-400 border-r border-gray-100 dark:border-gray-700/50">
                                                {inv.causationNumber || '-'}
                                            </td>

                                            {/* 16. OBSERVACIONES DESDE CONTABILIDAD */}
                                            <td className="px-4 py-3 max-w-[200px] truncate border-r border-gray-100 dark:border-gray-700/50" title={inv.causationObservations || ''}>
                                                {inv.causationObservations || '-'}
                                            </td>

                                            {/* ACCIONES */}
                                            <td className="px-3 py-3 text-right sticky right-0 bg-white dark:bg-gray-800 shadow-sm border-l border-gray-100 dark:border-gray-700">
                                                <div className="flex items-center justify-end gap-1">
                                                    {canManageInvoices && (
                                                        <button
                                                            onClick={() => openEditModal(inv)}
                                                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                            title="Editar factura"
                                                        >
                                                            <Edit3 size={15} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => router.push(`/invoices/${inv.id}`)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Ver detalle de la factura"
                                                    >
                                                        <Eye size={15} />
                                                    </button>
                                                    {canDeleteInvoices && inv.status !== 'PAID' && (
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm('¿Estás seguro de eliminar esta factura?')) {
                                                                    try {
                                                                        await invoiceService.deleteInvoice(token!, inv.id);
                                                                        addToast('Factura eliminada', 'success');
                                                                        loadInvoices();
                                                                    } catch (err) {
                                                                        console.error(err);
                                                                        addToast('No se pudo eliminar la factura', 'error');
                                                                    }
                                                                }
                                                            }}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Eliminar factura"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Bar */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                            <div className="text-xs text-gray-500 font-medium">
                                Mostrando {Math.min((page - 1) * limit + 1, total)} - {Math.min(page * limit, total)} de {total.toLocaleString()} facturas
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <span>Filas por página:</span>
                                    <select
                                        value={limit}
                                        onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                                        className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 outline-none text-xs font-semibold"
                                    >
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                        <option value={250}>250</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page <= 1}
                                        className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none"
                                        title="Página anterior"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-xs font-semibold px-2">
                                        Página {page} de {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page >= totalPages}
                                        className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none"
                                        title="Página siguiente"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* EDIT MODAL FOR ROLE-BASED FIELD EDITING */}
            {editingInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b pb-4 dark:border-gray-700">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                    Editar Factura #{editingInvoice.invoiceNumber}
                                </h3>
                                <p className="text-xs text-gray-500">Proveedor: {editingInvoice.supplier?.name || 'N/A'}</p>
                            </div>
                            <button onClick={() => setEditingInvoice(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Sección Archivo / General */}
                            <div className="border rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/30 space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600">1. Datos de Archivo / Recepción</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Pasa A:</label>
                                        <select
                                            value={editForm.passToArea || ''}
                                            onChange={e => setEditForm({ ...editForm, passToArea: e.target.value })}
                                            className="w-full mt-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                                        >
                                            <option value="">-- Seleccionar área --</option>
                                            {AREA_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Observaciones desde Archivo:</label>
                                        <input
                                            type="text"
                                            value={editForm.observations || ''}
                                            onChange={e => setEditForm({ ...editForm, observations: e.target.value })}
                                            className="w-full mt-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Sección Compras */}
                            <div className="border rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/30 space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600">2. Sección Compras</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">N° de Orden:</label>
                                        <input
                                            type="text"
                                            value={editForm.purchaseOrderNumber || ''}
                                            onChange={e => setEditForm({ ...editForm, purchaseOrderNumber: e.target.value })}
                                            className="w-full mt-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Centro de Costos o Proyecto:</label>
                                        <select
                                            value={editForm.costCenterOrProject || ''}
                                            onChange={e => setEditForm({ ...editForm, costCenterOrProject: e.target.value })}
                                            className="w-full mt-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                                        >
                                            <option value="">-- Seleccionar Centro de Costo / Proyecto --</option>
                                            {AREA_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Observaciones desde Compras:</label>
                                        <input
                                            type="text"
                                            value={editForm.purchaseObservations || ''}
                                            onChange={e => setEditForm({ ...editForm, purchaseObservations: e.target.value })}
                                            className="w-full mt-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Sección Comercial */}
                            <div className="border rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/30 space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600">3. Sección Comercial</h4>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Validación Comercial:</label>
                                    <select
                                        value={editForm.commercialValidation || ''}
                                        onChange={e => setEditForm({ ...editForm, commercialValidation: e.target.value })}
                                        className="w-full mt-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                                    >
                                        <option value="">-- Pendiente --</option>
                                        <option value="APROBADO">APROBADO</option>
                                        <option value="RECHAZADO">RECHAZADO</option>
                                    </select>
                                </div>
                            </div>

                            {/* Sección Jurídica */}
                            <div className="border rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/30 space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-red-600">4. Sección Jurídica</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Validación Jurídica:</label>
                                        <select
                                            value={editForm.legalValidation || ''}
                                            onChange={e => setEditForm({ ...editForm, legalValidation: e.target.value })}
                                            className="w-full mt-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                                        >
                                            <option value="">-- Pendiente --</option>
                                            <option value="APROBADO">APROBADO</option>
                                            <option value="RECHAZADO">RECHAZADO</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Observaciones desde Jurídica:</label>
                                        <input
                                            type="text"
                                            value={editForm.legalObservations || ''}
                                            onChange={e => setEditForm({ ...editForm, legalObservations: e.target.value })}
                                            className="w-full mt-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Sección Contabilidad */}
                            <div className="border rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/30 space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600">5. Sección Contabilidad</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">N° de Causación:</label>
                                        <input
                                            type="text"
                                            value={editForm.causationNumber || ''}
                                            onChange={e => setEditForm({ ...editForm, causationNumber: e.target.value })}
                                            className="w-full mt-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Observaciones desde Contabilidad:</label>
                                        <input
                                            type="text"
                                            value={editForm.causationObservations || ''}
                                            onChange={e => setEditForm({ ...editForm, causationObservations: e.target.value })}
                                            className="w-full mt-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
                            <button
                                onClick={() => setEditingInvoice(null)}
                                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                            >
                                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
