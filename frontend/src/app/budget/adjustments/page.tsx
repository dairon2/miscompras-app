"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FileText, Check, X, Clock, TrendingUp, ArrowRight,
    User, Calendar, DollarSign, ChevronDown, AlertTriangle,
    FileCheck, FileX, ArrowRightCircle, Filter
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { useRouter } from "next/navigation";

interface Adjustment {
    id: string;
    code?: string;
    type: 'INCREASE' | 'TRANSFER';
    requestedAmount: number;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    documentUrl?: string;
    budget: {
        id: string;
        title: string;
        code?: string;
        amount: number;
        available: number;
        project: { name: string };
        area: { name: string };
        category?: { name: string; code: string };
    };
    sources?: Array<{
        budget: { id: string; title: string; available: number };
        amount: number;
    }>;
    requestedBy: { id: string; name: string; email: string };
    reviewedBy?: { id: string; name: string };
    requestedAt: string;
    reviewedAt?: string;
    reviewComment?: string;
}

export default function AdjustmentsPage() {
    const { user } = useAuthStore();
    const { addToast } = useToastStore();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const userRole = user?.role?.toUpperCase() || 'USER';
    const isDirector = userRole === 'DIRECTOR';

    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('all');

    // Detail modal
    const [selectedAdjustment, setSelectedAdjustment] = useState<Adjustment | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Processing
    const [processing, setProcessing] = useState(false);
    const [rejectComment, setRejectComment] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);

    useEffect(() => {
        if (!isDirector) {
            router.push('/budget');
            return;
        }
        fetchAdjustments();
    }, [isDirector, filter]);

    const fetchAdjustments = async () => {
        setLoading(true);
        try {
            const endpoint = filter === 'PENDING' ? '/adjustments/pending' : '/adjustments';
            const params = filter !== 'all' && filter !== 'PENDING' ? `?status=${filter}` : '';
            const res = await api.get(`${endpoint}${params}`);
            setAdjustments(res.data);
        } catch (err) {
            console.error("Error fetching adjustments:", err);
            addToast('Error al cargar solicitudes', 'error');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

    const formatDate = (dateStr: string) =>
        new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateStr));

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-black flex items-center gap-1"><Check size={12} />Aprobado</span>;
            case 'REJECTED':
                return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-black flex items-center gap-1"><X size={12} />Rechazado</span>;
            default:
                return <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-black flex items-center gap-1"><Clock size={12} />Pendiente</span>;
        }
    };

    const getTypeBadge = (type: string) => {
        if (type === 'TRANSFER') {
            return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-[10px] font-black flex items-center gap-1"><ArrowRightCircle size={12} />Movimiento</span>;
        }
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black flex items-center gap-1"><TrendingUp size={12} />Aumento</span>;
    };

    const handleApprove = async (adjustment: Adjustment) => {
        setProcessing(true);
        try {
            await api.patch(`/adjustments/${adjustment.id}/approve`);
            addToast('Solicitud aprobada y aplicada exitosamente', 'success');
            fetchAdjustments();
            setShowDetailModal(false);
        } catch (err: any) {
            addToast(err.response?.data?.error || 'Error al aprobar', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedAdjustment) return;
        setProcessing(true);
        try {
            await api.patch(`/adjustments/${selectedAdjustment.id}/reject`, {
                comment: rejectComment || 'Rechazado sin comentarios'
            });
            addToast('Solicitud rechazada', 'success');
            fetchAdjustments();
            setShowRejectModal(false);
            setShowDetailModal(false);
            setRejectComment('');
        } catch (err: any) {
            addToast(err.response?.data?.error || 'Error al rechazar', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const pendingCount = adjustments.filter(a => a.status === 'PENDING').length;

    if (!mounted || !isDirector) return null;

    return (
        <div className="p-6 lg:p-12 max-w-7xl mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
            >
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg">
                        <FileText size={28} />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black tracking-tight">Solicitudes de Ajuste</h2>
                        <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.2em]">
                            {pendingCount > 0 ? `${pendingCount} Pendiente(s)` : 'Control de Presupuesto'}
                        </p>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex bg-gray-100 dark:bg-slate-800 rounded-2xl p-1">
                    {[
                        { value: 'all', label: 'Todas' },
                        { value: 'PENDING', label: 'Pendientes' },
                        { value: 'APPROVED', label: 'Aprobadas' },
                        { value: 'REJECTED', label: 'Rechazadas' }
                    ].map(tab => (
                        <button
                            key={tab.value}
                            onClick={() => setFilter(tab.value as any)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === tab.value ? 'bg-white dark:bg-slate-700 shadow-sm' : 'hover:bg-white/50'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Stats */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
            >
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Solicitudes</span>
                        <FileText className="text-gray-400" size={18} />
                    </div>
                    <p className="text-3xl font-black">{adjustments.length}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-6 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Pendientes</span>
                        <Clock className="text-amber-500" size={18} />
                    </div>
                    <p className="text-3xl font-black text-amber-600">{adjustments.filter(a => a.status === 'PENDING').length}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-green-600">Aprobadas</span>
                        <FileCheck className="text-green-500" size={18} />
                    </div>
                    <p className="text-3xl font-black text-green-600">{adjustments.filter(a => a.status === 'APPROVED').length}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Rechazadas</span>
                        <FileX className="text-red-500" size={18} />
                    </div>
                    <p className="text-3xl font-black text-red-600">{adjustments.filter(a => a.status === 'REJECTED').length}</p>
                </div>
            </motion.div>

            {/* Adjustments List */}
            {loading ? (
                <div className="text-center py-20">
                    <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400 font-bold">Cargando solicitudes...</p>
                </div>
            ) : adjustments.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-gray-700">
                    <FileText className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-gray-400 font-bold">No hay solicitudes {filter !== 'all' ? 'con este estado' : ''}</p>
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-4"
                >
                    {adjustments.map((adjustment) => (
                        <div
                            key={adjustment.id}
                            onClick={() => { setSelectedAdjustment(adjustment); setShowDetailModal(true); }}
                            className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border-2 cursor-pointer transition-all hover:shadow-lg ${adjustment.status === 'PENDING' ? 'border-amber-300 dark:border-amber-700' : 'border-gray-100 dark:border-gray-700'
                                }`}
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${adjustment.status === 'PENDING' ? 'bg-amber-100 text-amber-600' :
                                            adjustment.status === 'APPROVED' ? 'bg-green-100 text-green-600' :
                                                'bg-red-100 text-red-600'
                                        }`}>
                                        {adjustment.type === 'INCREASE' ? <TrendingUp size={24} /> : <ArrowRightCircle size={24} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold">{adjustment.code || 'Sin código'}</span>
                                            {getTypeBadge(adjustment.type)}
                                            {getStatusBadge(adjustment.status)}
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                            <span className="font-bold">{adjustment.budget.title}</span> • {adjustment.budget.project.name}
                                        </p>
                                        <div className="flex items-center gap-4 text-xs text-gray-400">
                                            <span className="flex items-center gap-1"><User size={12} />{adjustment.requestedBy.name}</span>
                                            <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(adjustment.requestedAt)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Monto Solicitado</span>
                                        <span className="text-xl font-black text-primary-600">{formatCurrency(adjustment.requestedAmount)}</span>
                                    </div>

                                    {adjustment.status === 'PENDING' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleApprove(adjustment); }}
                                                className="p-3 bg-green-100 text-green-600 hover:bg-green-200 rounded-xl transition-all"
                                                title="Aprobar"
                                            >
                                                <Check size={20} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedAdjustment(adjustment);
                                                    setShowRejectModal(true);
                                                }}
                                                className="p-3 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl transition-all"
                                                title="Rechazar"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Transfer sources preview */}
                            {adjustment.type === 'TRANSFER' && adjustment.sources && adjustment.sources.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Origen de fondos:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {adjustment.sources.map((source, idx) => (
                                            <span key={idx} className="px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold">
                                                {source.budget.title}: {formatCurrency(source.amount)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </motion.div>
            )}

            {/* Detail Modal */}
            <AnimatePresence>
                {showDetailModal && selectedAdjustment && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setShowDetailModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl font-black">{selectedAdjustment.code || 'Solicitud'}</span>
                                        {getTypeBadge(selectedAdjustment.type)}
                                        {getStatusBadge(selectedAdjustment.status)}
                                    </div>
                                    <p className="text-gray-500">{selectedAdjustment.budget.title}</p>
                                </div>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-2 hover:bg-gray-100 rounded-xl"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 dark:bg-slate-900 rounded-2xl p-4">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Monto Solicitado</span>
                                    <span className="text-2xl font-black text-primary-600">{formatCurrency(selectedAdjustment.requestedAmount)}</span>
                                </div>
                                <div className="bg-gray-50 dark:bg-slate-900 rounded-2xl p-4">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Presupuesto Destino</span>
                                    <span className="font-bold">{selectedAdjustment.budget.title}</span>
                                    <span className="text-sm text-gray-400 block">Disponible: {formatCurrency(selectedAdjustment.budget.available)}</span>
                                </div>
                            </div>

                            {/* Sources */}
                            {selectedAdjustment.type === 'TRANSFER' && selectedAdjustment.sources && (
                                <div className="mb-6">
                                    <span className="text-xs font-black uppercase tracking-widest text-gray-400 block mb-3">Presupuestos de Origen</span>
                                    <div className="space-y-2">
                                        {selectedAdjustment.sources.map((source, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                                                <span className="font-bold">{source.budget.title}</span>
                                                <span className="text-purple-600 font-bold">- {formatCurrency(source.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Reason */}
                            <div className="mb-6">
                                <span className="text-xs font-black uppercase tracking-widest text-gray-400 block mb-2">Motivo</span>
                                <p className="bg-gray-50 dark:bg-slate-900 rounded-2xl p-4 text-gray-700 dark:text-gray-300">
                                    {selectedAdjustment.reason}
                                </p>
                            </div>

                            {/* Requester */}
                            <div className="flex items-center gap-4 mb-6 bg-gray-50 dark:bg-slate-900 rounded-2xl p-4">
                                <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-black">
                                    {selectedAdjustment.requestedBy.name.charAt(0)}
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Solicitado por</span>
                                    <p className="font-bold">{selectedAdjustment.requestedBy.name}</p>
                                    <p className="text-sm text-gray-400">{formatDate(selectedAdjustment.requestedAt)}</p>
                                </div>
                            </div>

                            {/* Actions for Pending */}
                            {selectedAdjustment.status === 'PENDING' && (
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setShowRejectModal(true)}
                                        disabled={processing}
                                        className="flex-1 py-4 px-6 rounded-2xl border-2 border-red-200 text-red-600 font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <X size={18} /> Rechazar
                                    </button>
                                    <button
                                        onClick={() => handleApprove(selectedAdjustment)}
                                        disabled={processing}
                                        className="flex-1 py-4 px-6 rounded-2xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {processing ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <Check size={18} /> Aprobar y Aplicar
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Reviewed info */}
                            {selectedAdjustment.reviewedBy && (
                                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                                    <div className={`rounded-2xl p-4 ${selectedAdjustment.status === 'APPROVED' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                                        <span className={`text-xs font-black uppercase tracking-widest ${selectedAdjustment.status === 'APPROVED' ? 'text-green-600' : 'text-red-600'}`}>
                                            {selectedAdjustment.status === 'APPROVED' ? 'Aprobado' : 'Rechazado'} por:
                                        </span>
                                        <p className="font-bold">{selectedAdjustment.reviewedBy.name}</p>
                                        {selectedAdjustment.reviewedAt && (
                                            <p className="text-sm text-gray-500">{formatDate(selectedAdjustment.reviewedAt)}</p>
                                        )}
                                        {selectedAdjustment.reviewComment && (
                                            <p className="mt-2 text-gray-600 dark:text-gray-400 italic">{selectedAdjustment.reviewComment}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Reject Modal */}
            <AnimatePresence>
                {showRejectModal && selectedAdjustment && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setShowRejectModal(false)}
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
                                <h3 className="text-xl font-black mb-2">Rechazar Solicitud</h3>
                                <p className="text-gray-500 text-sm">{selectedAdjustment.code}</p>
                            </div>

                            <div className="mb-6">
                                <label className="text-xs font-black text-gray-600 uppercase tracking-widest block mb-2">Motivo del rechazo (opcional)</label>
                                <textarea
                                    value={rejectComment}
                                    onChange={(e) => setRejectComment(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl font-bold resize-none"
                                    rows={3}
                                    placeholder="Explique por qué se rechaza..."
                                />
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => { setShowRejectModal(false); setRejectComment(''); }}
                                    className="flex-1 py-3 px-6 rounded-2xl border-2 border-gray-200 font-bold hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={processing}
                                    className="flex-1 py-3 px-6 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50"
                                >
                                    {processing ? 'Procesando...' : 'Rechazar'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
