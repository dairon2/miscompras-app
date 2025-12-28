"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    PieChart, TrendingUp, DollarSign, Banknote, Target,
    ArrowUpRight, List, LayoutGrid, Plus, Search,
    ChevronRight, X, User, Briefcase, Building2, Package,
    ArrowRightCircle, FileText, Download, FileSpreadsheet, Edit, Trash2, AlertTriangle, Calendar,
    Check, Clock, XCircle, TrendingDown
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import VisualDashboard from "./VisualDashboard";

interface Budget {
    id: string;
    code?: string;
    title: string;
    description?: string;
    amount: number;
    available: number;
    year: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    expirationDate?: string;
    project?: { id: string; name: string; code?: string };
    area?: { id: string; name: string };
    category?: { id: string; name: string; code: string };
    manager?: { id: string; name: string; email: string };
    createdBy?: { id: string; name: string };
    approvedBy?: { id: string; name: string };
    subLeaders?: Array<{ user: { id: string; name: string } }>;
    _count?: { requirements: number; adjustments: number };
    createdAt: string;
}

interface Project { id: string; name: string }
interface Area { id: string; name: string }
interface Category { id: string; name: string; code: string }
interface UserOption { id: string; name: string; email?: string; role: string }

export default function BudgetsPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const { addToast } = useToastStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const userRole = user?.role?.toUpperCase() || 'USER';
    const isDirector = userRole === 'DIRECTOR';
    const canManageBudgets = isDirector; // Only DIRECTOR can create/edit/delete
    const canViewAll = ['ADMIN', 'DIRECTOR', 'LEADER'].includes(userRole);

    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'table' | 'visual'>('visual');
    const [searchTerm, setSearchTerm] = useState('');

    // Year filter
    const [years, setYears] = useState<number[]>([]);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    // Filters
    const [filters, setFilters] = useState({
        projectId: '',
        areaId: '',
        status: ''
    });

    // Catalogs
    const [projects, setProjects] = useState<Project[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersError, setUsersError] = useState(false);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Form data for create/edit
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        code: '',
        amount: '',
        projectId: '',
        areaId: '',
        categoryId: '',
        managerId: '',
        expirationDate: '',
        subLeaders: [] as string[]
    });

    // Adjustment form
    const [adjustmentData, setAdjustmentData] = useState({
        type: 'INCREASE' as 'INCREASE' | 'TRANSFER',
        requestedAmount: '',
        reason: '',
        sources: [] as Array<{ budgetId: string; amount: string }>
    });
    const [savingAdjustment, setSavingAdjustment] = useState(false);

    const fetchBudgets = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('year', selectedYear.toString());
            if (filters.projectId) params.append('projectId', filters.projectId);
            if (filters.areaId) params.append('areaId', filters.areaId);
            if (filters.status) params.append('status', filters.status);

            const res = await api.get(`/budgets?${params.toString()}`);
            setBudgets(res.data);
        } catch (err) {
            console.error("Error fetching budgets:", err);
            addToast('Error al cargar presupuestos', 'error');
        } finally {
            setLoading(false);
        }
    }, [selectedYear, filters, addToast]);

    useEffect(() => {
        fetchBudgets();
    }, [selectedYear, filters, fetchBudgets]);

    const fetchYears = async () => {
        try {
            const res = await api.get('/budgets/years');
            if (res.data.length > 0) {
                setYears(res.data);
            } else {
                setYears([new Date().getFullYear()]);
            }
        } catch (err) {
            setYears([new Date().getFullYear()]);
        }
    };

    useEffect(() => {
        fetchYears();
        fetchCatalogs();
    }, []);

    const fetchCatalogs = async () => {
        setUsersLoading(true);
        setUsersError(false);
        try {
            const results = await Promise.allSettled([
                api.get('/projects'),
                api.get('/areas'),
                api.get('/categories'),
                api.get('/budgets/manager-options')
            ]);

            if (results[0].status === 'fulfilled') setProjects((results[0] as PromiseFulfilledResult<{ data: Project[] }>).value.data);
            if (results[1].status === 'fulfilled') setAreas((results[1] as PromiseFulfilledResult<{ data: Area[] }>).value.data);
            if (results[2].status === 'fulfilled') setCategories((results[2] as PromiseFulfilledResult<{ data: Category[] }>).value.data);
            if (results[3].status === 'fulfilled') {
                const userData = (results[3] as PromiseFulfilledResult<{ data: UserOption[] }>).value.data;
                console.log("Users loaded:", userData);
                setUsers(userData);
            } else {
                console.error('Error loading users:', results[3]);
                setUsersError(true);
            }

            // Log failures for debugging
            results.forEach((res, idx) => {
                if (res.status === 'rejected') {
                    console.error(`Error loading catalog ${idx}:`, res.reason);
                }
            });
        } catch (err) {
            console.error("Critical error fetching catalogs:", err);
            setUsersError(true);
        } finally {
            setUsersLoading(false);
        }
    };

    // Calculate stats with safe number conversion
    const safeNumber = (val: number | string | undefined | null): number => {
        if (val == null) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    };

    const stats = {
        totalBudget: budgets.reduce((sum, b) => sum + safeNumber(b.amount), 0),
        totalAvailable: budgets.reduce((sum, b) => sum + safeNumber(b.available), 0),
        totalExecuted: budgets.reduce((sum, b) => sum + (safeNumber(b.amount) - safeNumber(b.available)), 0),
        criticalCount: budgets.filter(b => {
            const amount = safeNumber(b.amount);
            const available = safeNumber(b.available);
            if (amount === 0) return false;
            const pct = (available / amount) * 100;
            return pct < 10;
        }).length
    };

    const formatCurrency = (val: number | undefined | null) => {
        const safeVal = val != null && !isNaN(Number(val)) ? Number(val) : 0;
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(safeVal);
    };

    const getProgressColor = (budget: Budget) => {
        const amount = safeNumber(budget.amount);
        const available = safeNumber(budget.available);
        if (amount === 0) return 'bg-gray-500';
        const pct = (available / amount) * 100;
        if (pct <= 10) return 'bg-red-500';
        if (pct <= 30) return 'bg-amber-500';
        return 'bg-green-500';
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black flex items-center gap-1"><Check size={10} />Aprobado</span>;
            case 'REJECTED':
                return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black flex items-center gap-1"><XCircle size={10} />Rechazado</span>;
            default:
                return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black flex items-center gap-1"><Clock size={10} />Pendiente</span>;
        }
    };

    const filteredBudgets = budgets.filter(b => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            b.title?.toLowerCase().includes(term) ||
            b.code?.toLowerCase().includes(term) ||
            b.project?.name?.toLowerCase().includes(term) ||
            b.category?.name?.toLowerCase().includes(term)
        );
    });

    // Handle create/edit budget
    const handleSaveBudget = async () => {
        try {
            if (selectedBudget) {
                await api.put(`/budgets/${selectedBudget.id}`, {
                    ...formData,
                    amount: parseFloat(formData.amount)
                });
                addToast('Presupuesto actualizado', 'success');
            } else {
                await api.post('/budgets', {
                    ...formData,
                    amount: parseFloat(formData.amount),
                    year: selectedYear
                });
                addToast('Presupuesto creado', 'success');
            }
            setShowCreateModal(false);
            fetchBudgets();
        } catch (err: any) {
            addToast(err.response?.data?.error || 'Error al guardar', 'error');
        }
    };

    // Handle delete
    const handleDeleteBudget = async () => {
        if (!selectedBudget) return;
        try {
            await api.delete(`/budgets/${selectedBudget.id}`);
            addToast('Presupuesto eliminado', 'success');
            setShowDeleteModal(false);
            setSelectedBudget(null);
            fetchBudgets();
        } catch (err: any) {
            addToast(err.response?.data?.error || 'Error al eliminar', 'error');
        }
    };

    // Handle adjustment request
    const handleRequestAdjustment = async () => {
        if (!selectedBudget) return;
        setSavingAdjustment(true);
        try {
            const payload: any = {
                budgetId: selectedBudget.id,
                type: adjustmentData.type,
                requestedAmount: parseFloat(adjustmentData.requestedAmount),
                reason: adjustmentData.reason
            };

            if (adjustmentData.type === 'TRANSFER') {
                payload.sources = adjustmentData.sources.map(s => ({
                    budgetId: s.budgetId,
                    amount: parseFloat(s.amount)
                }));
            }

            await api.post('/adjustments', payload);
            addToast('Solicitud enviada correctamente', 'success');
            setShowAdjustmentModal(false);
            setAdjustmentData({ type: 'INCREASE', requestedAmount: '', reason: '', sources: [] });
        } catch (err: any) {
            addToast(err.response?.data?.error || 'Error al enviar solicitud', 'error');
        } finally {
            setSavingAdjustment(false);
        }
    };

    const openCreateModal = () => {
        setSelectedBudget(null);
        setFormData({ title: '', description: '', code: '', amount: '', projectId: '', areaId: '', categoryId: '', managerId: '', expirationDate: '', subLeaders: [] });
        setShowCreateModal(true);
    };

    const openEditModal = (budget: Budget) => {
        setSelectedBudget(budget);
        setFormData({
            title: budget.title,
            description: budget.description || '',
            code: budget.code || '',
            amount: budget.amount.toString(),
            projectId: budget.project?.id || '',
            areaId: budget.area?.id || '',
            categoryId: budget.category?.id || '',
            managerId: budget.manager?.id || '',
            expirationDate: budget.expirationDate ? new Date(budget.expirationDate).toISOString().split('T')[0] : '',
            subLeaders: budget.subLeaders?.map(sl => sl.user.id) || []
        });
        setShowCreateModal(true);
    };

    const openAdjustmentModal = (budget: Budget) => {
        setSelectedBudget(budget);
        setAdjustmentData({ type: 'INCREASE', requestedAmount: '', reason: '', sources: [] });
        setShowAdjustmentModal(true);
    };

    if (!mounted) return null;

    return (
        <div className="p-6 lg:p-12 max-w-7xl mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
            >
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-premium-gradient flex items-center justify-center text-white shadow-lg">
                        <Banknote size={28} />
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-2xl md:text-4xl font-black tracking-tight">Presupuestos</h2>
                        <p className="text-gray-500 font-bold uppercase text-[8px] md:text-[10px] tracking-[0.2em]">Gestión Financiera {selectedYear}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Year selector */}
                    <div className="relative group">
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 dark:text-white appearance-none cursor-pointer pr-12 focus:ring-4 focus:ring-primary-500/10 transition-all shadow-sm group-hover:border-primary-400"
                        >
                            {years.map(y => (
                                <option key={y} value={y} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-bold">{y}</option>
                            ))}
                        </select>
                        <Calendar size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-500 pointer-events-none group-hover:scale-110 transition-transform" />
                    </div>

                    {isDirector && (
                        <button
                            onClick={() => router.push("/budget/adjustments")}
                            className="flex items-center gap-2 bg-amber-500 text-white px-6 py-4 rounded-2xl font-black shadow-lg hover:bg-amber-600 hover:-translate-y-1 transition-all uppercase text-[10px] tracking-widest"
                        >
                            <FileText size={18} />
                            <span>Ajustes Presupuestales</span>
                        </button>
                    )}

                    {canManageBudgets && (
                        <button
                            onClick={openCreateModal}
                            className="flex items-center gap-2 bg-primary-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg hover:bg-primary-700 hover:-translate-y-1 transition-all uppercase text-[10px] tracking-widest"
                        >
                            <Plus size={18} />
                            <span>Nuevo Presupuesto</span>
                        </button>
                    )}
                </div>
            </motion.div>

            {/* Stats Cards */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
            >
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 md:p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-gray-400">Presupuesto</span>
                        <DollarSign className="text-primary-500" size={16} />
                    </div>
                    <p className="text-sm md:text-2xl font-black truncate">{formatCurrency(stats.totalBudget)}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 md:p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-gray-400">Disponible</span>
                        <Banknote className="text-green-500" size={16} />
                    </div>
                    <p className="text-sm md:text-2xl font-black text-green-600 truncate">{formatCurrency(stats.totalAvailable)}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 md:p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-gray-400">Ejecutado</span>
                        <TrendingUp className="text-amber-500" size={16} />
                    </div>
                    <p className="text-sm md:text-2xl font-black text-amber-600 truncate">{formatCurrency(stats.totalExecuted)}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 md:p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-gray-400">Críticos</span>
                        <AlertTriangle className="text-red-500" size={16} />
                    </div>
                    <p className="text-sm md:text-2xl font-black text-red-600 truncate">{stats.criticalCount}</p>
                </div>
            </motion.div>

            {/* Filters */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-4 mb-6"
            >
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar presupuestos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold outline-none focus:ring-2 ring-primary-500"
                    />
                </div>
                <select
                    value={filters.projectId}
                    onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
                    className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 font-bold text-sm"
                >
                    <option value="">Todos los proyectos</option>
                    {projects.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
                <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 font-bold text-sm"
                >
                    <option value="">Todos los estados</option>
                    <option value="PENDING">Pendiente</option>
                    <option value="APPROVED">Aprobado</option>
                    <option value="REJECTED">Rechazado</option>
                </select>
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('visual')}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest ${viewMode === 'visual' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 text-gray-400'}`}
                    >
                        <PieChart size={14} /> Dashboard
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-3 rounded-xl border transition-all ${viewMode === 'grid' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700'}`}
                        title="Vista Cuadrícula"
                    >
                        <LayoutGrid size={18} />
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={`p-3 rounded-xl border transition-all ${viewMode === 'table' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700'}`}
                        title="Vista Tabla"
                    >
                        <List size={18} />
                    </button>
                </div>
            </motion.div>

            {/* Budget List */}
            {loading ? (
                <div className="text-center py-20">
                    <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400 font-bold">Cargando presupuestos...</p>
                </div>
            ) : viewMode === 'visual' ? (
                <VisualDashboard budgets={filteredBudgets} />
            ) : viewMode === 'table' ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
                >
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Código</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Título</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Rubro</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Proyecto</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Líder</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Presupuesto</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Disponible</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Estado</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBudgets.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center text-gray-400 font-bold">
                                            No hay presupuestos para mostrar
                                        </td>
                                    </tr>
                                ) : (
                                    filteredBudgets.map((budget) => {
                                        const usedPct = ((Number(budget.amount) - Number(budget.available)) / Number(budget.amount)) * 100;
                                        const availablePct = 100 - usedPct;
                                        const isLow = availablePct < 10;

                                        return (
                                            <tr key={budget.id} className="border-b border-gray-50 dark:border-gray-700 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-lg text-[10px] font-black">
                                                        {budget.code || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-bold">{budget.title}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{budget.category?.name || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{budget.project?.name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{budget.manager?.name || '-'}</td>
                                                <td className="px-6 py-4 font-bold">{formatCurrency(Number(budget.amount))}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-bold ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                                                            {formatCurrency(Number(budget.available))}
                                                        </span>
                                                        {isLow && (
                                                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[8px] font-black">BAJO</span>
                                                        )}
                                                    </div>
                                                    <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                                                        <div className={`h-full rounded-full ${getProgressColor(budget)}`} style={{ width: `${Math.min(usedPct, 100)}%` }}></div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">{getStatusBadge(budget.status)}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => router.push(`/budget/${budget.id}`)}
                                                            className="p-2 bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-primary-100 hover:text-primary-600 rounded-xl transition-all"
                                                            title="Ver detalle"
                                                        >
                                                            <ChevronRight size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => openAdjustmentModal(budget)}
                                                            className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 hover:bg-amber-100 rounded-xl transition-all"
                                                            title="Solicitar ajuste"
                                                        >
                                                            <TrendingUp size={14} />
                                                        </button>
                                                        {canManageBudgets && (
                                                            <>
                                                                <button
                                                                    onClick={() => openEditModal(budget)}
                                                                    className="p-2 bg-primary-50 dark:bg-primary-900/30 text-primary-600 hover:bg-primary-100 rounded-xl transition-all"
                                                                    title="Editar"
                                                                >
                                                                    <Edit size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => { setSelectedBudget(budget); setShowDeleteModal(true); }}
                                                                    className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 rounded-xl transition-all"
                                                                    title="Eliminar"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden p-4 space-y-4">
                        {filteredBudgets.map((budget) => {
                            const usedPct = ((Number(budget.amount) - Number(budget.available)) / Number(budget.amount)) * 100;
                            const availablePct = 100 - usedPct;
                            const isLow = availablePct < 10;
                            return (
                                <div key={budget.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="text-[10px] font-black text-primary-600">{budget.code || 'SIN CÓDIGO'}</span>
                                            <h4 className="font-black text-slate-800 dark:text-white leading-tight">{budget.title}</h4>
                                        </div>
                                        {getStatusBadge(budget.status)}
                                    </div>
                                    <div className="space-y-3 mb-4">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-400 font-bold uppercase tracking-widest">Disponible</span>
                                            <span className={`font-black ${isLow ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(Number(budget.available))}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                                            <div className={`h-full rounded-full ${getProgressColor(budget)}`} style={{ width: `${Math.min(usedPct, 100)}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-3 border-t border-gray-50 dark:border-gray-700">
                                        <span className="text-[10px] font-bold text-gray-400 truncate max-w-[150px]">{budget.project?.name}</span>
                                        <button
                                            onClick={() => openAdjustmentModal(budget)}
                                            className="text-primary-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
                                        >
                                            Ajustar <TrendingUp size={12} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            ) : (
                /* Grid View */
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {filteredBudgets.map((budget) => {
                        const usedPct = ((Number(budget.amount) - Number(budget.available)) / Number(budget.amount)) * 100;
                        const availablePct = 100 - usedPct;
                        const isLow = availablePct < 10;

                        return (
                            <div
                                key={budget.id}
                                className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <span className="text-[10px] font-black text-primary-600">{budget.code || 'SIN CÓDIGO'}</span>
                                        <h3 className="font-bold text-lg">{budget.title}</h3>
                                        <p className="text-sm text-gray-400">{budget.project?.name}</p>
                                    </div>
                                    {getStatusBadge(budget.status)}
                                </div>

                                {isLow && (
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4 flex items-center gap-2">
                                        <AlertTriangle className="text-red-500" size={16} />
                                        <span className="text-red-700 dark:text-red-400 text-xs font-bold">⚠️ Presupuesto bajo ({availablePct.toFixed(1)}% disponible)</span>
                                    </div>
                                )}

                                <div className="space-y-3 mb-4">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400 text-sm">Presupuesto</span>
                                        <span className="font-bold">{formatCurrency(Number(budget.amount))}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400 text-sm">Disponible</span>
                                        <span className={`font-bold ${isLow ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(Number(budget.available))}</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                        <div className={`h-full rounded-full ${getProgressColor(budget)}`} style={{ width: `${Math.min(usedPct, 100)}%` }}></div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-2">
                                        <User size={14} className="text-gray-400" />
                                        <span className="text-sm text-gray-500">{budget.manager?.name || 'Sin asignar'}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openAdjustmentModal(budget)}
                                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl"
                                        >
                                            <TrendingUp size={16} />
                                        </button>
                                        {canManageBudgets && (
                                            <button
                                                onClick={() => openEditModal(budget)}
                                                className="p-2 text-primary-600 hover:bg-primary-50 rounded-xl"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </motion.div>
            )}

            {/* Create/Edit Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setShowCreateModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black">{selectedBudget ? 'Editar' : 'Nuevo'} Presupuesto</h3>
                                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <label className="text-xs font-black text-gray-600">Título *</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl font-bold"
                                        placeholder="Nombre del presupuesto"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-600">Código</label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl font-bold"
                                        placeholder="FA-4.5-01"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-600">Monto *</label>
                                    <input
                                        type="number"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl font-bold"
                                        placeholder="10000000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-600">Proyecto *</label>
                                    <select
                                        value={formData.projectId}
                                        onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl font-bold"
                                    >
                                        <option value="">Seleccionar...</option>
                                        {projects.map((p: any) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-600">Área *</label>
                                    <select
                                        value={formData.areaId}
                                        onChange={(e) => setFormData({ ...formData, areaId: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl font-bold"
                                    >
                                        <option value="">Seleccionar...</option>
                                        {areas.map((a: any) => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-600">Rubro/Categoría</label>
                                    <select
                                        value={formData.categoryId}
                                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl font-bold"
                                    >
                                        <option value="">Seleccionar...</option>
                                        {categories.map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-600">Líder Gestor</label>
                                    <select
                                        value={formData.managerId}
                                        onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl font-bold"
                                        disabled={usersLoading}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {usersLoading ? (
                                            <option value="" disabled>Cargando usuarios...</option>
                                        ) : usersError ? (
                                            <option value="" disabled>Error al cargar usuarios</option>
                                        ) : users.length === 0 ? (
                                            <option value="" disabled>No hay usuarios disponibles</option>
                                        ) : (
                                            users.map((u: UserOption) => (
                                                <option key={u.id} value={u.id}>{u.name || u.email} ({u.role})</option>
                                            ))
                                        )}
                                    </select>
                                    {usersError && (
                                        <button
                                            type="button"
                                            onClick={() => fetchCatalogs()}
                                            className="text-xs text-primary-600 hover:underline"
                                        >
                                            Reintentar carga
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-600">Fecha de Vigencia</label>
                                    <input
                                        type="date"
                                        value={formData.expirationDate}
                                        onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl font-bold"
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                    <p className="text-[10px] text-gray-400">Después de esta fecha no se podrán cargar compras</p>
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <label className="text-xs font-black text-gray-600">Descripción</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl font-bold resize-none"
                                        rows={3}
                                        placeholder="Descripción del presupuesto..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 mt-8">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-3 px-6 rounded-2xl border-2 border-gray-200 font-bold hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveBudget}
                                    className="flex-1 py-3 px-6 rounded-2xl bg-primary-600 text-white font-bold hover:bg-primary-700"
                                >
                                    {selectedBudget ? 'Guardar Cambios' : 'Crear Presupuesto'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Adjustment Request Modal */}
            <AnimatePresence>
                {showAdjustmentModal && selectedBudget && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setShowAdjustmentModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-xl font-black">Solicitar Ajuste Presupuestal</h3>
                                    <p className="text-sm text-gray-500">{selectedBudget.title}</p>
                                </div>
                                <button onClick={() => setShowAdjustmentModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Current budget info */}
                            <div className="bg-gray-50 dark:bg-slate-900 rounded-2xl p-4 mb-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-xs text-gray-400">Presupuesto actual</span>
                                        <p className="font-bold">{formatCurrency(Number(selectedBudget.amount))}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400">Disponible</span>
                                        <p className="font-bold text-green-600">{formatCurrency(Number(selectedBudget.available))}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Type selector */}
                            <div className="flex gap-4 mb-6">
                                <button
                                    onClick={() => setAdjustmentData({ ...adjustmentData, type: 'INCREASE', sources: [] })}
                                    className={`flex-1 p-4 rounded-2xl border-2 font-bold transition-all ${adjustmentData.type === 'INCREASE' ? 'border-primary-600 bg-primary-50 text-primary-600' : 'border-gray-200'}`}
                                >
                                    <TrendingUp className="mx-auto mb-2" size={24} />
                                    <span className="text-sm">Solo Aumento</span>
                                </button>
                                <button
                                    onClick={() => setAdjustmentData({ ...adjustmentData, type: 'TRANSFER' })}
                                    className={`flex-1 p-4 rounded-2xl border-2 font-bold transition-all ${adjustmentData.type === 'TRANSFER' ? 'border-primary-600 bg-primary-50 text-primary-600' : 'border-gray-200'}`}
                                >
                                    <ArrowRightCircle className="mx-auto mb-2" size={24} />
                                    <span className="text-sm">Movimiento</span>
                                </button>
                            </div>

                            {/* Amount */}
                            <div className="space-y-2 mb-6">
                                <label className="text-xs font-black text-gray-600">Monto a solicitar *</label>
                                <input
                                    type="number"
                                    value={adjustmentData.requestedAmount}
                                    onChange={(e) => setAdjustmentData({ ...adjustmentData, requestedAmount: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl font-bold"
                                    placeholder="1000000"
                                />
                            </div>

                            {/* Sources for transfer */}
                            {adjustmentData.type === 'TRANSFER' && (
                                <div className="space-y-4 mb-6">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-black text-gray-600">Presupuestos de origen</label>
                                        <button
                                            onClick={() => setAdjustmentData({
                                                ...adjustmentData,
                                                sources: [...adjustmentData.sources, { budgetId: '', amount: '' }]
                                            })}
                                            className="text-primary-600 text-sm font-bold flex items-center gap-1"
                                        >
                                            <Plus size={14} /> Agregar
                                        </button>
                                    </div>

                                    {adjustmentData.sources.length === 0 && (
                                        <p className="text-sm text-gray-400 italic">Agrega presupuestos de donde se descontará el monto</p>
                                    )}

                                    {adjustmentData.sources.map((source, idx) => (
                                        <div key={idx} className="flex gap-4 items-center">
                                            <select
                                                value={source.budgetId}
                                                onChange={(e) => {
                                                    const updated = [...adjustmentData.sources];
                                                    updated[idx].budgetId = e.target.value;
                                                    setAdjustmentData({ ...adjustmentData, sources: updated });
                                                }}
                                                className="flex-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl font-bold text-sm"
                                            >
                                                <option value="">Seleccionar presupuesto...</option>
                                                {budgets.filter(b => b.id !== selectedBudget.id).map((b) => (
                                                    <option key={b.id} value={b.id}>
                                                        {b.title} (Disp: {formatCurrency(Number(b.available))})
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                value={source.amount}
                                                onChange={(e) => {
                                                    const updated = [...adjustmentData.sources];
                                                    updated[idx].amount = e.target.value;
                                                    setAdjustmentData({ ...adjustmentData, sources: updated });
                                                }}
                                                className="w-32 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl font-bold text-sm"
                                                placeholder="Monto"
                                            />
                                            <button
                                                onClick={() => {
                                                    const updated = adjustmentData.sources.filter((_, i) => i !== idx);
                                                    setAdjustmentData({ ...adjustmentData, sources: updated });
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}

                                    {adjustmentData.sources.length > 0 && (
                                        <div className="flex justify-end">
                                            <span className="text-sm font-bold">
                                                Total descuento: {formatCurrency(adjustmentData.sources.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0))}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Reason */}
                            <div className="space-y-2 mb-6">
                                <label className="text-xs font-black text-gray-600">Motivo de la solicitud *</label>
                                <textarea
                                    value={adjustmentData.reason}
                                    onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl font-bold resize-none"
                                    rows={4}
                                    placeholder="Explique el motivo del ajuste presupuestal..."
                                />
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowAdjustmentModal(false)}
                                    className="flex-1 py-3 px-6 rounded-2xl border-2 border-gray-200 font-bold hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleRequestAdjustment}
                                    disabled={savingAdjustment || !adjustmentData.requestedAmount || !adjustmentData.reason}
                                    className="flex-1 py-3 px-6 rounded-2xl bg-primary-600 text-white font-bold hover:bg-primary-700 disabled:opacity-50"
                                >
                                    {savingAdjustment ? 'Enviando...' : 'Enviar Solicitud'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteModal && selectedBudget && (
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
                                <h3 className="text-xl font-black mb-2">¿Eliminar Presupuesto?</h3>
                                <p className="text-gray-500 text-sm">Esta acción no se puede deshacer.</p>
                                <p className="font-bold text-primary-600 mt-2">{selectedBudget.title}</p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 py-3 px-6 rounded-2xl border-2 border-gray-200 font-bold hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeleteBudget}
                                    className="flex-1 py-3 px-6 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
