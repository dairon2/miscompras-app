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
    Package,
    Layers,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import ConfirmModal from "@/components/ConfirmModal";

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
    group?: { id: number; createdAt: string };
    groupId?: number;
}

interface BudgetGroupUI {
    isGroup: true;
    id: number;
    createdAt: string;
    items: PendingBudget[];
    totalAmount: number;
    projectNames: string[];
}

type BudgetItem = PendingBudget | BudgetGroupUI;

export default function PendingBudgetsPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { addToast } = useToastStore();
    const [items, setItems] = useState<BudgetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | number | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<number[]>([]);

    // Confirm Modal State
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'danger' | 'warning' | 'success' | 'info';
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: () => { }
    });

    useEffect(() => {
        fetchPendingBudgets();
    }, []);

    const fetchPendingBudgets = async () => {
        try {
            const response = await api.get('/budgets/pending-approval');
            const data: PendingBudget[] = response.data;
            processBudgets(data);
        } catch (err) {
            console.error("Error fetching pending budgets", err);
            addToast('Error al cargar presupuestos pendientes', 'error');
        } finally {
            setLoading(false);
        }
    };

    const processBudgets = (budgets: PendingBudget[]) => {
        const groupsMap = new Map<number, PendingBudget[]>();
        const individualItems: PendingBudget[] = [];

        budgets.forEach(b => {
            if (b.groupId && b.group) {
                if (!groupsMap.has(b.groupId)) {
                    groupsMap.set(b.groupId, []);
                }
                groupsMap.get(b.groupId)!.push(b);
            } else {
                individualItems.push(b);
            }
        });

        const groupItems: BudgetGroupUI[] = Array.from(groupsMap.entries()).map(([id, items]) => ({
            isGroup: true,
            id,
            createdAt: items[0].group?.createdAt || items[0].createdAt,
            items,
            totalAmount: items.reduce((sum, i) => sum + Number(i.amount), 0),
            projectNames: Array.from(new Set(items.map(i => i.project?.name).filter(Boolean)))
        }));

        // Combine and sort by date desc
        const combined = [...groupItems, ...individualItems].sort((a, b) => {
            const dateA = new Date('isGroup' in a ? a.createdAt : a.createdAt).getTime();
            const dateB = new Date('isGroup' in b ? b.createdAt : b.createdAt).getTime();
            return dateB - dateA;
        });

        setItems(combined);
    };

    const toggleGroup = (id: number) => {
        setExpandedGroups(prev =>
            prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
        );
    };

    const handleApprove = (id: string | number, isGroup: boolean, approve: boolean) => {
        const action = approve ? 'aprobar' : 'rechazar';
        const typeLabel = isGroup ? 'este grupo de presupuestos' : 'este presupuesto';

        setConfirmConfig({
            isOpen: true,
            title: approve ? '¿Aprobar?' : '¿Rechazar?',
            message: `¿Estás seguro de que deseas ${action} ${typeLabel}?`,
            type: approve ? 'info' : 'danger',
            onConfirm: () => executeApprove(id, isGroup, approve)
        });
    };

    const executeApprove = async (id: string | number, isGroup: boolean, approve: boolean) => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setProcessing(id);
        const action = approve ? 'aprobar' : 'rechazar';

        try {
            if (isGroup) {
                const endpoint = approve ? `/budgets/group/${id}/approve` : `/budgets/group/${id}/reject`;
                await api.post(endpoint, { approve }); // approve body ignored for reject route but harmless
            } else {
                await api.patch(`/budgets/${id}/approve`, { approve });
            }

            addToast(`Acción completada exitosamente`, 'success');
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

    // Helper to calculate totals for top cards
    const totalCount = items.reduce((sum, item) => sum + ('isGroup' in item ? item.items.length : 1), 0);
    const totalAmount = items.reduce((sum, item) => sum + ('isGroup' in item ? item.totalAmount : Number(item.amount)), 0);

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
                    <p className="text-4xl font-black">{totalCount}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                            <DollarSign size={20} />
                        </div>
                        <span className="text-gray-400 font-bold text-xs uppercase">Monto Total</span>
                    </div>
                    <p className="text-2xl font-black text-green-600">{formatCurrency(totalAmount)}</p>
                </div>
            </motion.div>

            {/* List */}
            {items.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-slate-800 p-12 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 text-center">
                    <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
                    <h3 className="text-xl font-black mb-2">¡Todo al día!</h3>
                    <p className="text-gray-500">No tienes presupuestos pendientes de aprobación</p>
                </motion.div>
            ) : (
                <div className="space-y-6">
                    <AnimatePresence>
                        {items.map((item, index) => {
                            if ('isGroup' in item) {
                                // RENDER GROUP CARD
                                const isExpanded = expandedGroups.includes(item.id);
                                return (
                                    <motion.div
                                        key={`group-${item.id}`}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-purple-100 dark:border-purple-900/30 overflow-hidden"
                                    >
                                        <div className="p-6 bg-purple-50/50 dark:bg-purple-900/10 flex flex-col lg:flex-row gap-6 items-start lg:items-center">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                        <Layers size={12} /> Solicitud Múltiple #{item.id}
                                                    </span>
                                                    <span className="text-xs text-gray-400 font-bold">{new Date(item.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <h3 className="text-xl font-black mb-1">{item.items.length} Presupuestos Agrupados</h3>
                                                <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                                                    {item.projectNames.map(p => (
                                                        <span key={p} className="flex items-center gap-1"><Building size={12} /> {p}</span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Total Grupo</p>
                                                <p className="text-2xl font-black text-purple-600">{formatCurrency(item.totalAmount)}</p>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => toggleGroup(item.id)}
                                                    className="p-3 rounded-xl bg-white dark:bg-slate-700 hover:bg-gray-50 text-gray-500 border border-gray-200 dark:border-gray-600 transition-all"
                                                >
                                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(item.id, true, true)}
                                                    disabled={processing === item.id}
                                                    className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-500/20 active:scale-95 transition-all flex items-center gap-2"
                                                >
                                                    {processing === item.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                                    Aprobar Todo
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(item.id, true, false)}
                                                    disabled={processing === item.id}
                                                    className="px-4 py-3 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
                                                >
                                                    <XCircle size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: 'auto' }}
                                                exit={{ height: 0 }}
                                                className="border-t border-gray-100 dark:border-gray-700"
                                            >
                                                {item.items.map(budget => (
                                                    <div key={budget.id} className="p-6 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors flex gap-4 items-center">
                                                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-500 font-bold">
                                                            {budget.title.charAt(0)}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between">
                                                                <h4 className="font-bold text-sm">{budget.title}</h4>
                                                                <span className="font-bold text-sm text-gray-600">{formatCurrency(Number(budget.amount))}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-400">{budget.code} • {budget.category?.name}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => router.push(`/budget/${budget.id}`)}
                                                            className="text-primary-600 hover:bg-primary-50 p-2 rounded-lg"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                    </motion.div>
                                );
                            } else {
                                // RENDER INDIVIDUAL CARD (Keep existing logic mostly)
                                const budget = item as PendingBudget;
                                return (
                                    <motion.div
                                        key={budget.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all"
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
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
                                                    {budget.category && (
                                                        <div className="flex items-center gap-2">
                                                            <FileText size={16} className="text-gray-400" />
                                                            <span>{budget.category.name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-center lg:text-right lg:min-w-[180px]">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Monto</p>
                                                <p className="text-2xl font-black text-green-600">{formatCurrency(Number(budget.amount))}</p>
                                            </div>
                                            <div className="flex flex-row lg:flex-col gap-3 lg:min-w-[140px]">
                                                <button
                                                    onClick={() => router.push(`/budget/${budget.id}`)}
                                                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-gray-200 dark:border-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
                                                >
                                                    <Eye size={18} /> Ver
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(budget.id, false, true)}
                                                    disabled={processing === budget.id}
                                                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
                                                >
                                                    {processing === budget.id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                                    Aprobar
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(budget.id, false, false)}
                                                    disabled={processing === budget.id}
                                                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            }
                        })}
                    </AnimatePresence>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                type={confirmConfig.type}
                confirmText="Confirmar"
                cancelText="Cancelar"
            />
        </div>
    );
}
