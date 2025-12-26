"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    PieChart, TrendingUp, DollarSign, Wallet, Target,
    ArrowUpRight, List, LayoutGrid, Plus, Search,
    ChevronRight, X, User, Briefcase, Building2, Package,
    ArrowRightCircle, FileText, Download, FileSpreadsheet, Edit, Trash2, AlertTriangle, Calendar
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { exportBudgets } from "@/lib/excelExport";
import { useToastStore } from "@/store/toastStore";

export default function BudgetsPage() {
    const { user } = useAuthStore();
    const { addToast } = useToastStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
    const isFinancial = user?.role?.toUpperCase() === 'DIRECTOR' || isAdmin;

    const [budgets, setBudgets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedBudget, setSelectedBudget] = useState<any>(null);
    const [budgetRequirements, setBudgetRequirements] = useState([]);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [budgetToDelete, setBudgetToDelete] = useState<any>(null);

    // Form state
    const [formData, setFormData] = useState({
        id: '',
        amount: '',
        projectId: '',
        areaId: '',
        managerId: '',
        categoryId: '',
        executionDate: ''
    });

    const [filters, setFilters] = useState({
        projectId: '',
        areaId: ''
    });

    // Catalog data for select inputs
    const [projects, setProjects] = useState([]);
    const [areas, setAreas] = useState([]);
    const [users, setUsers] = useState([]);
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        fetchBudgets();
        if (isAdmin) {
            fetchCatalogs();
        }
    }, [isAdmin]);

    const fetchBudgets = async () => {
        setLoading(true);
        try {
            const response = await api.get("/budgets");
            setBudgets(response.data);
        } catch (err) {
            console.error("Error al obtener presupuestos", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCatalogs = async () => {
        try {
            const [p, a, c] = await Promise.all([
                api.get('/projects'),
                api.get('/areas'),
                api.get('/categories')
            ]);
            setProjects(p.data);
            setAreas(a.data);
            setCategories(c.data);

            // Mock fetching users - in real app would be an endpoint
            // For now using budget managers from budgets call plus extras
            // Simulating a fetch of potential managers
            const mockUsers = [
                { id: 'mock-admin-id', name: 'Dairon Moreno', role: 'ADMIN' },
                { id: 'mock-user-id', name: 'Usuario Prueba', role: 'USER' },
                { id: 'mock-leader-id', name: 'Líder Área', role: 'LEADER' }
            ];
            setUsers(mockUsers as any);
        } catch (err) {
            console.error("Error al obtener catálogos", err);
        }
    };

    const fetchBudgetDetails = async (budget: any) => {
        setSelectedBudget(budget);
        try {
            const res = await api.get(`/requirements?budgetId=${budget.id}`);
            setBudgetRequirements(res.data);
        } catch (err) {
            console.error("Error al obtener requerimientos del presupuesto", err);
        }
    };

    const handleCreateBudget = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Creando presupuesto con datos:", formData);
        try {
            await api.post('/budgets', {
                ...formData,
                amount: parseFloat(formData.amount)
            });
            setShowCreateModal(false);
            addToast({ type: 'success', message: 'Presupuesto creado exitosamente' });
            fetchBudgets();
            setFormData({ id: '', amount: '', projectId: '', areaId: '', managerId: '', categoryId: '', executionDate: '' });
        } catch (err: any) {
            console.error("Error al crear presupuesto:", err);
            const msg = err.response?.data?.message || err.message || "Error desconocido";
            alert(`Error al crear presupuesto: ${msg}`);
        }
    };

    const handleEditClick = (budget: any) => {
        setFormData({
            id: budget.id,
            amount: budget.amount,
            projectId: budget.projectId,
            areaId: budget.areaId,
            managerId: budget.managerId,
            categoryId: budget.categoryId,
            executionDate: budget.executionDate || ''
        });
        setShowEditModal(true);
    };

    const handleUpdateBudget = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.put(`/budgets/${formData.id}`, {
                amount: parseFloat(formData.amount),
                projectId: formData.projectId,
                areaId: formData.areaId,
                managerId: formData.managerId,
                categoryId: formData.categoryId
            });
            setShowEditModal(false);
            fetchBudgets();
            setFormData({ id: '', amount: '', projectId: '', areaId: '', managerId: '', categoryId: '', executionDate: '' });
        } catch (err: any) {
            console.error("Error al actualizar presupuesto:", err);
            const msg = err.response?.data?.message || err.message || "Error desconocido";
            alert(`Error al actualizar presupuesto: ${msg}`);
        }
    };

    const handleDeleteClick = (budget: any) => {
        setBudgetToDelete(budget);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!budgetToDelete) return;
        try {
            await api.delete(`/budgets/${budgetToDelete.id}`);
            setShowDeleteModal(false);
            setBudgetToDelete(null);
            fetchBudgets();
        } catch (err) {
            alert("Error al eliminar presupuesto");
        }
    };

    const totalAvailable = budgets.reduce((acc, b: any) => acc + parseFloat(b.available), 0);

    return (
        <div className="p-6 lg:p-12 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div>
                    <h2 className="text-4xl font-black tracking-tight mb-2">Presupuestos</h2>
                    <p className="text-gray-500 font-medium">Gestión financiera y control de activos por área.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-white dark:bg-slate-800 px-6 py-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hidden sm:flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                            <DollarSign className="text-green-600 w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[8px] font-black uppercase text-gray-400">Total En Bolsa</p>
                            <p className="font-black text-lg">${(totalAvailable / 1e6).toFixed(1)}M</p>
                        </div>
                    </div>

                    <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-2 rounded-xl transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <List size={20} />
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            try {
                                exportBudgets(budgets);
                            } catch (error) {
                                console.error('Error al exportar:', error);
                                alert('Error al generar el archivo Excel');
                            }
                        }}
                        className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 px-6 py-4 rounded-2xl font-black shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 uppercase text-[10px] tracking-widest"
                    >
                        <FileSpreadsheet size={18} className="text-green-600" />
                        <Download size={18} className="text-primary-600" />
                        <span>EXPORTAR XLSX</span>
                    </button>

                    {mounted && isFinancial && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-slate-900 dark:bg-primary-600 text-white px-6 py-4 rounded-2xl font-black shadow-xl hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <Plus size={20} /> Nuevo Presupuesto
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700 mb-10 flex gap-4 items-center">
                <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl text-gray-400">
                    <Search size={20} />
                </div>
                <select
                    value={filters.projectId}
                    onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
                    className="bg-transparent font-bold text-sm outline-none text-gray-600 dark:text-gray-300 cursor-pointer"
                >
                    <option value="">Todos los Proyectos</option>
                    {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-2"></div>
                <select
                    value={filters.areaId}
                    onChange={(e) => setFilters({ ...filters, areaId: e.target.value })}
                    className="bg-transparent font-bold text-sm outline-none text-gray-600 dark:text-gray-300 cursor-pointer"
                >
                    <option value="">Todas las Áreas</option>
                    {areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="py-24 text-center">
                    <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Sincronizando estados financieros...</p>
                </div>
            ) : budgets.length === 0 ? (
                <div className="py-24 text-center bg-white dark:bg-slate-800 rounded-[3rem] border border-dashed border-gray-200 dark:border-gray-700 mt-8">
                    <p className="text-gray-400 font-black uppercase text-xs">No hay presupuestos activos en tu área</p>
                </div>
            ) : (
                <>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {budgets
                                .filter((b: any) => {
                                    if (filters.projectId && b.projectId !== filters.projectId) return false;
                                    if (filters.areaId && b.areaId !== filters.areaId) return false;
                                    return true;
                                })
                                .map((budget: any, idx) => (
                                    <BudgetCard
                                        key={budget.id}
                                        budget={budget}
                                        index={idx}
                                        isFinancial={isFinancial}
                                        mounted={mounted}
                                        onClick={() => fetchBudgetDetails(budget)}
                                        onEdit={handleEditClick}
                                        onDelete={handleDeleteClick}
                                    />
                                ))}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-gray-700">
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Proyecto / Área</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Líder</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Asignado</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Disponible</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Ejecución</th>
                                        <th className="p-6"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {budgets.map((budget: any) => {
                                        const spent = parseFloat(budget.amount) - parseFloat(budget.available);
                                        const percentage = (spent / parseFloat(budget.amount)) * 100;
                                        return (
                                            <tr key={budget.id} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors group">
                                                <td className="p-6">
                                                    <p className="font-black text-sm mb-1">{budget.project?.name || 'Sin Proyecto'}</p>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{budget.area?.name || 'Sin Área'}</p>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                                                            <User size={14} className="text-primary-500" />
                                                        </div>
                                                        <span className="text-xs font-bold">{budget.manager?.name || 'No asignado'}</span>
                                                    </div>
                                                </td>
                                                <td className="p-6 font-black text-sm">${parseFloat(budget.amount).toLocaleString()}</td>
                                                <td className="p-6 font-black text-sm text-green-500">${parseFloat(budget.available).toLocaleString()}</td>
                                                <td className="p-6 w-48">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-900 rounded-full overflow-hidden">
                                                            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${percentage}%` }}></div>
                                                        </div>
                                                        <span className="text-[10px] font-black text-primary-600">{percentage.toFixed(0)}%</span>
                                                    </div>
                                                </td>
                                                <td className="p-6 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {mounted && isFinancial && (
                                                            <>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleEditClick(budget); }}
                                                                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                                >
                                                                    <Edit size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(budget); }}
                                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                        <button
                                                            onClick={() => fetchBudgetDetails(budget)}
                                                            className="p-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-400 hover:text-primary-600 rounded-xl transition-all"
                                                        >
                                                            <ChevronRight size={20} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* Create Budget Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowCreateModal(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-[3rem] shadow-3xl overflow-hidden p-10 pt-12"
                        >
                            <button onClick={() => setShowCreateModal(false)} className="absolute top-8 right-8 p-3 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-2xl transition-all">
                                <X size={20} />
                            </button>
                            <h3 className="text-3xl font-black mb-2 tracking-tight">Nuevo Presupuesto</h3>
                            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-10">Asignación de recursos institucionales</p>

                            <form onSubmit={handleCreateBudget} className="space-y-6">
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Rubro (Categoría)</label>
                                        <div className="relative">
                                            <List className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <select
                                                required
                                                value={formData.categoryId}
                                                onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold appearance-none focus:ring-2 focus:ring-primary-500 outline-none"
                                            >
                                                <option value="">Seleccionar Rubro...</option>
                                                {categories.map((c: any) => (
                                                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Monto Total</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="number" required
                                                value={formData.amount}
                                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all placeholder:text-gray-300"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Fecha Límite</label>
                                        <div className="relative">
                                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400">
                                                <Target size={18} />
                                            </div>
                                            <input
                                                type="date"
                                                required
                                                value={formData.executionDate}
                                                onChange={e => setFormData({ ...formData, executionDate: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all uppercase text-xs text-gray-600 dark:text-gray-300"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Proyecto Asociado</label>
                                        <div className="relative">
                                            <Briefcase className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <select
                                                required
                                                value={formData.projectId}
                                                onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold appearance-none focus:ring-2 focus:ring-primary-500 outline-none"
                                            >
                                                <option value="">Seleccionar...</option>
                                                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Área Responsable</label>
                                            <div className="relative">
                                                <Building2 className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                <select
                                                    required
                                                    value={formData.areaId}
                                                    onChange={e => setFormData({ ...formData, areaId: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold appearance-none focus:ring-2 focus:ring-primary-500 outline-none"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Líder de Gestión</label>
                                            <div className="relative">
                                                <User className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                <select
                                                    required
                                                    value={formData.managerId}
                                                    onChange={e => setFormData({ ...formData, managerId: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold appearance-none focus:ring-2 focus:ring-primary-500 outline-none"
                                                >
                                                    <option value="">Asignar líder...</option>
                                                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={(e) => handleCreateBudget(e as any)}
                                    className="w-full bg-slate-900 dark:bg-primary-600 text-white py-6 rounded-3xl font-black shadow-2xl hover:bg-slate-800 dark:hover:bg-primary-500 transition-all mt-6 active:scale-[0.98]"
                                >
                                    Guardar Presupuesto
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )
                }
            </AnimatePresence >

            {/* Edit Modal */}
            <AnimatePresence>
                {
                    showEditModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setShowEditModal(false)}
                                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-[3rem] shadow-3xl overflow-hidden p-10 pt-12"
                            >
                                <button onClick={() => setShowEditModal(false)} className="absolute top-8 right-8 p-3 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-2xl transition-all">
                                    <X size={20} />
                                </button>
                                <h3 className="text-3xl font-black mb-2 tracking-tight">Editar Presupuesto</h3>
                                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-10">Modificar asignación de recursos</p>

                                <form onSubmit={handleUpdateBudget} className="space-y-6">
                                    <div className="grid grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Rubro (Categoría)</label>
                                            <div className="relative">
                                                <List className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                <select
                                                    required
                                                    value={formData.categoryId}
                                                    onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold appearance-none focus:ring-2 focus:ring-primary-500 outline-none"
                                                >
                                                    <option value="">Seleccionar Rubro...</option>
                                                    {categories.map((c: any) => (
                                                        <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Monto Asignado</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                <input
                                                    type="number" required
                                                    value={formData.amount}
                                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Fecha Límite</label>
                                            <div className="relative">
                                                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400">
                                                    <Target size={18} />
                                                </div>
                                                <input
                                                    type="date"
                                                    required
                                                    value={formData.executionDate}
                                                    onChange={e => setFormData({ ...formData, executionDate: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all uppercase text-xs text-gray-600 dark:text-gray-300"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Proyecto</label>
                                            <div className="relative">
                                                <Briefcase className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                <select
                                                    required value={formData.projectId}
                                                    onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold appearance-none focus:ring-2 focus:ring-primary-500 outline-none"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Área</label>
                                                <div className="relative">
                                                    <Building2 className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    <select
                                                        required value={formData.areaId}
                                                        onChange={e => setFormData({ ...formData, areaId: e.target.value })}
                                                        className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold appearance-none focus:ring-2 focus:ring-primary-500 outline-none"
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        {areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Líder</label>
                                                <div className="relative">
                                                    <User className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    <select
                                                        required value={formData.managerId}
                                                        onChange={e => setFormData({ ...formData, managerId: e.target.value })}
                                                        className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold appearance-none focus:ring-2 focus:ring-primary-500 outline-none"
                                                    >
                                                        <option value="">Líder...</option>
                                                        {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full bg-premium-gradient text-white py-5 rounded-2xl font-black shadow-2xl hover:-translate-y-1 hover:shadow-primary-500/30 transition-all active:scale-95">
                                        Actualizar Presupuesto
                                    </button>
                                </form>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >

            {/* Delete Modal */}
            <AnimatePresence>
                {
                    showDeleteModal && budgetToDelete && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setShowDeleteModal(false)}
                                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-[3rem] shadow-3xl p-10 text-center"
                            >
                                <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6">
                                    <AlertTriangle className="w-10 h-10 text-red-600" />
                                </div>
                                <h3 className="text-2xl font-black mb-3">¿Eliminar Presupuesto?</h3>
                                <p className="text-sm mb-2"><span className="font-bold">{budgetToDelete.project?.name}</span></p>
                                <p className="text-xs text-gray-400 mb-8">Esta acción no se puede deshacer</p>
                                <div className="flex gap-4">
                                    <button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all">
                                        Cancelar
                                    </button>
                                    <button onClick={handleConfirmDelete} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 hover:-translate-y-1 shadow-lg transition-all">
                                        Eliminar
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >

            {/* Budget Details + Requirements Modal */}
            <AnimatePresence>
                {
                    selectedBudget && (
                        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setSelectedBudget(null)}
                                className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
                            />
                            <motion.div
                                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                                className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-t-[3rem] sm:rounded-[3rem] shadow-3xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[85vh]"
                            >
                                <div className="p-8 pb-0 flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-600 rounded-full text-[9px] font-black uppercase tracking-widest">{selectedBudget.area.name}</span>
                                            <span className="text-[10px] font-bold text-gray-400">ID: {selectedBudget.id.substring(0, 8)}</span>
                                        </div>
                                        <h3 className="text-3xl font-black tracking-tight">{selectedBudget.project.name}</h3>
                                    </div>
                                    <button onClick={() => setSelectedBudget(null)} className="p-3 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <DetailCard label="Asignado" value={`$${parseFloat(selectedBudget.amount).toLocaleString()}`} icon={<Wallet size={20} />} />
                                    <DetailCard label="Disponible" value={`$${parseFloat(selectedBudget.available).toLocaleString()}`} icon={<CheckCircleIcon size={20} />} highlight />
                                    <DetailCard label="Líder Responsable" value={selectedBudget.manager?.name || 'Administración Central'} icon={<User size={20} />} />
                                </div>

                                <div className="flex-1 overflow-hidden flex flex-col p-8 pt-0">
                                    <div className="flex items-center justify-between mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                                        <h4 className="font-black uppercase text-[10px] tracking-widest text-gray-400 flex items-center gap-2">
                                            <FileText size={14} /> Requerimientos Vinculados
                                        </h4>
                                        <span className="text-[10px] font-black bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-full">{budgetRequirements.length} solicitudes</span>
                                    </div>

                                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                        {budgetRequirements.length === 0 ? (
                                            <div className="text-center py-20 bg-gray-50/50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                                                <p className="text-gray-400 font-bold text-xs uppercase">No hay gastos cargados a este presupuesto aún</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3 pb-8">
                                                {budgetRequirements.map((req: any) => (
                                                    <div key={req.id} className="p-5 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl flex items-center justify-between group hover:border-primary-200 transition-all">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-primary-500 shadow-sm">
                                                                <Package size={18} />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-sm leading-none mb-1">{req.title}</p>
                                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">ID: {req.id.substring(0, 8)} • {req.status}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-6">
                                                            <div className="text-right">
                                                                <p className="text-sm font-black text-slate-800 dark:text-white">${parseFloat(req.totalAmount).toLocaleString()}</p>
                                                                <p className="text-[9px] text-gray-400 font-bold uppercase">Monto Ejecutado</p>
                                                            </div>
                                                            <button className="p-2 text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                                                                <ArrowRightCircle size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >
        </div >
    );
}

function BudgetCard({ budget, index, onClick, onEdit, onDelete, isFinancial, mounted }: any) {
    const spent = parseFloat(budget.amount) - parseFloat(budget.available);
    const percentage = (spent / parseFloat(budget.amount)) * 100;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={onClick}
            className="group cursor-pointer bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden relative active:scale-95 transition-all"
        >
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                    <div className="flex-1">
                        <h3 className="text-2xl font-black tracking-tight mb-1 group-hover:text-primary-600 transition-colors line-clamp-1">
                            {budget.category?.code} {budget.category?.name || 'Sin Rubro'}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500">{budget.project.name}</span>
                            <span className="text-gray-300">•</span>
                            <div className="flex items-center gap-1">
                                <Target size={12} className="text-primary-500" />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{budget.area.name}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-all shadow-lg">
                        <TrendingUp size={24} />
                    </div>
                    {mounted && isFinancial && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(budget); }}
                                className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                                title="Editar"
                            >
                                <Edit size={16} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(budget); }}
                                className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                                title="Eliminar"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-8 mb-10 border-b border-gray-50 dark:border-gray-700 pb-8">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Asignado</p>
                        <p className="text-2xl font-black tracking-tighter">${(parseFloat(budget.amount) / 1e6).toFixed(1)}M</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Disponible</p>
                        <p className="text-2xl font-black tracking-tighter text-green-500">${(parseFloat(budget.available) / 1e6).toFixed(1)}M</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-slate-900 flex items-center justify-center shrink-0">
                                <User size={14} className="text-gray-400" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-[8px] font-black uppercase text-gray-400 leading-none mb-1">Responsable</p>
                                <p className="text-xs font-bold truncate">{budget.manager?.name || 'Administración Central'}</p>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-[8px] font-black uppercase text-gray-400 leading-none mb-1">Vence</p>
                            <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1 justify-end">
                                <Calendar size={12} className={budget.executionDate && new Date(budget.executionDate) < new Date() ? "text-red-500" : "text-gray-400"} />
                                {budget.executionDate ? new Date(budget.executionDate).toLocaleDateString() : 'N/A'}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ejecución</p>
                            <p className="text-sm font-black text-primary-600">{percentage.toFixed(1)}%</p>
                        </div>
                        <div className="h-4 w-full bg-gray-50 dark:bg-slate-900 rounded-full overflow-hidden p-1">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className={`h-full rounded-full ${percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-yellow-500' : 'bg-primary-500'}`}
                            ></motion.div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Decorative bg element */}
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
        </motion.div>
    );
}

function DetailCard({ label, value, icon, highlight = false }: any) {
    return (
        <div className={`p-6 rounded-3xl border transition-all ${highlight ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' : 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-gray-700'}`}>
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${highlight ? 'bg-green-500 text-white' : 'bg-white dark:bg-slate-900 text-gray-400 border border-gray-100 dark:border-gray-700'}`}>
                    {icon}
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{label}</p>
                    <p className={`text-lg font-black ${highlight ? 'text-green-700 dark:text-green-400' : ''}`}>{value}</p>
                </div>
            </div>
        </div>
    );
}

function CheckCircleIcon({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
    );
}
