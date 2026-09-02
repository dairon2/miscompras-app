"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search, Filter, Plus, Truck, Mail, Phone,
    ExternalLink, Building2, List, LayoutGrid, X,
    Package, ArrowRightCircle, FileText, Briefcase, User, Download, FileSpreadsheet, Save, Hash, MapPin, Upload,
    Edit, Trash2, AlertTriangle, Loader2, CalendarDays
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useFilterStore } from "@/store/filterStore";

import { StarRatingDisplay } from "@/components/StarRating";
import AlertModal from "@/components/AlertModal";
import SearchableSelect from "@/components/SearchableSelect";
import {
    getSupplierManagementBadgeClass,
    getSupplierManagementLabel,
    supplierManagementOptions,
    type SupplierManagement
} from "@/lib/supplierManagement";

// Custom hook for debounce
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

function toDateTimeLocalInput(value?: string): string {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 19);
}

export default function SuppliersPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const [suppliers, setSuppliers] = useState([]);
    const [totalSuppliers, setTotalSuppliers] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 50;
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        nit: "",
        contactName: "",
        email: "",
        phone: "",
        address: "",
        supplierType: "SUPPLIER" as "SUPPLIER" | "SERVICE_PROVIDER",
        criticality: "LOW" as "LOW" | "MEDIUM" | "HIGH",
        activity: "",
        management: "UNCLASSIFIED" as SupplierManagement,
        createdAt: ""
    });

    // Import modal state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);

    // Alert State
    const [alertState, setAlertState] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
        open: false, title: '', message: '', type: 'info'
    });

    // Delete confirmation state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    // Edit modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<any>(null);

    const userRole = user?.role || 'USER';
    const canManageSuppliers = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER'].includes(userRole);
    const canEditCreatedAt = ['ADMIN', 'DEVELOPER'].includes(userRole);

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setAlertState({ open: true, title, message, type });
    };

    const handleEditClick = (e: React.MouseEvent, supplier: any) => {
        e.stopPropagation();
        setEditingSupplier(supplier);
        setFormData({
            name: supplier.name || '',
            nit: supplier.nit || supplier.taxId || '',
            contactName: supplier.contactName || '',
            email: supplier.email || supplier.contactEmail || '',
            phone: supplier.phone || supplier.contactPhone || '',
            address: supplier.address || '',
            supplierType: supplier.supplierType || 'SUPPLIER',
            criticality: supplier.criticality || 'LOW',
            activity: supplier.activity || '',
            management: supplier.management || 'UNCLASSIFIED',
            createdAt: toDateTimeLocalInput(supplier.createdAt)
        });
        setShowEditModal(true);
    };

    const handleDeleteClick = (e: React.MouseEvent, supplier: any) => {
        e.stopPropagation();
        setSupplierToDelete(supplier);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!supplierToDelete) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/suppliers/${supplierToDelete.id}`);
            setShowDeleteModal(false);
            setSupplierToDelete(null);
            fetchSuppliers();
            showAlert('Eliminado', 'Proveedor eliminado correctamente', 'success');
        } catch (error: any) {
            showAlert('Error', error.response?.data?.error || 'Error al eliminar proveedor', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleEditSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSupplier) return;
        try {
            const { createdAt, ...supplierFields } = formData;
            const createdAtChanged = canEditCreatedAt
                && createdAt
                && createdAt !== toDateTimeLocalInput(editingSupplier.createdAt);
            const payload = createdAtChanged
                ? { ...supplierFields, createdAt: new Date(createdAt).toISOString() }
                : supplierFields;

            await api.put(`/admin/suppliers/${editingSupplier.id}`, payload);
            setShowEditModal(false);
            setEditingSupplier(null);
            setFormData({ name: '', nit: '', contactName: '', email: '', phone: '', address: '', supplierType: 'SUPPLIER', criticality: 'LOW', activity: '', management: 'UNCLASSIFIED', createdAt: '' });
            fetchSuppliers();
            showAlert('Actualizado', 'Proveedor actualizado correctamente', 'success');
        } catch (error: any) {
            showAlert('Error', error.response?.data?.error || 'Error al actualizar proveedor', 'error');
        }
    };

    // Search and Filter State from store
    const { suppliers: storedFilters, setSuppliersFilter, clearSuppliersFilters } = useFilterStore();


    const searchTerm = storedFilters.searchTerm;
    const setSearchTerm = (value: string) => {
        setPage(1);
        setSuppliersFilter({ searchTerm: value });
    };
    const typeFilter = storedFilters.typeFilter;
    const setTypeFilter = (value: 'ALL' | 'SUPPLIER' | 'SERVICE_PROVIDER') => {
        setPage(1);
        setSuppliersFilter({ typeFilter: value });
    };
    const managementFilter = storedFilters.managementFilter || 'ALL';
    const setManagementFilter = (value: typeof managementFilter) => {
        setPage(1);
        setSuppliersFilter({ managementFilter: value });
    };

    // Debounce search term for better performance (150ms delay - faster response)
    const debouncedSearchTerm = useDebounce(searchTerm, 150);
    const isSearching = searchTerm !== debouncedSearchTerm;

    useEffect(() => {
        if (user) fetchSuppliers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, page, debouncedSearchTerm, typeFilter, managementFilter]);

    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            const response = await api.get("/suppliers", {
                params: {
                    page,
                    pageSize,
                    search: debouncedSearchTerm,
                    supplierType: typeFilter === 'ALL' ? undefined : typeFilter,
                    management: managementFilter === 'ALL' ? undefined : managementFilter
                }
            });
            setSuppliers(response.data.data || []);
            setTotalSuppliers(response.data.total || 0);
        } catch (err) {
            console.error("Error fetching suppliers", err);
        } finally {
            setLoading(false);
        }
    };

    const handleExportSuppliers = async () => {
        setExporting(true);
        try {
            const response = await api.get('/reports/suppliers', {
                params: {
                    search: debouncedSearchTerm,
                    supplierType: typeFilter === 'ALL' ? undefined : typeFilter,
                    management: managementFilter === 'ALL' ? undefined : managementFilter
                },
                responseType: 'blob'
            });

            const contentType = typeof response.headers['content-type'] === 'string'
                ? response.headers['content-type']
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            const blob = new Blob([response.data], {
                type: contentType
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const contentDisposition = response.headers['content-disposition'];
            const filename = (typeof contentDisposition === 'string'
                ? contentDisposition.match(/filename="?([^";]+)"?/i)?.[1]
                : undefined)
                || `Reporte_Proveedores_${new Date().toISOString().split('T')[0]}.xlsx`;

            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error al exportar proveedores:', error);
            showAlert("Error", "Error al generar el archivo Excel", "error");
        } finally {
            setExporting(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(totalSuppliers / pageSize));

    const navigateToSupplier = (supplierId: string) => {
        if (!supplierId) return;
        router.push(`/suppliers/${encodeURIComponent(supplierId)}`);
    };

    const handleCreateSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post("/admin/suppliers", formData);
            setShowCreateModal(false);
            setFormData({ name: "", nit: "", contactName: "", email: "", phone: "", address: "", supplierType: "SUPPLIER", criticality: "LOW", activity: "", management: "UNCLASSIFIED", createdAt: "" });
            fetchSuppliers();
            setFormData({ name: "", nit: "", contactName: "", email: "", phone: "", address: "", supplierType: "SUPPLIER", criticality: "LOW", activity: "", management: "UNCLASSIFIED", createdAt: "" });
            fetchSuppliers();
            showAlert("Registrado", "Proveedor registrado exitosamente", "success");
        } catch (error: any) {
            console.error("Error creating supplier", error);
            const errorMessage = error.response?.data?.error || "Error al registrar proveedor";
            const errorDetails = error.response?.data?.details || "";

            // Si hay detalles, mostrarlos en el mensaje
            const fullMessage = errorDetails ? `${errorMessage}. ${errorDetails}` : errorMessage;

            showAlert("Error", fullMessage, "error");
        }
    };

    const handleImportFile = async () => {
        if (!importFile) return;

        setImporting(true);
        setImportResult(null);

        try {
            // Dynamic import of xlsx library
            const xlsxModule = await import('xlsx');
            const XLSX = xlsxModule.default || xlsxModule;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    // Send to backend
                    const response = await api.post('/admin/suppliers/bulk-import', {
                        suppliers: jsonData
                    });

                    setImportResult(response.data);
                    fetchSuppliers(); // Refresh list
                } catch (err: any) {
                    setImportResult({ error: err.message || 'Error al procesar archivo' });
                } finally {
                    setImporting(false);
                }
            };

            reader.readAsBinaryString(importFile);
        } catch (err: any) {
            setImporting(false);
            setImportResult({ error: 'Error al leer archivo' });
        }
    };

    return (
        <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h2 className="text-4xl font-black tracking-tight mb-2">Proveedores</h2>
                    <p className="text-gray-500 font-medium">Gestión y trazabilidad de aliados estratégicos.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Search Bar */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar proveedor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-700 rounded-2xl py-3 pl-12 pr-10 text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                        {isSearching && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-500 animate-spin" size={16} />
                        )}
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col xl:flex-row justify-between items-center gap-4 mb-8">
                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                <div className="flex gap-2 bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl overflow-x-auto max-w-full">
                    <button
                        onClick={() => setTypeFilter('ALL')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${typeFilter === 'ALL' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => setTypeFilter('SUPPLIER')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${typeFilter === 'SUPPLIER' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Proveedores
                    </button>
                    <button
                        onClick={() => setTypeFilter('SERVICE_PROVIDER')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${typeFilter === 'SERVICE_PROVIDER' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Prestadores de Servicios
                    </button>
                </div>
                    <select
                        value={managementFilter}
                        onChange={(event) => setManagementFilter(event.target.value as typeof managementFilter)}
                        aria-label="Filtrar por gestión responsable"
                        className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 text-xs font-black text-gray-600 dark:text-gray-200 shadow-sm outline-none focus:ring-2 focus:ring-primary-500"
                    >
                        <option value="ALL">Todas las gestiones</option>
                        {supplierManagementOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-2 rounded-xl transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <List size={20} />
                        </button>
                    </div>

                    <button
                        onClick={handleExportSuppliers}
                        disabled={exporting}
                        aria-busy={exporting}
                        title="Descarga todos los proveedores que coinciden con los filtros actuales"
                        className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 px-6 py-4 rounded-2xl font-black shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 uppercase text-[10px] tracking-widest disabled:opacity-60 disabled:cursor-wait"
                    >
                        <FileSpreadsheet size={18} className="text-green-600" />
                        <Download size={18} className="text-primary-600" />
                        <span>{exporting ? 'PREPARANDO XLSX...' : 'EXPORTAR FILTRO XLSX'}</span>
                    </button>

                    {canManageSuppliers && (
                        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-slate-900 dark:bg-primary-600 text-white px-6 py-4 rounded-2xl font-black shadow-xl hover:-translate-y-1 transition-all active:scale-95 whitespace-nowrap">
                            <Plus className="w-5 h-5" />
                            Registrar Proveedor
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="py-24 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                    Consultando catálogo de proveedores...
                </div>
            ) : suppliers.length === 0 ? (
                <div className="py-24 text-center bg-white dark:bg-slate-800 rounded-[3rem] border border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-gray-400 font-black text-xs uppercase">No se encontraron proveedores</p>
                </div>
            ) : (
                <>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

                            {suppliers.map((supp: any, index: number) => (
                                <SupplierCard
                                    key={supp.id}
                                    supplier={supp}
                                    index={index}
                                    onClick={() => navigateToSupplier(supp.id)}
                                    canManage={canManageSuppliers}
                                    onEdit={(e: React.MouseEvent) => handleEditClick(e, supp)}
                                    onDelete={(e: React.MouseEvent) => handleDeleteClick(e, supp)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-500">
                                        {totalSuppliers} {totalSuppliers === 1 ? 'proveedor' : 'proveedores'}
                                    </span>
                                    <span className="text-xs text-gray-400">Página {page} de {totalPages}</span>
                                </div>
                            </div>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-gray-700">
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Proveedor / NIT</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Contacto</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Correo</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Teléfono</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Actividad</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Gestión responsable</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliers.map((supp: any) => (
                                        <tr key={supp.id} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors group">
                                            <td className="p-6">
                                                <p className="font-black text-sm mb-1 group-hover:text-primary-600 transition-colors">{supp.name}</p>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{supp.taxId || supp.nit || '-'}</p>
                                            </td>
                                            <td className="p-6 text-xs font-bold text-gray-600 dark:text-gray-300">{supp.contactName || '-'}</td>
                                            <td className="p-6 text-xs font-bold text-gray-600 dark:text-gray-300">{supp.email || supp.contactEmail || '-'}</td>
                                            <td className="p-6 text-xs font-bold text-gray-600 dark:text-gray-300">{supp.phone || supp.contactPhone || '-'}</td>
                                            <td className="p-6 text-xs font-medium text-gray-500 max-w-[200px] truncate" title={supp.activity}>
                                                {supp.activity || '-'}
                                            </td>
                                            <td className="p-6">
                                                <span className={`inline-flex px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider ${getSupplierManagementBadgeClass(supp.management)}`}>
                                                    {getSupplierManagementLabel(supp.management)}
                                                </span>
                                            </td>
                                            <td className="p-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {canManageSuppliers && (
                                                        <>
                                                            <button
                                                                onClick={(e) => handleEditClick(e, supp)}
                                                                className="p-2 bg-white dark:bg-slate-800 hover:bg-primary-600 hover:text-white rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all text-primary-600"
                                                                title="Editar"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDeleteClick(e, supp)}
                                                                className="p-2 bg-white dark:bg-slate-800 hover:bg-red-600 hover:text-white rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all text-red-600"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => navigateToSupplier(supp.id)}
                                                        className="p-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-400 hover:text-primary-600 rounded-xl transition-all"
                                                        title="Ver detalle"
                                                    >
                                                        <ArrowRightCircle size={20} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl bg-white dark:bg-slate-800 px-6 py-4 border border-gray-100 dark:border-gray-700">
                        <span className="text-xs font-bold text-gray-400">Mostrando {suppliers.length} de {totalSuppliers}</span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPage(current => Math.max(1, current - 1))}
                                disabled={page === 1}
                                className="px-4 py-2 rounded-xl text-xs font-black border border-gray-200 dark:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                            >
                                Anterior
                            </button>
                            <span className="text-xs font-black text-gray-500">{page} / {totalPages}</span>
                            <button
                                type="button"
                                onClick={() => setPage(current => Math.min(totalPages, current + 1))}
                                disabled={page >= totalPages}
                                className="px-4 py-2 rounded-xl text-xs font-black border border-gray-200 dark:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Create Supplier Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowCreateModal(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-3xl p-10 overflow-hidden"
                        >
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="absolute top-8 right-8 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-all"
                            >
                                <X size={24} />
                            </button>

                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600">
                                    <Truck size={24} />
                                </div>
                                <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-600 rounded-full text-[10px] font-black uppercase tracking-widest">Nuevo Registro</span>
                            </div>

                            <h2 className="text-3xl font-black tracking-tight mb-2">Registrar Proveedor</h2>
                            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-10">Información comercial y de contacto</p>

                            <form onSubmit={handleCreateSupplier} className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">NIT</label>
                                        <div className="relative">
                                            <Hash className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="text"
                                                value={formData.nit}
                                                onChange={e => setFormData({ ...formData, nit: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                                placeholder="900123456-7"
                                            />
                                        </div>
                                    </div>
                                    <input
                                        type="text" required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 px-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                        placeholder="Razón social"
                                    />
                                </div>


                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Actividad Económica</label>
                                    <input
                                        type="text"
                                        value={formData.activity || ''}
                                        onChange={e => setFormData({ ...formData, activity: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 px-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                        placeholder="Ej: Suministro de papelería, Servicios de mantenimiento..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Contacto</label>
                                        <input
                                            type="text"
                                            value={formData.contactName}
                                            onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 px-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                            placeholder="Nombre del contacto"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                                placeholder="correo@proveedor.co"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Teléfono</label>
                                        <div className="relative">
                                            <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="tel"
                                                value={formData.phone}
                                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                                placeholder="(604) 123-4567"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Dirección</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="text"
                                                value={formData.address}
                                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                                placeholder="Calle 00 # 00-00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Tipo de Proveedor</label>
                                        <SearchableSelect
                                            value={formData.supplierType}
                                            onChange={val => setFormData({ ...formData, supplierType: val as "SUPPLIER" | "SERVICE_PROVIDER" })}
                                            options={[
                                                { value: "SUPPLIER", label: "Proveedor" },
                                                { value: "SERVICE_PROVIDER", label: "Prestador de Servicio" }
                                            ]}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Criticidad</label>
                                        <SearchableSelect
                                            value={formData.criticality}
                                            onChange={val => setFormData({ ...formData, criticality: val as "LOW" | "MEDIUM" | "HIGH" })}
                                            options={[
                                                { value: "LOW", label: "Baja" },
                                                { value: "MEDIUM", label: "Media" },
                                                { value: "HIGH", label: "Alta" }
                                            ]}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Gestión responsable</label>
                                    <SearchableSelect
                                        value={formData.management}
                                        onChange={value => setFormData({ ...formData, management: value as SupplierManagement })}
                                        options={supplierManagementOptions}
                                    />
                                    <p className="px-4 text-[10px] font-medium text-gray-400">Selecciona “Sin clasificar” si todavía no existe evidencia suficiente.</p>
                                </div>

                                <button type="submit" className="w-full bg-premium-gradient text-white py-5 rounded-2xl font-black shadow-2xl hover:-translate-y-1 hover:shadow-primary-500/30 transition-all active:scale-95 flex items-center justify-center gap-2">
                                    <Save size={20} />
                                    Guardar Proveedor
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )
                }
            </AnimatePresence >

            {/* Import Modal */}
            <AnimatePresence>
                {
                    showImportModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 w-full max-w-lg shadow-2xl relative"
                            >
                                <button
                                    onClick={() => {
                                        setShowImportModal(false);
                                        setImportFile(null);
                                        setImportResult(null);
                                    }}
                                    className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={24} />
                                </button>

                                <h3 className="text-2xl font-black mb-6">Importar Proveedores</h3>
                                <p className="text-gray-500 mb-6 text-sm">
                                    Sube un archivo CSV o Excel (.xlsx) con los datos de los proveedores.
                                    La columna ID será ignorada (se genera automáticamente).
                                </p>

                                {/* File Drop Zone */}
                                <div
                                    className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${importFile
                                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                                        : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                >
                                    {importFile ? (
                                        <div className="flex items-center justify-center gap-3">
                                            <FileSpreadsheet className="text-teal-600" size={32} />
                                            <div className="text-left">
                                                <p className="font-bold text-gray-800 dark:text-gray-200">{importFile.name}</p>
                                                <p className="text-sm text-gray-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                            <button
                                                onClick={() => setImportFile(null)}
                                                className="ml-4 text-gray-400 hover:text-red-500"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className="mx-auto text-gray-400 mb-3" size={40} />
                                            <p className="text-gray-500 mb-2">Arrastra un archivo aquí o</p>
                                            <label className="cursor-pointer inline-block bg-gray-100 dark:bg-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors">
                                                Seleccionar archivo
                                                <input
                                                    type="file"
                                                    accept=".csv,.xlsx,.xls"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        if (e.target.files?.[0]) {
                                                            setImportFile(e.target.files[0]);
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </>
                                    )}
                                </div>

                                {/* Import Result */}
                                {importResult && (
                                    <div className={`mt-6 p-4 rounded-xl ${importResult.error
                                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600'
                                        : 'bg-green-50 dark:bg-green-900/20 text-green-600'
                                        }`}>
                                        {importResult.error ? (
                                            <p className="font-bold">{importResult.error}</p>
                                        ) : (
                                            <>
                                                <p className="font-bold mb-2">{importResult.message}</p>
                                                {importResult.results && (
                                                    <div className="text-sm space-y-1">
                                                        <p>✅ Creados: {importResult.results.success}</p>
                                                        <p>⚠️ Duplicados: {importResult.results.duplicates}</p>
                                                        <p>❌ Errores: {importResult.results.errors}</p>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-4 mt-6">
                                    <button
                                        onClick={() => {
                                            setShowImportModal(false);
                                            setImportFile(null);
                                            setImportResult(null);
                                        }}
                                        className="flex-1 py-4 rounded-2xl border border-gray-200 font-bold hover:bg-gray-50 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleImportFile}
                                        disabled={!importFile || importing}
                                        className="flex-1 py-4 rounded-2xl bg-teal-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {importing ? (
                                            <>Importando...</>
                                        ) : (
                                            <>
                                                <Upload size={18} />
                                                Importar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setShowDeleteModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="w-8 h-8 text-red-600" />
                                </div>
                                <h3 className="text-xl font-black mb-2">¿Eliminar Proveedor?</h3>
                                <p className="text-gray-500 text-sm">Esta acción no se puede deshacer.</p>
                                <p className="font-bold text-primary-600 mt-2">{supplierToDelete?.name}</p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 py-3 px-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={deleting}
                                    className="flex-1 py-3 px-6 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                                >
                                    {deleting ? 'Eliminando...' : 'Eliminar'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Supplier Modal */}
            <AnimatePresence>
                {showEditModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowEditModal(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-3xl p-10 overflow-hidden max-h-[90vh] overflow-y-auto"
                        >
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="absolute top-8 right-8 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-all"
                            >
                                <X size={24} />
                            </button>

                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600">
                                    <Edit size={24} />
                                </div>
                                <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest">Editar</span>
                            </div>

                            <h2 className="text-3xl font-black tracking-tight mb-2">Editar Proveedor</h2>
                            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-10">{editingSupplier?.name}</p>

                            <form onSubmit={handleEditSupplier} className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">NIT</label>
                                        <div className="relative">
                                            <Hash className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="text"
                                                value={formData.nit}
                                                onChange={e => setFormData({ ...formData, nit: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                                placeholder="900123456-7"
                                            />
                                        </div>
                                    </div>
                                    <input
                                        type="text" required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 px-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                        placeholder="Razón social"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Actividad Económica</label>
                                    <input
                                        type="text"
                                        value={formData.activity || ''}
                                        onChange={e => setFormData({ ...formData, activity: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 px-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                        placeholder="Ej: Suministro de papelería..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Contacto</label>
                                        <input
                                            type="text"
                                            value={formData.contactName}
                                            onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 px-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                            placeholder="Nombre del contacto"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                                placeholder="correo@proveedor.co"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Teléfono</label>
                                        <div className="relative">
                                            <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="tel"
                                                value={formData.phone}
                                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                                placeholder="(604) 123-4567"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Dirección</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="text"
                                                value={formData.address}
                                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                                placeholder="Calle 00 # 00-00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Tipo de Proveedor</label>
                                        <SearchableSelect
                                            value={formData.supplierType}
                                            onChange={val => setFormData({ ...formData, supplierType: val as "SUPPLIER" | "SERVICE_PROVIDER" })}
                                            options={[
                                                { value: "SUPPLIER", label: "Proveedor" },
                                                { value: "SERVICE_PROVIDER", label: "Prestador de Servicio" }
                                            ]}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Criticidad</label>
                                        <SearchableSelect
                                            value={formData.criticality}
                                            onChange={val => setFormData({ ...formData, criticality: val as "LOW" | "MEDIUM" | "HIGH" })}
                                            options={[
                                                { value: "LOW", label: "Baja" },
                                                { value: "MEDIUM", label: "Media" },
                                                { value: "HIGH", label: "Alta" }
                                            ]}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Fecha de creación</label>
                                    <div className="relative">
                                        <CalendarDays className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="datetime-local"
                                            step="1"
                                            required
                                            value={formData.createdAt}
                                            max={toDateTimeLocalInput(new Date().toISOString())}
                                            onChange={event => setFormData({ ...formData, createdAt: event.target.value })}
                                            disabled={!canEditCreatedAt}
                                            className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60"
                                        />
                                    </div>
                                    <p className="px-4 text-[10px] font-medium text-gray-400">
                                        {canEditCreatedAt
                                            ? 'Este dato es histórico. Modifícalo únicamente cuando exista evidencia de la fecha correcta.'
                                            : 'Solo administradores y desarrolladores pueden modificar esta fecha.'}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Gestión responsable</label>
                                    <SearchableSelect
                                        value={formData.management}
                                        onChange={value => setFormData({ ...formData, management: value as SupplierManagement })}
                                        options={supplierManagementOptions}
                                    />
                                    <p className="px-4 text-[10px] font-medium text-gray-400">Una selección manual reemplaza la sugerencia automática y deja trazabilidad.</p>
                                </div>

                                <button type="submit" className="w-full bg-premium-gradient text-white py-5 rounded-2xl font-black shadow-2xl hover:-translate-y-1 hover:shadow-primary-500/30 transition-all active:scale-95 flex items-center justify-center gap-2">
                                    <Save size={20} />
                                    Guardar Cambios
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            <AlertModal
                isOpen={alertState.open}
                onClose={() => setAlertState({ ...alertState, open: false })}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />
        </div >
    );
}

function SupplierCard({ supplier, index, onClick, canManage, onEdit, onDelete }: any) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            onClick={onClick}
            className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700 hover:shadow-2xl transition-all group cursor-pointer active:scale-95"
        >
            <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-all shadow-lg shadow-transparent group-hover:shadow-primary-500/30">
                    <Truck size={28} />
                </div>
                <div className="flex items-center gap-2">
                    {canManage && (
                        <>
                            <button
                                onClick={onEdit}
                                className="p-2 bg-white dark:bg-slate-800 hover:bg-primary-600 hover:text-white rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all text-primary-600"
                                title="Editar"
                            >
                                <Edit size={14} />
                            </button>
                            <button
                                onClick={onDelete}
                                className="p-2 bg-white dark:bg-slate-800 hover:bg-red-600 hover:text-white rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all text-red-600"
                                title="Eliminar"
                            >
                                <Trash2 size={14} />
                            </button>
                        </>
                    )}
                    <span className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-green-100 dark:border-green-800/30">
                        Activo
                    </span>
                </div>
            </div>

            <h3 className="text-xl font-black tracking-tight mb-1 group-hover:text-primary-600 transition-colors">{supplier.name}</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">NIT: {supplier.taxId}</p>

            <span className={`inline-flex px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider mb-3 ${getSupplierManagementBadgeClass(supplier.management)}`}>
                {getSupplierManagementLabel(supplier.management)}
            </span>

            {supplier.activity && (
                <p className="text-xs font-medium text-gray-500 bg-gray-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-lg mb-6 line-clamp-2">
                    {supplier.activity}
                </p>
            )}

            <div className={`space-y-4 mb-8 ${!supplier.activity ? 'mt-6' : ''}`}>
                <div className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    <Mail size={16} className="text-primary-400" />
                    <span className="truncate">{supplier.email || supplier.contactEmail || "Sin correo"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    <Phone size={16} className="text-primary-400" />
                    <span>{supplier.phone || supplier.contactPhone || "Sin teléfono"}</span>
                </div>
            </div>

            <div className="pt-6 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center opacity-60 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2">
                    {supplier.avgRating > 0 ? (
                        <StarRatingDisplay value={supplier.avgRating} count={supplier.ratingsCount} />
                    ) : (
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sin calificar</span>
                    )}
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black text-primary-600 uppercase">
                    Ver Historial
                    <ArrowRightCircle size={14} />
                </div>
            </div>
        </motion.div>
    );
}
