"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Clock,
    CheckCircle,
    XCircle,
    DollarSign,
    Building,
    User,
    FileText,
    Eye,
    Loader2,
    AlertTriangle,
    Package
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";

interface PendingBudget {
    id: string;
    code?: string;
    title: string;
    description?: string;
    amount: number;
    available: number;
    year: number;
    createdAt: string;
    project: { id: string; name: string; code?: string };
    area: { id: string; name: string };
    category?: { id: string; name: string; code: string };
    manager?: { id: string; name: string; email: string };
    createdBy?: { id: string; name: string; email?: string };
}

export default function PendingBudgetsPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { addToast } = useToastStore();
    const [budgets, setBudgets] = useState<PendingBudget[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        fetchPendingBudgets();
    }, []);

    const fetchPendingBudgets = async () => {
        try {
            const response = await api.get('/budgets/pending-approval');
            setBudgets(response.data);
        } catch (err) {
            console.error("Error fetching pending budgets", err);
            addToast('Error al cargar presupuestos pendientes', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: string, approve: boolean) => {
        const action = approve ? 'aprobar' : 'rechazar';
        if (!confirm(`¿Estás seguro de ${action} este presupuesto?`)) return;

        setProcessing(id);
        try {
            await api.patch(`/budgets/${id}/approve`, { approve });
            addToast(`Presupuesto ${approve ? 'aprobado' : 'rechazado'} exitosamente`, 'success');
            fetchPendingBudgets();
        } catch (err: any) {
            addToast(err.response?.data?.error || `Error al ${action}`, 'error');
        } finally {
            setProcessing(null);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(value || 0);
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

    return (
        <div className="p-6 lg:p-12 max-w-6xl mx-auto">
            {/* Header */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-8">
                <button onClick={() => router.push('/budget')} className="flex items-center gap-2 text-gray-400 hover:text-primary-600 font-black uppercase text-[10px] tracking-widest transition-colors mb-4">
                    <ArrowLeft size={16} /> Volver a Presupuestos
                </button>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white">
                        <Clock size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">Presupuestos Pendientes</h1>
                        <p className="text-gray-500">Revisa y aprueba los presupuestos asignados a ti</p>
                    </div>
                </div>
            </motion.div>

            {/* Stats */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                            <Clock size={20} />
                        </div>
                        <span className="text-gray-400 font-bold text-xs uppercase">Pendientes</span>
                    </div>
                    <p className="text-4xl font-black">{budgets.length}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                            <DollarSign size={20} />
                        </div>
                        <span className="text-gray-400 font-bold text-xs uppercase">Monto Total</span>
                    </div>
                    <p className="text-2xl font-black text-green-600">{formatCurrency(budgets.reduce((acc, b) => acc + Number(b.amount), 0))}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                            <Building size={20} />
                        </div>
                        <span className="text-gray-400 font-bold text-xs uppercase">Proyectos</span>
                    </div>
                    <p className="text-4xl font-black">{new Set(budgets.map(b => b.project?.id)).size}</p>
                </div>
            </motion.div>

            {/* Budget List */}
            {budgets.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-slate-800 p-12 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 text-center">
                    <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
                    <h3 className="text-xl font-black mb-2">¡Todo al día!</h3>
                    <p className="text-gray-500">No tienes presupuestos pendientes de aprobación</p>
                </motion.div>
            ) : (
                <div className="space-y-6">
                    <AnimatePresence>
                        {budgets.map((budget, index) => (
                            <motion.div
                                key={budget.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -100 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all"
                            >
                                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                                    {/* Info */}
                                    <div className="flex-1">
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-500 flex items-center justify-center text-white font-black text-xl">
                                                {budget.title.charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded-full">
                                                        {budget.code || 'SIN CÓDIGO'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-gray-400">{budget.year}</span>
                                                </div>
                                                <h3 className="text-xl font-black">{budget.title}</h3>
                                                {budget.description && (
                                                    <p className="text-gray-500 text-sm mt-1 line-clamp-2">{budget.description}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Building size={16} className="text-gray-400" />
                                                <span className="font-bold">{budget.project?.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Package size={16} className="text-gray-400" />
                                                <span>{budget.area?.name}</span>
                                            </div>
                                            {budget.category && (
                                                <div className="flex items-center gap-2">
                                                    <FileText size={16} className="text-gray-400" />
                                                    <span>{budget.category.name}</span>
                                                </div>
                                            )}
                                            {budget.createdBy && (
                                                <div className="flex items-center gap-2">
                                                    <User size={16} className="text-gray-400" />
                                                    <span className="text-gray-500">Creado por: {budget.createdBy.name}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Amount */}
                                    <div className="text-center lg:text-right lg:min-w-[180px]">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Monto</p>
                                        <p className="text-2xl font-black text-green-600">{formatCurrency(Number(budget.amount))}</p>
                                        <p className="text-xs text-gray-400 mt-1">{new Date(budget.createdAt).toLocaleDateString()}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-row lg:flex-col gap-3 lg:min-w-[140px]">
                                        <button
                                            onClick={() => router.push(`/budget/${budget.id}`)}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-gray-200 dark:border-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
                                        >
                                            <Eye size={18} /> Ver Detalle
                                        </button>
                                        <button
                                            onClick={() => handleApprove(budget.id, true)}
                                            disabled={processing === budget.id}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
                                        >
                                            {processing === budget.id ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <CheckCircle size={18} />
                                            )}
                                            Aprobar
                                        </button>
                                        <button
                                            onClick={() => handleApprove(budget.id, false)}
                                            disabled={processing === budget.id}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
                                        >
                                            {processing === budget.id ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <XCircle size={18} />
                                            )}
                                            Rechazar
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
