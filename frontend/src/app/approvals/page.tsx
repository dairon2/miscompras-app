"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle, XCircle, Clock, FileText, User, Calendar,
    ChevronDown, ChevronUp, Download, MessageSquare, AlertCircle, Search, Filter
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { resolveApiUrl } from "@/lib/utils";

interface Requirement {
    id: string;
    title: string;
    description: string;
    quantity: string;
    status: string;
    leaderApproval: boolean | null;
    coordinatorApproval: boolean | null;
    directorApproval: boolean | null;
    project: { name: string };
    area: { name: string };
    budget?: { category: { name: string }, amount: string };
}

interface Group {
    id: number;
    creator: { name: string; email: string };
    pdfUrl: string | null;
    createdAt: string;
    requirements: Requirement[];
}

interface Adjustment {
    id: string;
    code: string;
    type: 'INCREASE' | 'TRANSFER';
    requestedAmount: string;
    reason: string;
    status: string;
    requestedAt: string;
    budget: {
        title: string;
        project: { name: string };
        area: { name: string };
        category?: { name: string };
    };
    requestedBy: { name: string };
    sources?: {
        amount: string;
        budget: { title: string };
    }[];
}

export default function ApprovalsPage() {
    const { user } = useAuthStore();
    const { addToast } = useToastStore();
    const [groups, setGroups] = useState<Group[]>([]);
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
    const [expandedAdj, setExpandedAdj] = useState<string | null>(null);
    const [commentModal, setCommentModal] = useState<{ id: number | string, type: 'APPROVE' | 'REJECT', isAdj?: boolean } | null>(null);
    const [comments, setComments] = useState('');
    const [processing, setProcessing] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'pending' | 'all'>('pending');
    const [activeTab, setActiveTab] = useState<'requirements' | 'budgets'>('requirements');
    const [years, setYears] = useState<number[]>([]);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const fetchYears = async () => {
        try {
            const res = await api.get('/requirements/years');
            if (res.data && res.data.length > 0) {
                setYears(res.data);
            } else {
                setYears([new Date().getFullYear()]);
            }
        } catch (err) {
            console.error("Error loading years:", err);
            setYears([new Date().getFullYear()]);
        }
    };

    useEffect(() => {
        fetchYears();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [groupsRes, adjRes] = await Promise.allSettled([
                api.get(`/requirements/groups?year=${selectedYear}`),
                api.get('/adjustments/pending')
            ]);

            if (groupsRes.status === 'fulfilled') {
                console.log('Groups data received:', groupsRes.value.data);
                const data = groupsRes.value.data;
                // Handle both array format and paginated response
                if (Array.isArray(data)) {
                    setGroups(data);
                } else if (data?.data && Array.isArray(data.data)) {
                    // If API returns paginated format, extract data
                    setGroups(data.data);
                } else {
                    console.warn('Unexpected groups format:', data);
                    setGroups([]);
                }
            } else {
                console.error("Error fetching groups:", groupsRes.reason);
                addToast("Error al cargar requerimientos", "error");
            }

            if (adjRes.status === 'fulfilled') {
                const adjData = adjRes.value.data;
                if (Array.isArray(adjData)) {
                    setAdjustments(adjData);
                } else if (adjData?.data && Array.isArray(adjData.data)) {
                    setAdjustments(adjData.data);
                } else {
                    setAdjustments([]);
                }
            } else {
                console.error("Error fetching adjustments:", adjRes.reason);
                // Adjustments might fail if user is not ADMIN/DIRECTOR, that's fine for some
                if (adjRes.reason.response?.status !== 403) {
                    addToast("Error al cargar ajustes de presupuesto", "error");
                }
            }
        } catch (err: any) {
            console.error("General error fetching data:", err);
            addToast("Error general al cargar el panel", "error");
        } finally {
            setLoading(false);
        }
    };

    // Only users with these roles can access approvals
    const userRole = user?.role?.toUpperCase() || 'USER';
    const canAccessApprovals = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR'].includes(userRole);
    const canApproveBudgets = ['ADMIN', 'DIRECTOR', 'DEVELOPER'].includes(userRole);

    useEffect(() => {
        if (canAccessApprovals) {
            fetchData();
        }
    }, [canAccessApprovals, selectedYear]);

    const handleAction = async () => {
        if (!commentModal) return;
        setProcessing(true);
        try {
            if (commentModal.isAdj) {
                const endpoint = commentModal.type === 'APPROVE' ? 'approve' : 'reject';
                await api.patch(`/adjustments/${commentModal.id}/${endpoint}`, {
                    comment: comments
                });
                addToast(`Ajuste ${commentModal.type === 'APPROVE' ? 'aprobado' : 'rechazado'} correctamente`, "success");
            } else {
                const endpoint = commentModal.type === 'APPROVE' ? 'approve' : 'reject';
                await api.post(`/requirements/group/${commentModal.id}/${endpoint}`, {
                    comments
                });
                addToast(`Solicitud ${commentModal.type === 'APPROVE' ? 'aprobada' : 'rechazada'} correctamente`, "success");
            }
            setCommentModal(null);
            setComments('');
            fetchData();
        } catch (err: any) {
            addToast("Error al procesar la solicitud", "error");
        } finally {
            setProcessing(false);
        }
    };

    const getGroupStatus = (group: Group) => {
        const statuses = group.requirements.map(r => r.status);
        if (statuses.includes('REJECTED')) return 'REJECTED';
        if (statuses.every(s => s === 'APPROVED')) return 'APPROVED';
        // Match the actual enum value from the database
        return 'PENDING_APPROVAL';
    };

    const filteredGroups = groups.filter(g => {
        if (filterStatus === 'all') return true;
        const status = getGroupStatus(g);
        return status === 'PENDING_APPROVAL' || !['APPROVED', 'REJECTED'].includes(status);
    });

    const filteredAdjustments = adjustments.filter(adj => {
        if (filterStatus === 'all') return true;
        return adj.status === 'PENDING';
    });

    // Show access denied if user doesn't have permission
    if (!canAccessApprovals) {
        return (
            <div className="p-6 lg:p-12 max-w-6xl mx-auto">
                <div className="flex flex-col items-center justify-center py-40 gap-6 text-center">
                    <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                        <XCircle className="text-red-500" size={40} />
                    </div>
                    <h2 className="text-2xl font-black">Acceso Denegado</h2>
                    <p className="text-gray-500">No tienes permisos para acceder al panel de aprobaciones.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-12 max-w-6xl mx-auto">
            <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2">Panel de Aprobaciones</h1>
                    <p className="text-gray-500 font-medium">Gestiona las solicitudes administrativas de compra y ajustes.</p>
                </div>
                <div className="flex flex-col gap-4">
                    <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setFilterStatus('pending')}
                            className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${filterStatus === 'pending' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-gray-400'}`}
                        >
                            PENDIENTES
                        </button>
                        <button
                            onClick={() => setFilterStatus('all')}
                            className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${filterStatus === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-gray-400'}`}
                        >
                            TODAS
                        </button>
                    </div>

                    <div className="relative">
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="w-full bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-bold py-2 px-4 pr-8 rounded-xl border border-gray-200 dark:border-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
                        >
                            {years.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <ChevronDown size={14} />
                        </div>
                    </div>
                </div >
            </header >

            {/* Tabs */}
            < div className="flex gap-8 border-b border-gray-100 dark:border-gray-800 mb-8" >
                <button
                    onClick={() => setActiveTab('requirements')}
                    className={`pb-4 text-sm font-black tracking-widest uppercase transition-all relative ${activeTab === 'requirements' ? 'text-primary-600' : 'text-gray-400'}`}
                >
                    Requerimientos ({filteredGroups.length})
                    {activeTab === 'requirements' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-primary-600 rounded-t-full" />}
                </button>
                {
                    canApproveBudgets && (
                        <button
                            onClick={() => setActiveTab('budgets')}
                            className={`pb-4 text-sm font-black tracking-widest uppercase transition-all relative ${activeTab === 'budgets' ? 'text-primary-600' : 'text-gray-400'}`}
                        >
                            Presupuestos ({filteredAdjustments.length})
                            {activeTab === 'budgets' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-primary-600 rounded-t-full" />}
                        </button>
                    )
                }
            </div >

            {
                loading ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-4" >
                        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
                        <p className="text-gray-400 font-bold text-sm tracking-widest uppercase">Cargando solicitudes...</p>
                    </div>
                ) : (activeTab === 'requirements' ? (
                    filteredGroups.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-20 text-center border border-gray-100 dark:border-gray-700 shadow-xl">
                            <div className="bg-green-50 dark:bg-green-900/20 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-green-600">
                                <CheckCircle size={40} />
                            </div>
                            <h3 className="text-2xl font-black mb-2">¡Todo al día!</h3>
                            <p className="text-gray-500 font-medium">No hay requerimientos pendientes que requieran tu atención.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {filteredGroups.map(group => (
                                <motion.div
                                    key={group.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`bg-white dark:bg-slate-800 rounded-[2.5rem] border overflow-hidden shadow-lg transition-all ${expandedGroup === group.id ? 'ring-2 ring-primary-500' : 'border-gray-100 dark:border-gray-700'}`}
                                >
                                    {/* Group Header */}
                                    <div className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 cursor-pointer" onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}>
                                        <div className="flex items-center gap-6">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${getGroupStatus(group) === 'PENDING_APPROVAL' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600' : 'bg-green-100 dark:bg-green-900/20 text-green-600'}`}>
                                                <FileText size={28} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Solicitud #{group.id}</span>
                                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${getGroupStatus(group) === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                                                        {getGroupStatus(group)}
                                                    </span>
                                                </div>
                                                <h3 className="text-xl font-black">Compuesto por {group.requirements.length} ítems</h3>
                                                <div className="flex items-center gap-4 mt-2">
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 border-r border-gray-100 dark:border-gray-700 pr-4">
                                                        <User size={14} className="text-primary-500" /> {group.creator.name}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <Clock size={14} className="text-primary-500" /> {new Date(group.createdAt).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                            {group.pdfUrl && (
                                                <a
                                                    href={resolveApiUrl(group.pdfUrl)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl text-gray-400 hover:text-red-500 transition-colors border border-gray-100 dark:border-gray-700"
                                                    title="Descargar PDF Administrativo"
                                                >
                                                    <Download size={20} />
                                                </a>
                                            ) || (
                                                    <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl text-gray-300 border border-gray-100 dark:border-gray-700 italic text-[10px] font-bold">
                                                        PDF No Disponible
                                                    </div>
                                                )}
                                            <button
                                                onClick={() => setCommentModal({ id: group.id, type: 'REJECT' })}
                                                className="px-6 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-xs hover:bg-red-100 transition-colors uppercase tracking-widest"
                                            >
                                                Rechazar
                                            </button>
                                            <button
                                                onClick={() => setCommentModal({ id: group.id, type: 'APPROVE' })}
                                                className="px-6 py-4 bg-primary-600 text-white rounded-2xl font-black text-xs hover:bg-primary-700 shadow-lg shadow-primary-500/20 transition-all uppercase tracking-widest"
                                            >
                                                Aprobar
                                            </button>
                                            <div className="ml-4 p-2 text-gray-400">
                                                {expandedGroup === group.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Group Detail (Expanded) */}
                                    <AnimatePresence>
                                        {expandedGroup === group.id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="bg-gray-50/50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-gray-700"
                                            >
                                                <div className="p-8 overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-700">
                                                                <th className="pb-4 px-4 w-1/3">Ítem / Descripción</th>
                                                                <th className="pb-4 px-4">Proyecto / Área</th>
                                                                <th className="pb-4 px-4">Presupuesto</th>
                                                                <th className="pb-4 px-4">Cant.</th>
                                                                <th className="pb-4 px-4 text-center">Estado</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {group.requirements.map((req, idx) => (
                                                                <tr key={req.id} className={`${idx !== group.requirements.length - 1 ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}>
                                                                    <td className="py-6 px-4">
                                                                        <div className="font-black text-gray-800 dark:text-gray-200">{req.title}</div>
                                                                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">{req.description}</div>
                                                                    </td>
                                                                    <td className="py-6 px-4">
                                                                        <div className="font-bold text-xs">{req.project.name}</div>
                                                                        <div className="text-[10px] text-gray-400 mt-0.5">{req.area.name}</div>
                                                                    </td>
                                                                    <td className="py-6 px-4">
                                                                        <div className="font-bold text-primary-600 text-xs">{req.budget?.category?.name || 'Sin presupuesto'}</div>
                                                                        <div className="text-[10px] text-gray-400 mt-0.5">{req.budget ? `$${parseFloat(req.budget.amount).toLocaleString()}` : 'N/A'}</div>
                                                                    </td>
                                                                    <td className="py-6 px-4">
                                                                        <span className="bg-white dark:bg-slate-800 px-2 py-1 rounded text-[10px] font-black border border-gray-100 dark:border-gray-700">{req.quantity || '1'}</span>
                                                                    </td>
                                                                    <td className="py-6 px-4 text-center">
                                                                        <div className="flex justify-center gap-2">
                                                                            <div title="Líder" className={`w-3 h-3 rounded-full ${req.leaderApproval ? 'bg-green-500' : req.leaderApproval === false ? 'bg-red-500' : 'bg-gray-200'}`}></div>
                                                                            <div title="Coordinador" className={`w-3 h-3 rounded-full ${req.coordinatorApproval ? 'bg-green-500' : req.coordinatorApproval === false ? 'bg-red-500' : 'bg-gray-200'}`}></div>
                                                                            <div title="Dirección" className={`w-3 h-3 rounded-full ${req.directorApproval ? 'bg-green-500' : req.directorApproval === false ? 'bg-red-500' : 'bg-gray-200'}`}></div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            ))}
                        </div>
                    )
                ) : (
                    filteredAdjustments.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-20 text-center border border-gray-100 dark:border-gray-700 shadow-xl">
                            <div className="bg-green-50 dark:bg-green-900/20 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-green-600">
                                <CheckCircle size={40} />
                            </div>
                            <h3 className="text-2xl font-black mb-2">¡Todo al día!</h3>
                            <p className="text-gray-500 font-medium">No hay ajustes de presupuesto pendientes.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {filteredAdjustments.map(adj => (
                                <motion.div
                                    key={adj.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`bg-white dark:bg-slate-800 rounded-[2.5rem] border overflow-hidden shadow-lg transition-all ${expandedAdj === adj.id ? 'ring-2 ring-primary-500' : 'border-gray-100 dark:border-gray-700'}`}
                                >
                                    <div className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 cursor-pointer" onClick={() => setExpandedAdj(expandedAdj === adj.id ? null : adj.id)}>
                                        <div className="flex items-center gap-6">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${adj.type === 'INCREASE' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600' : 'bg-purple-100 dark:bg-purple-900/20 text-purple-600'}`}>
                                                <AlertCircle size={28} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ajuste {adj.code}</span>
                                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${adj.type === 'INCREASE' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                                        {adj.type === 'INCREASE' ? 'Aumento' : 'Movimiento'}
                                                    </span>
                                                </div>
                                                <h3 className="text-xl font-black">{adj.budget.title}</h3>
                                                <div className="flex items-center gap-4 mt-2">
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 border-r border-gray-100 dark:border-gray-700 pr-4">
                                                        <span className="font-black text-primary-600">${parseFloat(adj.requestedAmount).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 border-r border-gray-100 dark:border-gray-700 pr-4">
                                                        <User size={14} className="text-primary-500" /> {adj.requestedBy.name}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <Clock size={14} className="text-primary-500" /> {new Date(adj.requestedAt).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => setCommentModal({ id: adj.id, type: 'REJECT', isAdj: true })}
                                                className="px-6 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-xs hover:bg-red-100 transition-colors uppercase tracking-widest"
                                            >
                                                Rechazar
                                            </button>
                                            <button
                                                onClick={() => setCommentModal({ id: adj.id, type: 'APPROVE', isAdj: true })}
                                                className="px-6 py-4 bg-primary-600 text-white rounded-2xl font-black text-xs hover:bg-primary-700 shadow-lg shadow-primary-500/20 transition-all uppercase tracking-widest"
                                            >
                                                Aprobar
                                            </button>
                                            <div className="ml-4 p-2 text-gray-400">
                                                {expandedAdj === adj.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {expandedAdj === adj.id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="bg-gray-50/50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-gray-700 p-8"
                                            >
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Motivo del Ajuste</p>
                                                        <p className="text-sm font-medium bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">{adj.reason}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Detalles de Ubicación</p>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between text-xs"><span className="text-gray-400">Proyecto:</span> <span className="font-bold">{adj.budget.project.name}</span></div>
                                                            <div className="flex justify-between text-xs"><span className="text-gray-400">Área:</span> <span className="font-bold">{adj.budget.area.name}</span></div>
                                                            <div className="flex justify-between text-xs"><span className="text-gray-400">Categoría:</span> <span className="font-bold">{adj.budget.category?.name || 'N/A'}</span></div>
                                                        </div>
                                                    </div>
                                                    {adj.type === 'TRANSFER' && adj.sources && (
                                                        <div className="md:col-span-2">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Presupuestos de Origen (Descuento)</p>
                                                            <div className="space-y-2">
                                                                {adj.sources.map((s, i) => (
                                                                    <div key={i} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                                                        <span className="text-xs font-bold">{s.budget.title}</span>
                                                                        <span className="text-xs font-black text-red-500">-${parseFloat(s.amount).toLocaleString()}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            ))}
                        </div>
                    )
                ))
            }

            {/* Comment Modal */}
            <AnimatePresence>
                {commentModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl"
                        >
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-8 ${commentModal.type === 'APPROVE' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                {commentModal.type === 'APPROVE' ? <CheckCircle size={32} /> : <XCircle size={32} />}
                            </div>
                            <h2 className="text-3xl font-black mb-2">
                                {commentModal.type === 'APPROVE' ? 'Confirmar Aprobación' : 'Rechazar Solicitud'}
                            </h2>
                            <p className="text-gray-500 font-medium mb-8">
                                Agrega un comentario para el historial {commentModal.isAdj ? 'del ajuste' : 'de la solicitud'}.
                            </p>

                            <textarea
                                value={comments}
                                onChange={e => setComments(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl p-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium mb-8"
                                placeholder="Escribe tus observaciones aquí..."
                                rows={4}
                            />

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setCommentModal(null)}
                                    className="flex-1 py-5 rounded-2xl font-black text-gray-400 hover:bg-gray-50 transition-colors uppercase text-xs tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAction}
                                    disabled={processing}
                                    className={`flex-1 py-5 rounded-2xl font-black text-white shadow-xl transition-all uppercase text-xs tracking-widest ${commentModal.type === 'APPROVE' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'}`}
                                >
                                    {processing ? 'Procesando...' : commentModal.type === 'APPROVE' ? 'Confirmar' : 'Confirmar Rechazo'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
