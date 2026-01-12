"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart3, PieChart, TrendingUp, DollarSign, FileText, Users, Clock,
    Calendar, Download, Filter, RefreshCw, Building, Briefcase, ChevronDown,
    ArrowUpRight, ArrowDownRight, Target, Layers, Settings2, LayoutGrid,
    LineChart, AreaChartIcon, Activity, Zap, Award, Package
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    PieChart as RechartsPie, Pie, Cell, LineChart as RechartsLine, Line, Area, AreaChart
} from "recharts";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import YearSelector from "@/components/YearSelector";

// Color palette
const COLORS = {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    purple: '#8b5cf6',
    pink: '#ec4899',
    teal: '#14b8a6',
    slate: '#64748b'
};

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#14b8a6'];

const STATUS_COLORS: Record<string, string> = {
    'Pendiente': COLORS.warning,
    'En Trámite': COLORS.info,
    'Finalizado': COLORS.success
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
        inProgress: number;
        completed: number;
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

interface FilterOption {
    id: string;
    name: string;
}

type ChartType = 'bar' | 'line' | 'area' | 'donut';

export default function ReportsPage() {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [years, setYears] = useState<number[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'budget' | 'suppliers' | 'analytics'>('overview');

    // Filters
    const [showFilters, setShowFilters] = useState(false);
    const [selectedArea, setSelectedArea] = useState<string>('');
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [areas, setAreas] = useState<FilterOption[]>([]);
    const [projects, setProjects] = useState<FilterOption[]>([]);

    // Chart type preferences
    const [trendChartType, setTrendChartType] = useState<ChartType>('area');
    const [statusChartType, setStatusChartType] = useState<ChartType>('donut');
    const [budgetChartType, setBudgetChartType] = useState<ChartType>('bar');

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

    const fetchFilters = async () => {
        try {
            const [areasRes, projectsRes] = await Promise.all([
                api.get('/admin/areas'),
                api.get('/admin/projects')
            ]);
            setAreas(areasRes.data || []);
            setProjects(projectsRes.data || []);
        } catch (err) {
            console.error('Error fetching filters:', err);
        }
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ year: selectedYear.toString() });
            if (selectedArea) params.append('areaId', selectedArea);
            if (selectedProject) params.append('projectId', selectedProject);

            const queryString = params.toString();

            const [summaryRes, budgetRes, statusRes, suppliersRes, trendRes] = await Promise.allSettled([
                api.get(`/reports/executive-summary?${queryString}`),
                api.get(`/reports/budget-execution/project?${queryString}`),
                api.get(`/reports/requirements-by-status?${queryString}`),
                api.get(`/reports/top-suppliers?${queryString}&limit=10`),
                api.get(`/reports/monthly-trend?${queryString}`)
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
    }, [selectedYear, selectedArea, selectedProject]);

    useEffect(() => {
        fetchYears();
        fetchFilters();
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

    const clearFilters = () => {
        setSelectedArea('');
        setSelectedProject('');
    };

    if (loading) {
        return (
            <div className="p-12 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    >
                        <RefreshCw className="w-16 h-16 text-primary-500 mx-auto mb-4" />
                    </motion.div>
                    <p className="text-gray-500 font-bold text-lg">Cargando dashboard...</p>
                    <p className="text-gray-400 text-sm mt-1">Preparando visualizaciones de datos</p>
                </div>
            </div>
        );
    }

    const completionRate = summary?.requirements.total
        ? ((summary.requirements.completed / summary.requirements.total) * 100).toFixed(1)
        : '0';

    return (
        <div className="p-6 lg:p-12 max-w-[1800px] mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-500 mb-2 block">
                            Dashboard Ejecutivo
                        </span>
                        <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                            Centro de Análisis
                        </h1>
                        <p className="text-gray-500 font-medium mt-2">
                            Visualiza y analiza el rendimiento de tu gestión
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Year Selector */}
                        <YearSelector
                            availableYears={years}
                            selectedYear={selectedYear}
                            onChange={setSelectedYear}
                        />

                        {/* Filters Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${showFilters || selectedArea || selectedProject
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30'
                                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                                }`}
                        >
                            <Filter size={18} />
                            Filtros
                            {(selectedArea || selectedProject) && (
                                <span className="w-5 h-5 rounded-full bg-white/20 text-[10px] flex items-center justify-center">
                                    {(selectedArea ? 1 : 0) + (selectedProject ? 1 : 0)}
                                </span>
                            )}
                        </button>

                        {/* Refresh Button */}
                        <button
                            onClick={() => fetchData()}
                            className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
                        >
                            <RefreshCw size={18} className="text-gray-500" />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Filters Panel */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-8 overflow-hidden"
                    >
                        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-black text-sm flex items-center gap-2">
                                    <Settings2 size={16} className="text-primary-500" />
                                    Filtros Avanzados
                                </h3>
                                {(selectedArea || selectedProject) && (
                                    <button
                                        onClick={clearFilters}
                                        className="text-xs font-bold text-primary-600 hover:underline"
                                    >
                                        Limpiar filtros
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                                        Área
                                    </label>
                                    <select
                                        value={selectedArea}
                                        onChange={(e) => setSelectedArea(e.target.value)}
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                    >
                                        <option value="">Todas las áreas</option>
                                        {areas.map(area => (
                                            <option key={area.id} value={area.id}>{area.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                                        Proyecto
                                    </label>
                                    <select
                                        value={selectedProject}
                                        onChange={(e) => setSelectedProject(e.target.value)}
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                    >
                                        <option value="">Todos los proyectos</option>
                                        {projects.map(project => (
                                            <option key={project.id} value={project.id}>{project.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={() => fetchData()}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-primary-500/30 transition-all"
                                    >
                                        <Zap size={16} />
                                        Aplicar Filtros
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
                <KPICard
                    title="Presupuesto Total"
                    value={formatCurrency(summary?.budget.total || 0)}
                    subValue={`${summary?.budget.executionPercentage || 0}% ejecutado`}
                    icon={<DollarSign />}
                    color="primary"
                    trend={summary?.budget.executionPercentage || 0}
                    gradient="from-indigo-500 to-purple-500"
                />
                <KPICard
                    title="Ejecutado"
                    value={formatCurrency(summary?.budget.executed || 0)}
                    subValue={`de ${formatCompact(summary?.budget.total || 0)}`}
                    icon={<TrendingUp />}
                    color="success"
                    gradient="from-emerald-500 to-teal-500"
                />
                <KPICard
                    title="Disponible"
                    value={formatCurrency(summary?.budget.available || 0)}
                    subValue="Saldo restante"
                    icon={<BarChart3 />}
                    color="info"
                    gradient="from-blue-500 to-cyan-500"
                />
                <KPICard
                    title="Requerimientos"
                    value={summary?.requirements.total.toString() || "0"}
                    subValue={`${summary?.requirements.pending || 0} pendientes`}
                    icon={<FileText />}
                    color="warning"
                    trendUp={(summary?.requirements.completed || 0) > (summary?.requirements.pending || 0)}
                    gradient="from-amber-500 to-orange-500"
                />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                <SmallKPICard
                    label="Tasa Finalización"
                    value={`${completionRate}%`}
                    icon={<Award size={18} />}
                    color="green"
                />
                <SmallKPICard
                    label="Facturas"
                    value={summary?.invoices.total.toString() || "0"}
                    icon={<FileText size={18} />}
                    color="blue"
                />
                <SmallKPICard
                    label="Proveedores Activos"
                    value={topSuppliers.length.toString()}
                    icon={<Package size={18} />}
                    color="purple"
                />
                <SmallKPICard
                    label="Monto Facturado"
                    value={formatCompact(summary?.invoices.totalAmount || 0)}
                    icon={<DollarSign size={18} />}
                    color="amber"
                />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                {[
                    { id: 'overview', label: 'Resumen General', icon: <LayoutGrid size={16} /> },
                    { id: 'budget', label: 'Ejecución Presupuestal', icon: <BarChart3 size={16} /> },
                    { id: 'suppliers', label: 'Proveedores', icon: <Users size={16} /> },
                    { id: 'analytics', label: 'Análisis Avanzado', icon: <Activity size={16} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-gradient-to-r from-primary-600 to-purple-600 text-white shadow-lg shadow-primary-500/20'
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
                    {/* Requirements by Status */}
                    <ChartCard
                        title="Requerimientos por Estado"
                        icon={<PieChart size={20} />}
                        color="purple"
                        chartType={statusChartType}
                        onChartTypeChange={setStatusChartType}
                        availableTypes={['donut', 'bar']}
                    >
                        <div className="h-[320px]">
                            {statusChartType === 'donut' ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsPie>
                                        <Pie
                                            data={statusData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={70}
                                            outerRadius={110}
                                            paddingAngle={5}
                                            dataKey="count"
                                            nameKey="label"
                                            label={({ name, value }) => `${name}: ${value}`}
                                        >
                                            {statusData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={STATUS_COLORS[entry.label] || CHART_COLORS[index % CHART_COLORS.length]}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1e293b',
                                                border: 'none',
                                                borderRadius: '12px',
                                                color: '#fff',
                                                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                                            }}
                                        />
                                        <Legend />
                                    </RechartsPie>
                                </ResponsiveContainer>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={statusData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1e293b',
                                                border: 'none',
                                                borderRadius: '12px',
                                                color: '#fff'
                                            }}
                                        />
                                        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                                            {statusData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={STATUS_COLORS[entry.label] || CHART_COLORS[index]}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </ChartCard>

                    {/* Monthly Trend */}
                    <ChartCard
                        title="Tendencia Mensual"
                        icon={<TrendingUp size={20} />}
                        color="blue"
                        chartType={trendChartType}
                        onChartTypeChange={setTrendChartType}
                        availableTypes={['area', 'line', 'bar']}
                    >
                        <div className="h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                {trendChartType === 'area' ? (
                                    <AreaChart data={monthlyTrend}>
                                        <defs>
                                            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.4} />
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
                                ) : trendChartType === 'line' ? (
                                    <RechartsLine data={monthlyTrend}>
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
                                        <Line
                                            type="monotone"
                                            dataKey="amount"
                                            stroke={COLORS.primary}
                                            strokeWidth={3}
                                            dot={{ fill: COLORS.primary, strokeWidth: 2, r: 5 }}
                                            name="Monto"
                                        />
                                    </RechartsLine>
                                ) : (
                                    <BarChart data={monthlyTrend}>
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
                                        <Bar
                                            dataKey="amount"
                                            fill={COLORS.primary}
                                            radius={[8, 8, 0, 0]}
                                            name="Monto"
                                        />
                                    </BarChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>
                </div>
            )}

            {activeTab === 'budget' && (
                <ChartCard
                    title="Ejecución Presupuestal por Proyecto"
                    icon={<BarChart3 size={20} />}
                    color="green"
                    chartType={budgetChartType}
                    onChartTypeChange={setBudgetChartType}
                    availableTypes={['bar']}
                    fullWidth
                >
                    <div className="h-[500px]">
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
                                    width={180}
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
                </ChartCard>
            )}

            {activeTab === 'suppliers' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-black flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg">
                                <Award size={20} />
                            </div>
                            Top 10 Proveedores
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-700">
                                    <th className="pb-4 text-left">#</th>
                                    <th className="pb-4 text-left">Proveedor</th>
                                    <th className="pb-4 text-left">NIT</th>
                                    <th className="pb-4 text-right">Órdenes</th>
                                    <th className="pb-4 text-right">Total Compras</th>
                                    <th className="pb-4 text-right">% del Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topSuppliers.map((supplier, idx) => {
                                    const totalAll = topSuppliers.reduce((sum, s) => sum + s.totalPurchases, 0);
                                    const percentage = totalAll > 0 ? ((supplier.totalPurchases / totalAll) * 100).toFixed(1) : '0';

                                    return (
                                        <motion.tr
                                            key={supplier.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                                        >
                                            <td className="py-4">
                                                <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${idx < 3
                                                    ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg'
                                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500'
                                                    }`}>
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
                                            <td className="py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-primary-500 to-purple-500"
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-500">{percentage}%</span>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}

            {activeTab === 'analytics' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Budget Distribution */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700"
                    >
                        <h3 className="text-lg font-black mb-6 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white shadow-lg">
                                <Target size={20} />
                            </div>
                            Distribución del Presupuesto
                        </h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-bold text-gray-600 dark:text-gray-300">Ejecutado</span>
                                    <span className="text-lg font-black text-indigo-600">{summary?.budget.executionPercentage || 0}%</span>
                                </div>
                                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${summary?.budget.executionPercentage || 0}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-bold text-gray-600 dark:text-gray-300">Disponible</span>
                                    <span className="text-lg font-black text-emerald-600">{100 - (summary?.budget.executionPercentage || 0)}%</span>
                                </div>
                                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${100 - (summary?.budget.executionPercentage || 0)}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Requirements Summary */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700"
                    >
                        <h3 className="text-lg font-black mb-6 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white shadow-lg">
                                <Layers size={20} />
                            </div>
                            Resumen de Requerimientos
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl text-center">
                                <p className="text-3xl font-black text-green-600">{summary?.requirements.completed || 0}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Finalizados</p>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl text-center">
                                <p className="text-3xl font-black text-blue-600">{summary?.requirements.inProgress || 0}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">En Trámite</p>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-2xl text-center">
                                <p className="text-3xl font-black text-yellow-600">{summary?.requirements.pending || 0}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Pendientes</p>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl text-center">
                                <p className="text-3xl font-black text-indigo-600">{summary?.requirements.total || 0}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Total</p>
                            </div>
                        </div>
                    </motion.div>
                </div>
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
    trendUp?: boolean;
    gradient: string;
}

function KPICard({ title, value, subValue, icon, color, trend, trendUp, gradient }: KPICardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className="relative bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden group"
        >
            {/* Gradient overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg`}>
                        {icon}
                    </div>
                    {trend !== undefined && (
                        <div className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl ${trend > 50 ? 'bg-green-100 text-green-700' : trend > 25 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {trend > 50 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            {trend.toFixed(0)}%
                        </div>
                    )}
                    {trendUp !== undefined && (
                        <div className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl ${trendUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
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

// Small KPI Card
function SmallKPICard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
    const colorClasses: Record<string, string> = {
        green: 'bg-green-50 dark:bg-green-900/20 text-green-600',
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
        purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600',
        amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700"
        >
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
                    {icon}
                </div>
                <div>
                    <p className="text-lg font-black">{value}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                </div>
            </div>
        </motion.div>
    );
}

// Chart Card Component
interface ChartCardProps {
    title: string;
    icon: React.ReactNode;
    color: string;
    chartType: ChartType;
    onChartTypeChange: (type: ChartType) => void;
    availableTypes: ChartType[];
    children: React.ReactNode;
    fullWidth?: boolean;
}

function ChartCard({ title, icon, color, chartType, onChartTypeChange, availableTypes, children, fullWidth }: ChartCardProps) {
    const colorClasses: Record<string, string> = {
        purple: 'from-purple-400 to-violet-500',
        blue: 'from-blue-400 to-cyan-500',
        green: 'from-green-400 to-emerald-500',
        amber: 'from-amber-400 to-orange-500'
    };

    const chartIcons: Record<ChartType, React.ReactNode> = {
        bar: <BarChart3 size={14} />,
        line: <LineChart size={14} />,
        area: <AreaChartIcon size={14} />,
        donut: <PieChart size={14} />
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 ${fullWidth ? 'col-span-full' : ''}`}
        >
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center text-white shadow-lg`}>
                        {icon}
                    </div>
                    {title}
                </h3>

                {/* Chart Type Selector */}
                {availableTypes.length > 1 && (
                    <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-700 rounded-xl">
                        {availableTypes.map(type => (
                            <button
                                key={type}
                                onClick={() => onChartTypeChange(type)}
                                className={`p-2 rounded-lg transition-all ${chartType === type
                                    ? 'bg-white dark:bg-slate-600 shadow-sm text-primary-600'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {chartIcons[type]}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {children}
        </motion.div>
    );
}
