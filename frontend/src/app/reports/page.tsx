"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
    BarChart3, PieChart, TrendingUp, DollarSign, FileText, Users, Clock,
    Calendar, Download, Filter, RefreshCw, Building, Briefcase, ChevronDown
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    PieChart as RechartsPie, Pie, Cell, LineChart, Line, Area, AreaChart
} from "recharts";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import YearSelector from "@/components/YearSelector";

// Color palette
const COLORS = {
    primary: '#6366f1',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    purple: '#8b5cf6',
    pink: '#ec4899',
    slate: '#64748b'
};

const STATUS_COLORS: Record<string, string> = {
    'Pendiente': COLORS.warning,
    'Aprobado': COLORS.success,
    'Rechazado': COLORS.danger
};

interface ExecutiveSummary {
    budget: {
        total: number;
        executed: number;
        available: number;
        executionPercentage: number;
    };
    requirements: {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
    };
    invoices: {
        total: number;
        totalAmount: number;
        paid: number;
        pending: number;
    };
    year: number;
}

interface BudgetExecution {
    id: string;
    name: string;
    code: string;
    budgeted: number;
    executed: number;
    available: number;
    percentage: string;
}

interface StatusData {
    status: string;
    count: number;
    label: string;
    [key: string]: string | number;
}

interface SupplierData {
    id: string;
    name: string;
    nit: string;
    totalPurchases: number;
    orderCount: number;
}

interface MonthlyData {
    month: string;
    monthIndex: number;
    count: number;
    amount: number;
}

