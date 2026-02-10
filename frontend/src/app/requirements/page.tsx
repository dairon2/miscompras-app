"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Filter,
    Plus,
    FileText,
    CheckCircle,
    Clock,
    XCircle,
    LayoutGrid,
    Table as TableIcon,
    ArrowRight,
    Building,
    DollarSign,
    ChevronRight,
    ChevronDown,
    Package,
    Download,
    Calendar,
    FileSpreadsheet,
    User,
    Trash2,
    BookOpen,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Paperclip,
    Copy
} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { exportRequirements } from "@/lib/excelExport";
import { useAuthStore } from "@/store/authStore";
import { useFilterStore } from "@/store/filterStore";
import YearSelector from "@/components/YearSelector";
import { translateStatus } from "@/lib/translations";
import AlertModal from "@/components/AlertModal";

import BulkEditModal from "@/components/BulkEditModal";

interface Requirement {
    id: string;
    title: string;
    description?: string;
    status: string;
    procurementStatus?: string;
    actualAmount?: string;
    estimatedAmount?: string;
    invoiceNumber?: string;
    purchaseOrderNumber?: string;
    project?: { name: string };
    area?: { name: string };
    budget?: {
        id: string;
        title: string;
        category?: { id: string; name: string }
    };
    supplierId?: string;
    supplier?: { id: string; name: string };
    manualSupplierName?: string;
    reqCategory: string;
    isAsiento?: boolean;
    createdAt: string;
    groupId?: number;
    attachments?: { id: string }[];
    receivedAtSatisfaction?: boolean;
    createdById: string;
    createdBy?: { name: string; email: string };
}

