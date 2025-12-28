"use client";

import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { motion } from 'framer-motion';
import { AlertTriangle, TrendingUp, TrendingDown, Wallet, DollarSign, PieChart as PieIcon, BarChart3, Activity } from 'lucide-react';

interface Budget {
    id: string;
    title: string;
    amount: number;
    available: number;
    year: number;
    project?: { name: string };
    area?: { name: string };
    category?: { name: string };
}

interface VisualDashboardProps {
    budgets: Budget[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function VisualDashboard({ budgets }: VisualDashboardProps) {
    // Data processing for charts
    const projectData = useMemo(() => {
        const groups: Record<string, { name: string, total: number, spent: number }> = {};
        budgets.forEach(b => {
            const projectName = b.project?.name || 'Sin Proyecto';
            if (!groups[projectName]) {
                groups[projectName] = { name: projectName, total: 0, spent: 0 };
            }
            groups[projectName].total += Number(b.amount);
            groups[projectName].spent += (Number(b.amount) - Number(b.available));
        });
        return Object.values(groups).sort((a, b) => b.total - a.total).slice(0, 8);
    }, [budgets]);

    const categoryData = useMemo(() => {
        const groups: Record<string, { name: string, value: number }> = {};
        budgets.forEach(b => {
            const catName = b.category?.name || 'Sin Categoría';
            if (!groups[catName]) {
                groups[catName] = { name: catName, value: 0 };
            }
            groups[catName].value += Number(b.amount);
        });
        return Object.values(groups).sort((a, b) => b.value - a.value).slice(0, 6);
    }, [budgets]);

    const stats = useMemo(() => {
        const total = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
        const available = budgets.reduce((sum, b) => sum + Number(b.available), 0);
        const spent = total - available;
        const executionPct = total > 0 ? (spent / total) * 100 : 0;
        const critical = budgets.filter(b => (Number(b.available) / Number(b.amount)) < 0.1).length;

        return { total, available, spent, executionPct, critical };
    }, [budgets]);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(val);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl shadow-2xl backdrop-blur-md">
                    <p className="font-black text-white mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                            <span className="text-gray-400 capitalize">{entry.name}:</span>
                            <span className="text-white font-bold">{formatCurrency(entry.value)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Top Dashboard Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group shadow-2xl border border-white/5"
                >
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-primary-600/20 flex items-center justify-center text-primary-400">
                                <Activity size={24} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary-400">Ejecución Total</span>
                        </div>
                        <div className="flex items-end gap-3 mb-2">
                            <h3 className="text-5xl font-black">{stats.executionPct.toFixed(1)}%</h3>
                            <TrendingUp size={20} className="text-green-400 mb-2" />
                        </div>
                        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${stats.executionPct}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full"
                            />
                        </div>
                    </div>
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-primary-600/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                </motion.div>

                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-gray-100 dark:border-white/5 shadow-xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                                <DollarSign size={20} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ejecutado (Hoy)</span>
                        </div>
                        <p className="text-3xl font-black">{formatCurrency(stats.spent)}</p>
                        <p className="text-xs text-gray-400 mt-2 font-medium">De un presupuesto total de {formatCurrency(stats.total)}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-gray-100 dark:border-white/5 shadow-xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                                <AlertTriangle size={20} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Alertas Críticas</span>
                        </div>
                        <p className="text-3xl font-black text-red-500">{stats.critical}</p>
                        <p className="text-xs text-gray-400 mt-2 font-medium">Presupuestos con menos del 10% disponible</p>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Bar Chart: Budget vs Spent by Project */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 border border-gray-100 dark:border-white/5 shadow-xl"
                >
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
                                <BarChart3 size={20} />
                            </div>
                            <h4 className="text-xl font-black tracking-tight uppercase">Ejecución por Proyecto</h4>
                        </div>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={projectData} layout="vertical" margin={{ left: 20, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.1} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                                    width={120}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="spent" name="Ejecutado" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                <Bar dataKey="total" name="Total Presupuestado" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Pie Chart: Distribution by Category */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 border border-gray-100 dark:border-white/5 shadow-xl"
                >
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                                <PieIcon size={20} />
                            </div>
                            <h4 className="text-xl font-black tracking-tight uppercase">Inversión por Categoría</h4>
                        </div>
                    </div>
                    <div className="h-[350px] w-full flex flex-col md:flex-row items-center">
                        <div className="flex-1 w-full h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={120}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full md:w-48 space-y-3">
                            {categoryData.map((entry, index) => (
                                <div key={index} className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                        <span className="text-[10px] font-black text-gray-500 uppercase truncate">{entry.name}</span>
                                    </div>
                                    <span className="text-[10px] font-black">{((entry.value / stats.total) * 100).toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
