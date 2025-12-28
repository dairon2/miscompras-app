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
    Package,
    Download,
    Calendar,
    FileSpreadsheet,
    User,
    Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { exportRequirements } from "@/lib/excelExport";
import { useAuthStore } from "@/store/authStore";

interface Requirement {
    id: string;
    title: string;
    description?: string;
    status: string;
    actualAmount?: string;
    project?: { name: string };
    area?: { name: string };
    supplier?: { name: string };
    manualSupplierName?: string;
    createdAt: string;
}

export default function RequirementsPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [requirements, setRequirements] = useState<Requirement[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [searchTerm, setSearchTerm] = useState('');
    const [projects, setProjects] = useState([]);
    const [areas, setAreas] = useState([]);
    const [users, setUsers] = useState([]);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [requirementToDelete, setRequirementToDelete] = useState<any>(null);

    // Year filter - default to current year
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

    const [filters, setFilters] = useState({
        status: '',
        procurementStatus: '',
        areaId: '',
        createdById: '',
        projectId: '',
        startDate: '',
        endDate: ''
    });

    // Role-based permissions
    const userRole = user?.role || 'USER';
    const isAdmin = ['ADMIN', 'DIRECTOR', 'LEADER'].includes(userRole);
    const canDelete = ['ADMIN', 'DIRECTOR'].includes(userRole);

    useEffect(() => {
        fetchRequirements();
        fetchCatalogs();
    }, [userRole, selectedYear]);

    const fetchRequirements = async () => {
        try {
            // Admins/Directors/Leaders see all requirements, Users see only their own
            const endpoint = isAdmin ? "/requirements/all" : "/requirements/me";
            const response = await api.get(endpoint, {
                params: { year: selectedYear }
            });
            setRequirements(response.data);
        } catch (err) {
            console.error("Error fetching requirements", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCatalogs = async () => {
        try {
            const [p, a, u] = await Promise.all([
                api.get('/projects'),
                api.get('/areas'),
                api.get('/users')
            ]);
            setProjects(p.data);
            setAreas(a.data);
            setUsers(u.data);
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
        } catch (err) {
            console.error("Error deleting requirement", err);
            alert("Error al eliminar el requerimiento");
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
        const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProc = !filters.procurementStatus || r.procurementStatus === filters.procurementStatus;
        const matchesArea = !filters.areaId || r.areaId === filters.areaId;
        const matchesUser = !filters.createdById || r.createdById === filters.createdById;
        const matchesProject = !filters.projectId || r.projectId === filters.projectId;

        // Date range filter
        const createdAt = new Date(r.createdAt);
        const start = filters.startDate ? new Date(filters.startDate) : null;
        let end = filters.endDate ? new Date(filters.endDate) : null;

        if (end) end.setHours(23, 59, 59, 999);

        const matchesDate = (!start || createdAt >= start) && (!end || createdAt <= end);

        return matchesSearch && matchesProc && matchesArea && matchesUser && matchesProject && matchesDate;
    });

    return (
        <div className="p-6 lg:p-12 max-w-7xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
            >
                <div className="flex items-center gap-6">
                    <div>
                        <h2 className="text-4xl font-black tracking-tight mb-2">Solicitudes de Compra</h2>
                        <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.2em]">Gestión Institucional de Requerimientos</p>
                    </div>

                    {/* Year Selector */}
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <Calendar size={18} className="text-primary-600" />
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="bg-transparent font-black text-lg appearance-none cursor-pointer pr-8 focus:outline-none text-slate-800 dark:text-white"
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-bold">{year}</option>
                            ))}
                        </select>
                        {selectedYear !== currentYear && (
                            <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                                Histórico
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            try {
                                exportRequirements(filteredReqs);
                            } catch (error) {
                                console.error('Error al exportar:', error);
                                alert('Error al generar el archivo Excel');
                            }
                        }}
                        className="flex items-center gap-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 px-6 py-4 rounded-2xl font-black shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all uppercase text-[10px] tracking-widest"
                    >
                        <FileSpreadsheet size={18} className="text-green-600" />
                        <Download size={18} className="text-primary-600" />
                        <span>EXPORTAR XLSX</span>
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
                    <button
                        onClick={() => router.push('/requirements/new')}
                        className="flex items-center gap-2 bg-primary-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg hover:bg-primary-700 hover:-translate-y-1 transition-all active:scale-95 whitespace-nowrap uppercase text-[10px] tracking-widest"
                    >
                        <Plus className="w-5 h-5" />
                        Nueva Solicitud
                    </button>
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
                            placeholder="Buscar por título o ID de requerimiento..."
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
                            value={filters.areaId}
                            onChange={(e) => setFilters({ ...filters, areaId: e.target.value })}
                            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-xl py-2 px-4 outline-none focus:ring-2 focus:ring-primary-500 font-bold text-xs"
                        >
                            <option value="">Todas las Categorías (Áreas)</option>
                            {areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>

                        <select
                            value={filters.createdById}
                            onChange={(e) => setFilters({ ...filters, createdById: e.target.value })}
                            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-xl py-2 px-4 outline-none focus:ring-2 focus:ring-primary-500 font-bold text-xs"
                        >
                            <option value="">Todos los Líderes</option>
                            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                        </select>

                        <select
                            value={filters.projectId}
                            onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
                            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-xl py-2 px-4 outline-none focus:ring-2 focus:ring-primary-500 font-bold text-xs"
                        >
                            <option value="">Todos los Presupuestos (Proyectos)</option>
                            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
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

                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-20 text-center font-black uppercase text-gray-400 tracking-widest text-[10px]">Cargando solicitudes...</motion.div>
                    ) : filteredReqs.length === 0 ? (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-20 text-center font-black uppercase text-gray-400 tracking-widest text-[10px]">No se encontraron solicitudes</motion.div>
                    ) : viewMode === 'table' ? (
                        <motion.div
                            key="table"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="overflow-x-auto"
                        >
                            <table className="w-full">
                                <thead className="bg-gray-50/50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Solicitud</th>
                                        {isAdmin && <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Creado por</th>}
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Proyecto / Área</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Monto</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Estado Trámite</th>
                                        <th className="px-6 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                    {filteredReqs.map((req: any) => (
                                        <tr key={req.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors group">
                                            <td className="px-6 py-6">
                                                <div className="flex items-center gap-4 text-left">
                                                    <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-gray-800 dark:text-gray-200 tracking-tight">{req.title}</p>
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">ID: {req.id.substring(0, 8)}</p>
                                                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mt-2 flex justify-between items-center">
                                                            <span>Estado Solicitud:</span>
                                                            <span className={`px-2 py-0.5 rounded-full border ${getStatusStyle(req.status)}`}>{getStatusLabel(req.status)}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            {isAdmin && (
                                                <td className="px-6 py-6 text-left">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                                            <User size={14} className="text-primary-600" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-xs">{req.createdBy?.name || 'N/A'}</p>
                                                            <p className="text-[9px] text-gray-400">{req.createdBy?.email || ''}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            )}
                                            <td className="px-6 py-6 text-left">
                                                <p className="font-bold text-xs">{req.project?.name}</p>
                                                <p className="text-[10px] font-bold text-gray-400">{req.area?.name}</p>
                                            </td>
                                            <td className="px-6 py-6 text-left font-black text-sm">
                                                {req.actualAmount && parseFloat(req.actualAmount) > 0
                                                    ? `$${parseFloat(req.actualAmount).toLocaleString()}`
                                                    : <span className="text-gray-400 font-medium">Por definir</span>}
                                            </td>
                                            <td className="px-6 py-6 text-left">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${getProcStatusStyle(req.procurementStatus)}`}>
                                                    {req.procurementStatus || 'PENDIENTE'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => router.push(`/requirements/${req.id}`)}
                                                        className="p-3 bg-white dark:bg-slate-800 hover:bg-primary-600 hover:text-white rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all"
                                                        title="Ver detalle"
                                                    >
                                                        <ChevronRight size={16} />
                                                    </button>
                                                    {canDelete && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteClick(req);
                                                            }}
                                                            className="p-3 bg-white dark:bg-slate-800 hover:bg-red-600 hover:text-white rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all text-red-500"
                                                            title="Eliminar requerimiento"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="grid"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {filteredReqs.map((req: any) => (
                                <RequirementCard key={req.id} req={req} onClick={() => router.push(`/requirements/${req.id}`)} />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

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
        </div >
    );
}

function RequirementCard({ req, onClick }: { req: Requirement, onClick: () => void }) {
    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'RECEIVED_SATISFACTION':
            case 'PAID': return 'bg-green-500 text-white';
            case 'REJECTED': return 'bg-red-500 text-white';
            case 'PENDING_COORDINATION':
            case 'PENDING_FINANCE': return 'bg-yellow-500 text-white';
            case 'APPROVED_FOR_PURCHASE':
            case 'PURCHASING':
            case 'DELIVERED': return 'bg-blue-500 text-white';
            default: return 'bg-gray-400 text-white';
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
                        {req.status?.replace('_', ' ') || 'PENDIENTE'}
                    </span>
                    <span className="text-[10px] font-black text-gray-300 uppercase">#{req.id?.substring(0, 8)}</span>
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
                        Ver más <ArrowRight size={12} />
                    </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                    <Package size={12} className="text-gray-400" />
                    <span className="text-[9px] font-black uppercase text-gray-400">Proveedor:</span>
                    <span className="text-[9px] font-black uppercase text-primary-600 truncate max-w-[100px]">
                        {req.supplier?.name || req.manualSupplierName || 'No definido'}
                    </span>
                </div>
            </div>
        </motion.div>
    );
}
