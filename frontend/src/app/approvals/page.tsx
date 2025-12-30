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
    budget: { category: { name: string }, amount: string };
}

interface Group {
    id: number;
    creator: { name: string; email: string };
    pdfUrl: string | null;
    createdAt: string;
    requirements: Requirement[];
}

export default function ApprovalsPage() {
    const { user } = useAuthStore();
    const { addToast } = useToastStore();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
    const [commentModal, setCommentModal] = useState<{ id: number, type: 'APPROVE' | 'REJECT' } | null>(null);
    const [comments, setComments] = useState('');
    const [processing, setProcessing] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'pending' | 'all'>('pending');

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const response = await api.get('/requirements/groups');
            setGroups(response.data);
        } catch (err: any) {
            console.error("Error fetching groups:", err);
            if (err.response?.status === 403) {
                addToast("No tienes permisos para ver las aprobaciones", "error");
            } else if (err.response?.status === 401) {
                addToast("Sesión expirada. Por favor inicia sesión nuevamente", "error");
            } else {
                addToast("Error al cargar las solicitudes", "error");
            }
        } finally {
            setLoading(false);
        }
    };

    // Only users with these roles can access approvals
    const userRole = user?.role?.toUpperCase() || 'USER';
    const canAccessApprovals = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR'].includes(userRole);

    useEffect(() => {
        if (canAccessApprovals) {
            fetchGroups();
        }
    }, [canAccessApprovals]);

    const handleAction = async () => {
        if (!commentModal) return;
        setProcessing(true);
        try {
            const endpoint = commentModal.type === 'APPROVE' ? `approve` : `reject`;
            await api.post(`/requirements/group/${commentModal.id}/${endpoint}`, {
                comments
            });
            addToast(`Solicitud ${commentModal.type === 'APPROVE' ? 'aprobada' : 'rechazada'} correctamente`, "success");
            setCommentModal(null);
            setComments('');
            fetchGroups();
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
        return 'PENDING';
    };

    const filteredGroups = groups.filter(g => {
        if (filterStatus === 'all') return true;
        return getGroupStatus(g) === 'PENDING';
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
                    <p className="text-gray-500 font-medium">Gestiona las solicitudes administrativas de compra.</p>
                </div>
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
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                    <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
                    <p className="text-gray-400 font-bold text-sm tracking-widest uppercase">Cargando solicitudes...</p>
                </div>
            ) : filteredGroups.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-20 text-center border border-gray-100 dark:border-gray-700 shadow-xl">
                    <div className="bg-green-50 dark:bg-green-900/20 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-green-600">
                        <CheckCircle size={40} />
                    </div>
                    <h3 className="text-2xl font-black mb-2">¡Todo al día!</h3>
                    <p className="text-gray-500 font-medium">No hay solicitudes pendientes que requieran tu atención.</p>
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
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${getGroupStatus(group) === 'PENDING' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600' : 'bg-green-100 dark:bg-green-900/20 text-green-600'}`}>
                                        <FileText size={28} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Solicitud #{group.id}</span>
                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${getGroupStatus(group) === 'PENDING' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                                                {getGroupStatus(group)}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-black">Compuesto por {group.requirements.length} ítems</h3>
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="flex items-center gap-2 text-xs text-gray-500 border-r border-gray-100 dark:border-gray-700 pr-4">
                                                <User size={14} className="text-primary-500" /> {group.creator.name}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <Calendar size={14} className="text-primary-500" /> {new Date(group.createdAt).toLocaleDateString()}
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
                                                                <div className="font-bold text-primary-600 text-xs">{req.budget.category.name}</div>
                                                                <div className="text-[10px] text-gray-400 mt-0.5">${parseFloat(req.budget.amount).toLocaleString()}</div>
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
            )}

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
                                Agrega un comentario para el historial y notificar al solicitante.
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
        </div>
    );
}