export default function RequirementsPage() {
    const router = useRouter();
    const { user } = useAuthStore();

    // Alert State
    const [alertState, setAlertState] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
        open: false, title: '', message: '', type: 'info'
    });

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setAlertState({ open: true, title, message, type });
    };

    const [requirements, setRequirements] = useState<Requirement[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    // Use filter store for persistent filters
    const { requirements: storedFilters, setRequirementsFilter, clearRequirementsFilters } = useFilterStore();


    const searchTerm = storedFilters.searchTerm;
    const setSearchTerm = (value: string) => setRequirementsFilter({ searchTerm: value });
    const [projects, setProjects] = useState([]);
    const [areas, setAreas] = useState([]);
    const [users, setUsers] = useState([]);
    const [suppliersList, setSuppliersList] = useState<{ id: string; name: string }[]>([]);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [requirementToDelete, setRequirementToDelete] = useState<any>(null);

    // Bulk Edit State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);
    const isAdminOrLeader = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR'].includes(user?.role || '');

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(requirements.map(r => r.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(sid => sid !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    // Year filter - from store
    const currentYear = new Date().getFullYear();
    const selectedYear = storedFilters.selectedYear;
    const setSelectedYear = (year: number) => setRequirementsFilter({ selectedYear: year });
    const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
    const sortOrder = storedFilters.sortOrder;
    const setSortOrder = (order: 'desc' | 'asc') => setRequirementsFilter({ sortOrder: order });

    useEffect(() => {
        api.get('/requirements/years')
            .then(res => setAvailableYears(res.data))
            .catch(err => console.error("Error loading years:", err));
    }, []);

    // Filters from store
    const filters = {
        status: storedFilters.status,
        procurementStatus: storedFilters.procurementStatus,
        areaId: storedFilters.areaId,
        createdById: storedFilters.createdById,
        projectId: storedFilters.projectId,
        reqCategory: storedFilters.reqCategory,
        supplierId: storedFilters.supplierId,
        startDate: storedFilters.startDate,
        endDate: storedFilters.endDate
    };
    const setFilters = (newFilters: Partial<typeof filters>) => setRequirementsFilter(newFilters);

    // Role-based permissions
    const userRole = user?.role || 'USER';
    const isAdmin = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR'].includes(userRole);
    // PERMISO DE ELIMINACIÓN: Solo Director, Coordinador y Admin (Developer para debug si necesario, pero instruccion dice nadie mas)
    const canDelete = ['ADMIN', 'DIRECTOR', 'COORDINATOR'].includes(userRole);

    // Fetch requirements when year changes
    useEffect(() => {
        if (user) {
            fetchRequirements();
            fetchCatalogs();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedYear]);

    const fetchRequirements = async () => {
        try {
            setLoading(true);
            // Admins/Directors/Leaders see all requirements, Users see only their own
            const endpoint = isAdmin ? "/requirements/all" : "/requirements/me";
            const response = await api.get(endpoint, {
                params: { year: selectedYear }
            });
            const data = response.data.data || response.data;
            setRequirements(data);
        } catch (err) {
            console.error("Error fetching requirements", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCatalogs = async () => {
        try {
            const [p, a, u, s] = await Promise.all([
                api.get('/projects'),
                api.get('/areas'),
                api.get('/users'),
                api.get('/suppliers')
            ]);
            setProjects(p.data);
            setAreas(a.data);
            setUsers(u.data);
            setSuppliersList(s.data);
        } catch (err) {
            console.error("Error fetching catalogs", err);
        }
    };

    const handleDeleteClick = (req: any) => {
        setRequirementToDelete(req);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!requirementToDelete) return;
        try {
            await api.delete(`/requirements/${requirementToDelete.id}`);
            setRequirements(requirements.filter((r: any) => r.id !== requirementToDelete.id));
            setDeleteModalOpen(false);
            setRequirementToDelete(null);
            showAlert("Eliminado", "Requerimiento eliminado correctamente", "success");
        } catch (err: any) {
            console.error("Error deleting requirement", err);
            const msg = err.response?.data?.error === 'Unauthorized access'
                ? 'No tienes permiso para eliminar este requerimiento.'
                : (err.response?.data?.error || "Error al eliminar el requerimiento");
            showAlert("Error", msg, "error");
        }
    };

    const handleConfirmBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        setIsDeletingBulk(true);
        try {
            await Promise.all(selectedIds.map(id => api.delete(`/requirements/${id}`)));
            setRequirements(requirements.filter((r: any) => !selectedIds.includes(r.id)));
            setSelectedIds([]);
            setIsBulkDeleteOpen(false);
            showAlert("Eliminación Masiva", "Requerimientos eliminados correctamente", "success");
        } catch (err: any) {
            console.error("Error deleting requirements", err);
            const msg = err.response?.data?.error === 'Unauthorized access'
                ? 'No tienes permiso para eliminar algunos de estos requerimientos.'
                : (err.response?.data?.error || "Error al eliminar algunos requerimientos");
            showAlert("Error", msg, "error");
        } finally {
            setIsDeletingBulk(false);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'bg-green-100 text-green-700 border-green-200';
            case 'REJECTED': return 'bg-red-100 text-red-700 border-red-200';
            case 'PENDING_APPROVAL': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'Aprobado';
            case 'REJECTED': return 'Rechazado';
            case 'PENDING_APPROVAL': return 'En espera por aprobación';
            default: return status;
        }
    };

    const getProcStatusStyle = (status: string) => {
        switch (status) {
            case 'FINALIZADO': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'ANULADO': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'ENTREGADO': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'EN_TRAMITE': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            case 'POSTERGADO': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const filteredReqs = requirements.filter((r: any) => {
        const searchText = searchTerm.toLowerCase().trim();

        // Smart search: if only numbers, search by groupId; if has letters, search by title/description
        const isOnlyNumbers = /^\d+$/.test(searchText);

        let matchesSearch = true;
        if (searchText) {
            if (isOnlyNumbers) {
                // Only numbers: search by groupId
                matchesSearch = r.groupId && r.groupId.toString().includes(searchText);
            } else {
                // Has letters: search by title and description
                matchesSearch = r.title.toLowerCase().includes(searchText) ||
                    (r.description && r.description.toLowerCase().includes(searchText));
            }
        }

        // FIX: Add Status Filter Logic
        const matchesStatus = !filters.status || r.status === filters.status;
        const matchesProc = !filters.procurementStatus || r.procurementStatus === filters.procurementStatus;
        const matchesArea = !filters.areaId || r.areaId === filters.areaId;
        const matchesUser = !filters.createdById || r.createdById === filters.createdById;
        const matchesProject = !filters.projectId || r.projectId === filters.projectId;
        const matchesCategory = !filters.reqCategory || r.reqCategory === filters.reqCategory;
        const matchesSupplier = !filters.supplierId || r.supplierId === filters.supplierId;

        // Date range filter
        const createdAt = new Date(r.createdAt);
        const start = filters.startDate ? new Date(filters.startDate) : null;
        let end = filters.endDate ? new Date(filters.endDate) : null;

        if (end) end.setHours(23, 59, 59, 999);

        const matchesDate = (!start || createdAt >= start) && (!end || createdAt <= end);

        return matchesSearch && matchesStatus && matchesProc && matchesArea && matchesUser && matchesProject && matchesCategory && matchesSupplier && matchesDate;
    }).sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return (
        <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
            >
                <div className="flex items-center gap-6">
                    <div>
                        <h2 className="text-4xl font-black tracking-tight mb-2">Requerimientos de Compra</h2>
                        <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.2em]">Gestión Institucional de Requerimientos</p>
                    </div>

                    {/* Year Selector */}
                    <YearSelector
                        selectedYear={selectedYear}
                        availableYears={availableYears}
                        onChange={setSelectedYear}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                    <button
                        onClick={() => {
                            try {
                                exportRequirements(filteredReqs);
                            } catch (error) {
                                console.error('Error al exportar:', error);
                                alert('Error al generar el archivo Excel');
                            }
                        }}
                        className="flex items-center gap-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 px-4 md:px-6 py-3 md:py-4 rounded-2xl font-black shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all uppercase text-[10px] tracking-widest"
                    >
                        <FileSpreadsheet size={18} className="text-green-600" />
                        <Download size={18} className="text-primary-600" />
                        <span className="hidden md:inline">EXPORTAR XLSX</span>
                    </button>
                    <div className="bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex gap-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-2.5 rounded-xl transition-all ${viewMode === 'table' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                        >
                            <TableIcon size={18} />
                        </button>
                    </div>
                    {['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR'].includes(user?.role || '') && (
                        <button
                            onClick={() => router.push('/asientos')}
                            className="flex items-center gap-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 px-4 md:px-6 py-3 md:py-4 rounded-2xl font-black shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all uppercase text-[10px] tracking-widest"
                        >
                            <BookOpen size={18} className="text-indigo-600" />
                            <span className="hidden md:inline">Asientos</span>
                        </button>
                    )}
                    {!['LEADER', 'AUDITOR'].includes(user?.role || '') && (
                        <button
                            onClick={() => router.push('/requirements/new')}
                            className="flex items-center gap-2 bg-primary-600 text-white px-4 md:px-6 py-3 md:py-4 rounded-2xl font-black shadow-lg hover:bg-primary-700 hover:-translate-y-1 transition-all active:scale-95 whitespace-nowrap uppercase text-[10px] tracking-widest"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="hidden sm:inline">Nuevo Requerimiento</span>
                        </button>
                    )}
                </div>
            </motion.div>

            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden mb-12">
                <div className="p-6 border-b border-gray-50 dark:border-gray-700 space-y-4 bg-gray-50/30 dark:bg-slate-900/10">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por título, descripción o número de requerimiento..."
                            className="w-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-xl py-2 px-4 outline-none focus:ring-2 focus:ring-primary-500 font-bold text-xs"
                        >
                            <option value="">Estado Solicitud (Todos)</option>
                            <option value="PENDING_APPROVAL">En espera por aprobación</option>
                            <option value="APPROVED">Aprobado</option>
                            <option value="REJECTED">Rechazado</option>
                        </select>

                        <select
                            value={filters.procurementStatus}
                            onChange={(e) => setFilters({ ...filters, procurementStatus: e.target.value })}
                            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-xl py-2 px-4 outline-none focus:ring-2 focus:ring-primary-500 font-bold text-xs"
                        >
                            <option value="">Estado Trámite (Todos)</option>
                            <option value="ANULADO">Anulado</option>
                            <option value="ENTREGADO">Entregado</option>
                            <option value="EN_TRAMITE">En trámite</option>
                            <option value="PENDIENTE">Pendientes</option>
                            <option value="FINALIZADO">Finalizado</option>
                            <option value="POSTERGADO">Postergado</option>
                        </select>

                        <select
                            value={filters.reqCategory}
                            onChange={(e) => setFilters({ ...filters, reqCategory: e.target.value })}
                            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-xl py-2 px-4 outline-none focus:ring-2 focus:ring-primary-500 font-bold text-xs"
                        >
                            <option value="">Tipo de Requerimiento (Todos)</option>
                            <option value="ORDEN_COMPRA">Orden de Compra</option>
                            <option value="COMPRA">Compra</option>
                            <option value="ANTICIPO">Anticipo</option>
                            <option value="SERVICIO">Servicio</option>
                            <option value="ORDEN_SERVICIO">Orden de Servicio</option>
                            <option value="CONTRATO">Contrato</option>
                            <option value="ORDEN_PRODUCCION">Orden de Producción</option>
                            <option value="COMPRA_ONLINE">Compra Online</option>
                        </select>

                        {/* Leaders filter - hidden for USER role unless they are an area director */}
                        {(userRole !== 'USER' || user?.isAreaDirector) && (
                            <select
                                value={filters.createdById}
                                onChange={(e) => setFilters({ ...filters, createdById: e.target.value })}
                                className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-xl py-2 px-4 outline-none focus:ring-2 focus:ring-primary-500 font-bold text-xs"
                            >
                                <option value="">Todos los Líderes</option>
                                {users
                                    .filter((u: any) => {
                                        // FIX: Allow COORDINATOR, ADMIN, DEVELOPER to see all users. 
                                        // DIRECTORS who are Area Directors MUST remain restricted (reverting previous change for DIRECTOR).
                                        if (user?.isAreaDirector && !['ADMIN', 'COORDINATOR', 'DEVELOPER'].includes(userRole)) {
                                            return u.areaId === user?.areaId;
                                        }
                                        return true; // Admins, Coordinators see all. Directors without flag see all.
                                    })
                                    .map((u: any) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)
                                }
                            </select>
                        )}

                        <select
                            value={filters.projectId}
                            onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
                            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-xl py-2 px-4 outline-none focus:ring-2 focus:ring-primary-500 font-bold text-xs"
                        >
                            <option value="">Todos los Presupuestos (Proyectos)</option>
                            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>

                        <select
                            value={filters.supplierId}
                            onChange={(e) => setFilters({ ...filters, supplierId: e.target.value })}
                            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-xl py-2 px-4 outline-none focus:ring-2 focus:ring-primary-500 font-bold text-xs"
                        >
                            <option value="">Todos los Proveedores</option>
                            {suppliersList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center gap-4 pt-2 border-t border-gray-50 dark:border-gray-700">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2 opacity-60">
                            <Calendar size={14} /> Fecha de Solicitud:
                        </span>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-xl py-1 px-3 outline-none focus:ring-2 focus:ring-primary-500 font-bold text-[10px]"
                            />
                            <span className="text-gray-300">/</span>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-xl py-1 px-3 outline-none focus:ring-2 focus:ring-primary-500 font-bold text-[10px]"
                            />
                            {(filters.startDate || filters.endDate) && (
                                <button
                                    onClick={() => setFilters({ ...filters, startDate: '', endDate: '' })}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <XCircle size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Counter and Sort Controls */}
                <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-500">
                            {filteredReqs.length} {filteredReqs.length === 1 ? 'requerimiento' : 'requerimientos'}
                        </span>
                        {filteredReqs.length !== requirements.length && (
                            <span className="text-xs text-gray-400">
                                (de {requirements.length} total)
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        {sortOrder === 'desc' ? (
                            <>
                                <ArrowDown size={16} className="text-primary-600" />
                                Más reciente primero
                            </>
                        ) : (
                            <>
                                <ArrowUp size={16} className="text-primary-600" />
                                Más antiguo primero
                            </>
                        )}
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-20 text-center font-black uppercase text-gray-400 tracking-widest text-[10px]">Cargando requerimientos...</motion.div>
                    ) : filteredReqs.length === 0 ? (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-20 text-center font-black uppercase text-gray-400 tracking-widest text-[10px]">No se encontraron requerimientos</motion.div>
                    ) : (
                        <>
                            {viewMode === 'table' ? (
                                <>
                                    <motion.div
                                        key="table"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="hidden lg:block overflow-x-auto"
                                    >
                                        <table className="w-full">

                                            <thead className="bg-gray-50/50 dark:bg-slate-900/50">
                                                <tr className="border-b border-gray-100 dark:border-white/5">

                                                    <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Requerimiento</th>
                                                    {isAdmin && <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hidden xl:table-cell">Creado por</th>}
                                                    <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Presupuesto</th>
                                                    <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Categoría</th>
                                                    <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Monto</th>
                                                    <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Estado</th>
                                                    {canDelete && (
                                                        <th className="px-6 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-24">
                                                            <div className="flex items-center justify-end">
                                                                <input
                                                                    type="checkbox"
                                                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                                                    onChange={handleSelectAll}
                                                                    checked={requirements.length > 0 && selectedIds.length === requirements.length}
                                                                />
                                                            </div>
                                                        </th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                                {filteredReqs.map((req: any) => (
                                                    <tr
                                                        key={req.id}
                                                        onClick={() => router.push(`/requirements/${req.id}`)}
                                                        className="hover:bg-gray-50/80 dark:hover:bg-slate-700/30 transition-all cursor-pointer group border-b border-gray-50 dark:border-gray-800 last:border-0"
                                                    >


                                                        <td className="px-6 py-4">
                                                            <div className="flex items-start gap-4 text-left">
                                                                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 shrink-0">
                                                                    <FileText className="w-5 h-5" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-black text-gray-800 dark:text-gray-200 text-sm truncate max-w-[200px]">{req.title}</p>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <span className="text-[10px] font-bold text-blue-600">
                                                                            {req.groupId ? `#${req.groupId}` : `#${req.id.substring(0, 6)}`}
                                                                        </span>
                                                                        <span className="text-gray-300">|</span>
                                                                        <span className="text-[10px] text-gray-500">{new Date(req.createdAt).toLocaleDateString()}</span>
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${getStatusStyle(req.status)}`}>
                                                                            {getStatusLabel(req.status)}
                                                                        </span>
                                                                        {req.receivedAtSatisfaction && (
                                                                            <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 text-[9px] font-bold flex items-center gap-0.5">
                                                                                <CheckCircle size={10} /> Satisfecho
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {isAdmin && (
                                                            <td className="px-6 py-4 hidden xl:table-cell">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                                        <User size={12} className="text-gray-500" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold text-xs truncate max-w-[120px]">{req.createdBy?.name?.split(' ')[0] || 'Usuario'}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        )}

                                                        {/* Presupuesto Column */}
                                                        <td className="px-6 py-4">
                                                            <div className="space-y-1">
                                                                <div className="flex gap-1 flex-wrap">
                                                                    {req.project?.name && (
                                                                        <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/20 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                                                                            {req.project.name}
                                                                        </span>
                                                                    )}
                                                                    <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                                                                        {req.budget?.category?.name || req.area?.name || 'Sin categoría'}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] font-medium text-gray-400 truncate max-w-[150px]">
                                                                    {req.budget?.title || 'Sin presupuesto'}
                                                                </p>
                                                            </div>
                                                        </td>

                                                        {/* Categoria Column */}
                                                        <td className="px-6 py-4">
                                                            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                                                {req.reqCategory?.replace('_', ' ') || 'COMPRA'}
                                                            </span>
                                                        </td>

                                                        {/* Monto Column */}
                                                        <td className="px-6 py-4">
                                                            <p className="font-black text-sm text-gray-900 dark:text-white">
                                                                {req.actualAmount && parseFloat(req.actualAmount) > 0
                                                                    ? `$${parseFloat(req.actualAmount).toLocaleString()}`
                                                                    : <span className="text-gray-400 text-xs font-medium">Por definir</span>}
                                                            </p>
                                                        </td>

                                                        {/* Estado del Tramite Column */}
                                                        <td className="px-6 py-4">
                                                            {(() => {
                                                                const status = req.procurementStatus?.toUpperCase() || '';
                                                                let colorClass = 'text-gray-600 bg-gray-100 dark:bg-slate-800 dark:text-gray-300';

                                                                if (status.includes('PENDIENTE')) {
                                                                    colorClass = 'text-orange-600 bg-orange-50 dark:bg-orange-900/20';
                                                                } else if (status.includes('TRAMITE') || status.includes('PROCESO')) {
                                                                    colorClass = 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
                                                                } else if (status.includes('ENTREGADO')) {
                                                                    colorClass = 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
                                                                } else if (status.includes('FINALIZADO') || status.includes('COMPLETADO')) {
                                                                    colorClass = 'text-green-600 bg-green-50 dark:bg-green-900/20';
                                                                } else if (status.includes('ANULADO') || status.includes('CANCELADO')) {
                                                                    colorClass = 'text-red-600 bg-red-50 dark:bg-red-900/20';
                                                                }

                                                                return (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${colorClass}`}>
                                                                            {translateStatus(req.procurementStatus) || 'PENDIENTE'}
                                                                        </span>
                                                                        {req.receivedAtSatisfaction && (
                                                                            <span className="px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 text-[10px] font-bold flex items-center gap-0.5">
                                                                                <CheckCircle size={10} /> ✓
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>

                                                        {canDelete && (
                                                            <td className="px-6 py-4 text-right w-24" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center justify-end gap-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer w-4 h-4"
                                                                        checked={selectedIds.includes(req.id)}
                                                                        onChange={() => handleSelectOne(req.id)}
                                                                    />
                                                                    <button
                                                                        onClick={() => handleDeleteClick(req)}
                                                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
                                                                        title="Eliminar"
                                                                    >
                                                                    </button>
                                                                    <button
                                                                        onClick={() => router.push(`/requirements/new?sourceId=${req.id}`)}
                                                                        className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-300 hover:text-blue-500 rounded-lg transition-colors"
                                                                        title="Volver a Pedir (Duplicar)"
                                                                    >
                                                                        <Copy size={16} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </motion.div>
                                    <div className="lg:hidden space-y-4 p-4">
                                        {filteredReqs.map((req: any) => (
                                            <RequirementCard
                                                key={req.id}
                                                req={req}
                                                onClick={() => router.push(`/requirements/${req.id}`)}
                                                onDuplicate={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/requirements/new?sourceId=${req.id}`);
                                                }}
                                            />
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <motion.div
                                        key="grid"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                                    >
                                        {filteredReqs.map((req: any) => (
                                            <RequirementCard
                                                key={req.id}
                                                req={req}
                                                onClick={() => router.push(`/requirements/${req.id}`)}
                                                onDuplicate={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/requirements/new?sourceId=${req.id}`);
                                                }}
                                            />
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </>
                    )}
                </AnimatePresence>
            </div>

            {/* Bulk Actions Floating Bar */}
            <AnimatePresence>
                {selectedIds.length > 0 && isAdminOrLeader && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-slate-800 shadow-2xl rounded-2xl p-2 px-6 flex items-center gap-4 border border-gray-100 dark:border-gray-700"
                    >
                        <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                            {selectedIds.length} seleccionados
                        </span>
                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-600" />
                        <button
                            onClick={() => setIsBulkEditOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-sm transition-colors"
                        >
                            <FileSpreadsheet size={16} />
                            Editar Detalles
                        </button>
                        {canDelete && (
                            <button
                                onClick={() => setIsBulkDeleteOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg font-bold text-sm transition-colors"
                            >
                                <Trash2 size={16} />
                                Eliminar ({selectedIds.length})
                            </button>
                        )}
                        <button
                            onClick={() => setSelectedIds([])}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-500 transition-colors"
                        >
                            <XCircle size={18} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <BulkEditModal
                isOpen={isBulkEditOpen}
                onClose={() => setIsBulkEditOpen(false)}
                selectedIds={selectedIds}
                onSuccess={() => {
                    fetchRequirements();
                    setSelectedIds([]);
                }}
            />

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setDeleteModalOpen(false)}
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
                                    <Trash2 className="w-8 h-8 text-red-600" />
                                </div>
                                <h3 className="text-xl font-black mb-2">¿Eliminar requerimiento?</h3>
                                <p className="text-gray-500 text-sm">
                                    Esta acción no se puede deshacer. Se eliminará permanentemente el requerimiento:
                                </p>
                                <p className="font-bold text-primary-600 mt-2">
                                    &quot;{requirementToDelete?.title}&quot;
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setDeleteModalOpen(false)}
                                    className="flex-1 py-3 px-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    className="flex-1 py-3 px-6 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Bulk Delete Confirmation Modal */}
            <AnimatePresence>
                {isBulkDeleteOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => !isDeletingBulk && setIsBulkDeleteOpen(false)}
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
                                    <Trash2 className="w-8 h-8 text-red-600" />
                                </div>
                                <h3 className="text-xl font-black mb-2">¿Eliminar {selectedIds.length} requerimientos?</h3>
                                <p className="text-gray-500 text-sm">
                                    Esta acción eliminará permanentemente <strong>{selectedIds.length}</strong> elementos seleccionados. No se puede deshacer.
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setIsBulkDeleteOpen(false)}
                                    disabled={isDeletingBulk}
                                    className="flex-1 py-3 px-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmBulkDelete}
                                    disabled={isDeletingBulk}
                                    className="flex-1 py-3 px-6 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isDeletingBulk ? 'Eliminando...' : 'Eliminar Todo'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
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

function RequirementCard({ req, onClick, onDuplicate }: { req: Requirement, onClick: () => void, onDuplicate: (e: any) => void }) {
    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'APPROVED':
            case 'RECEIVED_SATISFACTION':
            case 'PAID':
                return 'bg-green-500 text-white';
            case 'REJECTED':
                return 'bg-red-500 text-white';
            case 'PENDING_APPROVAL':
            case 'PENDING_COORDINATION':
            case 'PENDING_FINANCE':
                return 'bg-amber-500 text-white';
            case 'APPROVED_FOR_PURCHASE':
            case 'PURCHASING':
            case 'DELIVERED':
                return 'bg-blue-500 text-white';
            default:
                return 'bg-gray-400 text-white';
        }
    };

    return (
        <motion.div
            whileHover={{ y: -5 }}
            onClick={onClick}
            className="bg-gray-50/50 dark:bg-slate-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 hover:border-primary-200 cursor-pointer transition-all group relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />

            <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
                    <FileText className="text-primary-600" size={24} />
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${getStatusStyle(req.status)}`}>
                        {translateStatus(req.status || 'PENDIENTE')}
                    </span>
                    {req.isAsiento && (
                        <span className="px-2 py-0.5 rounded outline outline-1 outline-purple-200 dark:outline-purple-800 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[8px] font-black uppercase tracking-wider">
                            Asiento
                        </span>
                    )}
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">
                        {req.groupId ? `Solicitud: #${req.groupId}` : `#${req.id?.substring(0, 8)}`}
                    </span>
                </div>
            </div>

            <h4 className="font-black text-lg leading-tight mb-2 group-hover:text-primary-600 transition-colors">{req.title}</h4>

            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <Building size={14} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-500">{req.project?.name || 'Sin Proyecto'}</span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <DollarSign size={14} className="text-primary-500" />
                        <span className="text-sm font-black">
                            {req.actualAmount && parseFloat(req.actualAmount) > 0
                                ? `$${parseFloat(req.actualAmount).toLocaleString()}`
                                : "Por definir"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-primary-600 font-black text-[10px] uppercase tracking-widest">
                        {(req.attachments && req.attachments.length > 0) && (
                            <div className="flex items-center gap-1 mr-2 text-gray-400">
                                <Paperclip size={12} />
                                <span>{req.attachments.length}</span>
                            </div>
                        )}
                        Ver más <ArrowRight size={12} />
                    </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                        <Package size={12} className="text-gray-400" />
                        <span className="text-[9px] font-black uppercase text-gray-400">Proveedor:</span>
                        <span className="text-[9px] font-black uppercase text-primary-600 truncate max-w-[100px]">
                            {req.supplier?.name || req.manualSupplierName || 'No definido'}
                        </span>
                    </div>
                    <button
                        onClick={onDuplicate}
                        className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-500 rounded-lg transition-colors"
                        title="Volver a Pedir"
                    >
                        <Copy size={14} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
