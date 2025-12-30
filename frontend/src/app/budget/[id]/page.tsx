"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    Calendar,
    FileText,
    Building,
    DollarSign,
    User,
    Download,
    CheckCircle,
    XCircle,
    Clock,
    History,
    Package,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Loader2,
    Eye
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface BudgetDetail {
    id: string;
    code?: string;
    title: string;
    description?: string;
    amount: number;
    available: number;
    year: number;
    version: number;
    status: string;
    expirationDate?: string;
    documentUrl?: string;
    approvedAt?: string;
    createdAt: string;
    project: { id: string; name: string; code: string };
    area: { id: string; name: string };
    category?: { id: string; name: string; code: string };
    manager?: { id: string; name: string; email: string; phone?: string };
    createdBy?: { id: string; name: string };
    approvedBy?: { id: string; name: string };
    subLeaders: Array<{ user: { id: string; name: string; email: string } }>;
    requirements: Array<{ id: string; title: string; status: string; totalAmount?: number; createdAt: string }>;
    adjustments: Array<{
        id: string;
        type: string;
        requestedAmount: number;
        status: string;
        reason: string;
        requestedAt: string;
        requestedBy?: { id: string; name: string };
        reviewedBy?: { id: string; name: string };
    }>;
}

export default function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { user: currentUser } = useAuthStore();
    const [budget, setBudget] = useState<BudgetDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState(false);

    const isManager = currentUser?.id === budget?.manager?.id;
    const canApprove = isManager && budget?.status === 'PENDING';

    useEffect(() => {
        fetchBudget();
    }, [id]);

    const fetchBudget = async () => {
        try {
            const response = await api.get(`/budgets/${id}`);
            setBudget(response.data);
        } catch (err) {
            console.error("Error fetching budget", err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (approve: boolean) => {
        if (!confirm(approve ? '¿Aprobar este presupuesto?' : '¿Rechazar este presupuesto?')) return;

        setApproving(true);
        try {
            await api.patch(`/budgets/${id}/approve`, { approve });
            fetchBudget();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Error al procesar');
        } finally {
            setApproving(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED': return <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-green-50 text-green-700 border border-green-200 flex items-center gap-1"><CheckCircle size={12} /> Aprobado</span>;
            case 'REJECTED': return <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-red-50 text-red-700 border border-red-200 flex items-center gap-1"><XCircle size={12} /> Rechazado</span>;
            default: return <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-yellow-50 text-yellow-700 border border-yellow-200 flex items-center gap-1"><Clock size={12} /> Pendiente</span>;
        }
    };

    const getProgressPercent = () => {
        if (!budget) return 0;
        const total = Number(budget.amount) || 0;
        const available = Number(budget.available) || 0;
        if (total === 0) return 0;
        return Math.round(((total - available) / total) * 100);
    };

    if (loading) {
        return (
            <div className="p-12 flex justify-center items-center min-h-screen">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                    <Loader2 size={40} className="text-primary-600" />
                </motion.div>
            </div>
        );
    }

    if (!budget) {
        return (
            <div className="p-12 text-center">
                <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
                <h2 className="text-xl font-bold">Presupuesto no encontrado</h2>
            </div>
        );
    }

    const executed = Number(budget.amount) - Number(budget.available);
    const progressPercent = getProgressPercent();

    return (
        <div className="p-6 lg:p-12 max-w-6xl mx-auto">
            {/* Back Button */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-8">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-primary-600 font-black uppercase text-[10px] tracking-widest transition-colors">
                    <ArrowLeft size={16} /> Volver a Presupuestos
                </button>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Header Card */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-600 mb-2">Presupuesto {budget.year}</p>
                                <h1 className="text-3xl font-black tracking-tight">{budget.title}</h1>
                                {budget.code && <p className="text-gray-400 font-bold text-xs mt-2">Código: {budget.code}</p>}
                            </div>
                            {getStatusBadge(budget.status)}
                        </div>

                        {budget.description && (
                            <p className="text-gray-600 dark:text-gray-300 mb-6">{budget.description}</p>
                        )}

                        {/* Progress Bar */}
                        <div className="mb-6">
                            <div className="flex justify-between text-sm font-bold mb-2">
                                <span className="text-gray-500">Ejecución</span>
                                <span className={progressPercent > 80 ? 'text-red-500' : progressPercent > 50 ? 'text-yellow-500' : 'text-green-500'}>
                                    {progressPercent}%
                                </span>
                            </div>
                            <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${progressPercent > 80 ? 'bg-gradient-to-r from-red-500 to-red-600' : progressPercent > 50 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'}`}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>

                        {/* Financial Summary */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-primary-50 to-indigo-50 dark:from-primary-900/20 dark:to-indigo-900/20 p-4 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Total</p>
                                <p className="text-xl font-black text-primary-600">{formatCurrency(Number(budget.amount))}</p>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Disponible</p>
                                <p className="text-xl font-black text-green-600">{formatCurrency(Number(budget.available))}</p>
                            </div>
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-4 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Ejecutado</p>
                                <p className="text-xl font-black text-orange-600">{formatCurrency(executed)}</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Approval Actions */}
                    {canApprove && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-r from-primary-500 to-indigo-500 p-1 rounded-3xl">
                            <div className="bg-white dark:bg-slate-800 p-8 rounded-[1.5rem]">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
                                        <AlertTriangle size={28} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black">Acción Requerida</h3>
                                        <p className="text-gray-500 text-sm">Este presupuesto está pendiente de tu aprobación</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={() => handleApprove(true)} disabled={approving} className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-50">
                                        {approving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={18} />}
                                        Aprobar Presupuesto
                                    </button>
                                    <button onClick={() => handleApprove(false)} disabled={approving} className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-50">
                                        {approving ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={18} />}
                                        Rechazar
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Requirements List */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                <Package size={20} />
                            </div>
                            <h3 className="text-lg font-black">Requerimientos ({budget.requirements?.length || 0})</h3>
                        </div>
                        {budget.requirements?.length > 0 ? (
                            <div className="space-y-3 max-h-80 overflow-y-auto">
                                {budget.requirements.map(req => (
                                    <div key={req.id} onClick={() => router.push(`/requirements/${req.id}`)} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${req.status === 'APPROVED' ? 'bg-green-500' : req.status === 'REJECTED' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                                            <span className="font-bold text-sm">{req.title}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-bold text-primary-600">{formatCurrency(Number(req.totalAmount || 0))}</span>
                                            <Eye size={16} className="text-gray-400" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm text-center py-6">No hay requerimientos cargados</p>
                        )}
                    </motion.div>

                    {/* Adjustments History */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
                                <History size={20} />
                            </div>
                            <h3 className="text-lg font-black">Historial de Ajustes ({budget.adjustments?.length || 0})</h3>
                        </div>
                        {budget.adjustments?.length > 0 ? (
                            <div className="space-y-4">
                                {budget.adjustments.map(adj => (
                                    <div key={adj.id} className="p-4 bg-gray-50 dark:bg-slate-900 rounded-xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {adj.type === 'INCREASE' ? <TrendingUp size={16} className="text-green-500" /> : <TrendingDown size={16} className="text-blue-500" />}
                                                <span className="font-bold text-sm">{adj.type === 'INCREASE' ? 'Aumento' : 'Transferencia'}</span>
                                            </div>
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${adj.status === 'APPROVED' ? 'bg-green-100 text-green-700' : adj.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {adj.status}
                                            </span>
                                        </div>
                                        {adj.reason && (
                                            <p className="text-sm text-gray-500 mb-2 italic">"{adj.reason}"</p>
                                        )}
                                        <div className="flex justify-between text-xs text-gray-400">
                                            <span>Monto: {formatCurrency(Number(adj.requestedAmount))}</span>
                                            <span>{new Date(adj.requestedAt).toLocaleDateString()}</span>
                                        </div>

                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm text-center py-6">Sin solicitudes de ajuste</p>
                        )}
                    </motion.div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Document */}
                    {budget.documentUrl && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Documento</h4>
                            <a href={budget.documentUrl.startsWith('http') ? budget.documentUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/${budget.documentUrl}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-all">
                                <FileText className="text-primary-600" size={24} />
                                <div className="flex-1">
                                    <p className="font-bold text-sm">Ver PDF</p>
                                    <p className="text-xs text-gray-500">Documento oficial</p>
                                </div>
                                <Download size={18} className="text-primary-600" />
                            </a>
                        </motion.div>
                    )}

                    {/* Info Cards */}
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700 space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Información</h4>

                        <div className="flex items-center gap-3">
                            <Building size={18} className="text-gray-400" />
                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400">Proyecto</p>
                                <p className="font-bold text-sm">{budget.project.name}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Package size={18} className="text-gray-400" />
                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400">Área</p>
                                <p className="font-bold text-sm">{budget.area.name}</p>
                            </div>
                        </div>

                        {budget.category && (
                            <div className="flex items-center gap-3">
                                <FileText size={18} className="text-gray-400" />
                                <div>
                                    <p className="text-[10px] font-black uppercase text-gray-400">Categoría</p>
                                    <p className="font-bold text-sm">{budget.category.name}</p>
                                </div>
                            </div>
                        )}

                        {budget.manager && (
                            <div className="flex items-center gap-3">
                                <User size={18} className="text-gray-400" />
                                <div>
                                    <p className="text-[10px] font-black uppercase text-gray-400">Líder Gestor</p>
                                    <p className="font-bold text-sm">{budget.manager.name}</p>
                                    <p className="text-xs text-gray-400">{budget.manager.email}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <Calendar size={18} className="text-gray-400" />
                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400">Creado</p>
                                <p className="font-bold text-sm">{new Date(budget.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>

                        {budget.expirationDate && (
                            <div className="flex items-center gap-3">
                                <Calendar size={18} className={new Date(budget.expirationDate) < new Date() ? 'text-red-500' : 'text-orange-400'} />
                                <div>
                                    <p className="text-[10px] font-black uppercase text-gray-400">Vigencia hasta</p>
                                    <p className={`font-bold text-sm ${new Date(budget.expirationDate) < new Date() ? 'text-red-500' : ''}`}>
                                        {new Date(budget.expirationDate).toLocaleDateString()}
                                        {new Date(budget.expirationDate) < new Date() && ' (Vencido)'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {budget.approvedAt && (
                            <div className="flex items-center gap-3">
                                {budget.status === 'REJECTED' ? (
                                    <XCircle size={18} className="text-red-500" />
                                ) : (
                                    <CheckCircle size={18} className="text-green-500" />
                                )}
                                <div>
                                    <p className="text-[10px] font-black uppercase text-gray-400">
                                        {budget.status === 'REJECTED' ? 'Rechazado' : 'Aprobado'}
                                    </p>
                                    <p className="font-bold text-sm">{new Date(budget.approvedAt).toLocaleDateString()}</p>
                                    {budget.approvedBy && <p className="text-xs text-gray-400">Por: {budget.approvedBy.name}</p>}
                                </div>
                            </div>
                        )}

                    </motion.div>

                    {/* Sub-leaders */}
                    {budget.subLeaders?.length > 0 && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Sub-líderes</h4>
                            <div className="space-y-3">
                                {budget.subLeaders.map(sl => (
                                    <div key={sl.user.id} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold text-xs">
                                            {sl.user.name?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">{sl.user.name}</p>
                                            <p className="text-xs text-gray-400">{sl.user.email}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