export default function ReportsPage() {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [years, setYears] = useState<number[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'budget' | 'suppliers'>('overview');

    // Data states
    const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
    const [budgetExecution, setBudgetExecution] = useState<BudgetExecution[]>([]);
    const [statusData, setStatusData] = useState<StatusData[]>([]);
    const [topSuppliers, setTopSuppliers] = useState<SupplierData[]>([]);
    const [monthlyTrend, setMonthlyTrend] = useState<MonthlyData[]>([]);

    const fetchYears = async () => {
        try {
            const res = await api.get('/requirements/years');
            if (res.data && res.data.length > 0) {
                setYears(res.data);
            } else {
                setYears([new Date().getFullYear()]);
            }
        } catch (err) {
            setYears([new Date().getFullYear()]);
        }
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [summaryRes, budgetRes, statusRes, suppliersRes, trendRes] = await Promise.allSettled([
                api.get(`/reports/executive-summary?year=${selectedYear}`),
                api.get(`/reports/budget-execution/project?year=${selectedYear}`),
                api.get(`/reports/requirements-by-status?year=${selectedYear}`),
                api.get(`/reports/top-suppliers?year=${selectedYear}&limit=10`),
                api.get(`/reports/monthly-trend?year=${selectedYear}`)
            ]);

            if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data);
            if (budgetRes.status === 'fulfilled') setBudgetExecution(budgetRes.value.data);
            if (statusRes.status === 'fulfilled') setStatusData(statusRes.value.data);
            if (suppliersRes.status === 'fulfilled') setTopSuppliers(suppliersRes.value.data);
            if (trendRes.status === 'fulfilled') setMonthlyTrend(trendRes.value.data);
        } catch (err) {
            console.error("Error fetching reports data:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        fetchYears();
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const formatCompact = (value: number) => {
        if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        return value.toString();
    };

    if (loading) {
        return (
            <div className="p-12 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <RefreshCw className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
                    <p className="text-gray-500 font-bold">Cargando informes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-12 max-w-[1600px] mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-10"
            >
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-500 mb-2 block">
                            Módulo Financiero
                        </span>
                        <h1 className="text-4xl font-black tracking-tight">
                            Panel de Informes
                        </h1>
                        <p className="text-gray-500 font-medium mt-2">
                            Resumen ejecutivo y análisis de presupuestos
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <YearSelector
                            availableYears={years}
                            selectedYear={selectedYear}
                            onChange={setSelectedYear}
                        />
                        <button
                            onClick={() => fetchData()}
                            className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                        >
                            <RefreshCw size={20} className="text-gray-500" />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
                <KPICard
                    title="Presupuesto Total"
                    value={formatCurrency(summary?.budget.total || 0)}
                    subValue={`${summary?.budget.executionPercentage || 0}% ejecutado`}
                    icon={<DollarSign />}
                    color="primary"
                    trend={summary?.budget.executionPercentage || 0}
                />
                <KPICard
                    title="Ejecutado"
                    value={formatCurrency(summary?.budget.executed || 0)}
                    subValue={`de ${formatCompact(summary?.budget.total || 0)}`}
                    icon={<TrendingUp />}
                    color="success"
                />
                <KPICard
                    title="Disponible"
                    value={formatCurrency(summary?.budget.available || 0)}
                    subValue="Saldo restante"
                    icon={<BarChart3 />}
                    color="info"
                />
                <KPICard
                    title="Requerimientos"
                    value={summary?.requirements.total.toString() || "0"}
                    subValue={`${summary?.requirements.pending || 0} pendientes`}
                    icon={<FileText />}
                    color="warning"
                />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                {[
                    { id: 'overview', label: 'Resumen General', icon: <PieChart size={16} /> },
                    { id: 'budget', label: 'Ejecución Presupuestal', icon: <BarChart3 size={16} /> },
                    { id: 'suppliers', label: 'Proveedores', icon: <Users size={16} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                            : 'bg-white dark:bg-slate-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-100 dark:border-gray-700'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* Requirements by Status - Donut */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700"
                    >
                        <h3 className="text-lg font-black mb-6 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center text-purple-600">
                                <PieChart size={20} />
                            </div>
                            Requerimientos por Estado
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPie>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="count"
                                        nameKey="label"
                                        label={({ name, value }) => `${name}: ${value}`}
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={STATUS_COLORS[entry.label] || COLORS.slate}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1e293b',
                                            border: 'none',
                                            borderRadius: '12px',
                                            color: '#fff'
                                        }}
                                    />
                                    <Legend />
                                </RechartsPie>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Monthly Trend - Area Chart */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700"
                    >
                        <h3 className="text-lg font-black mb-6 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                                <TrendingUp size={20} />
                            </div>
                            Tendencia Mensual
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyTrend}>
                                    <defs>
                                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                    <YAxis
                                        tickFormatter={(value) => formatCompact(value)}
                                        tick={{ fontSize: 12 }}
                                    />
                                    <Tooltip
                                        formatter={(value) => value !== undefined ? formatCurrency(value as number) : ''}
                                        contentStyle={{
                                            backgroundColor: '#1e293b',
                                            border: 'none',
                                            borderRadius: '12px',
                                            color: '#fff'
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="amount"
                                        stroke={COLORS.primary}
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorAmount)"
                                        name="Monto"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>
                </div>
            )}

            {activeTab === 'budget' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700"
                >
                    <h3 className="text-lg font-black mb-6 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-green-600">
                            <BarChart3 size={20} />
                        </div>
                        Ejecución Presupuestal por Proyecto
                    </h3>
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={budgetExecution} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis
                                    type="number"
                                    tickFormatter={(value) => formatCompact(value)}
                                    tick={{ fontSize: 12 }}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={150}
                                    tick={{ fontSize: 11 }}
                                />
                                <Tooltip
                                    formatter={(value) => value !== undefined ? formatCurrency(value as number) : ''}
                                    contentStyle={{
                                        backgroundColor: '#1e293b',
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: '#fff'
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="budgeted" name="Presupuestado" fill={COLORS.info} radius={[0, 4, 4, 0]} />
                                <Bar dataKey="executed" name="Ejecutado" fill={COLORS.success} radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            )}

            {activeTab === 'suppliers' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700"
                >
                    <h3 className="text-lg font-black mb-6 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center text-amber-600">
                            <Users size={20} />
                        </div>
                        Top 10 Proveedores
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-700">
                                    <th className="pb-4 text-left">#</th>
                                    <th className="pb-4 text-left">Proveedor</th>
                                    <th className="pb-4 text-left">NIT</th>
                                    <th className="pb-4 text-right">Órdenes</th>
                                    <th className="pb-4 text-right">Total Compras</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topSuppliers.map((supplier, idx) => (
                                    <tr key={supplier.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="py-4">
                                            <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                                                {idx + 1}
                                            </span>
                                        </td>
                                        <td className="py-4 font-bold">{supplier.name}</td>
                                        <td className="py-4 text-gray-500 font-medium">{supplier.nit}</td>
                                        <td className="py-4 text-right">
                                            <span className="bg-primary-50 dark:bg-primary-900/20 text-primary-600 px-3 py-1 rounded-lg font-bold text-sm">
                                                {supplier.orderCount}
                                            </span>
                                        </td>
                                        <td className="py-4 text-right font-black text-green-600">
                                            {formatCurrency(supplier.totalPurchases)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

// KPI Card Component
interface KPICardProps {
    title: string;
    value: string;
    subValue: string;
    icon: React.ReactNode;
    color: 'primary' | 'success' | 'warning' | 'danger' | 'info';
    trend?: number;
}

function KPICard({ title, value, subValue, icon, color, trend }: KPICardProps) {
    const colorClasses = {
        primary: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600',
        success: 'bg-green-50 dark:bg-green-900/20 text-green-600',
        warning: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
        danger: 'bg-red-50 dark:bg-red-900/20 text-red-600',
        info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700 relative overflow-hidden group"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50/50 dark:to-slate-700/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClasses[color]}`}>
                        {icon}
                    </div>
                    {trend !== undefined && (
                        <div className={`text-xs font-bold px-2 py-1 rounded-lg ${trend > 50 ? 'bg-green-100 text-green-700' : trend > 25 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {trend.toFixed(0)}%
                        </div>
                    )}
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{title}</p>
                <p className="text-2xl font-black tracking-tight mb-1">{value}</p>
                <p className="text-xs text-gray-500 font-medium">{subValue}</p>
            </div>
        </motion.div>
    );
}
