"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Save, X, Plus, Trash2, List, DollarSign, Building2, Briefcase,
    User, Calendar, FileText, Package, ArrowLeft
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import SearchableSelect from "@/components/SearchableSelect";

interface Project {
    id: string;
    name: string;
    code: string;
    leader?: { id: string; name: string; email: string; areaId?: string };
}
interface Area { id: string; name: string }
interface Category { id: string; name: string; code: string }
interface UserOption { id: string; name: string; email?: string; role: string }

interface BudgetItem {
    id: string;
    title: string;
    code: string;
    amount: string;
    description: string;
    projectId: string;
    areaId: string;
    categoryId: string;
    managerId: string;
    subLeaders: string[];
    expirationDate: string;
    // Display names
    projectName: string;
    areaName: string;
    categoryName: string;
    managerName: string;
}

export default function NewBudgetPage() {
    const { user } = useAuthStore();
    const { addToast } = useToastStore();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Only DIRECTOR can create budgets
    const userRole = user?.role?.toUpperCase() || 'USER';
    const canManageBudgets = userRole === 'DIRECTOR';

    // List of items to submit
    const [items, setItems] = useState<BudgetItem[]>([]);

    // Current form data
    const [formData, setFormData] = useState({
        title: '',
        code: '',
        amount: '',
        description: '',
        projectId: '',
        areaId: '',
        categoryId: '',
        managerId: '',
        subLeaders: [] as string[],
        expirationDate: ''
    });

    // Options for selects
    const [projects, setProjects] = useState<Project[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [catalogsLoading, setCatalogsLoading] = useState(true);

    // Year for budgets
    const currentYear = new Date().getFullYear();

    const fetchCatalogs = useCallback(async () => {
        setCatalogsLoading(true);
        try {
            const [p, a, c, u] = await Promise.all([
                api.get('/projects'),
                api.get('/areas'),
                api.get('/categories'),
                api.get('/budgets/manager-options')
            ]);

            setProjects(p.data);
            setAreas(a.data);
            setCategories(c.data);
            setUsers(u.data);
        } catch (err) {
            console.error("Error fetching catalogs:", err);
            addToast('Error al cargar catálogos', 'error');
        } finally {
            setCatalogsLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchCatalogs();
    }, [fetchCatalogs]);

    // Redirect non-director users
    useEffect(() => {
        if (!canManageBudgets && user) {
            addToast('No tienes permisos para crear presupuestos', 'error');
            router.push('/budget');
        }
    }, [canManageBudgets, user, addToast, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Auto-fill code, managerId, and areaId when project is selected
    const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const projectId = e.target.value;
        const selectedProject = projects.find(p => p.id === projectId);

        setFormData(prev => ({
            ...prev,
            projectId,
            code: selectedProject?.code || '',
            managerId: selectedProject?.leader?.id || '',
            areaId: (selectedProject?.leader as any)?.areaId || prev.areaId // Auto-fill area from leader's area
        }));
    };

    const addItem = () => {
        // Validate required fields including title (Actividad)
        if (!formData.title || !formData.amount || !formData.projectId || !formData.areaId || !formData.categoryId) {
            addToast('Completa los campos obligatorios: Actividad, Proyecto, Área, Categoría y Monto', 'warning');
            return;
        }

        // Check for duplicate title within same project+category
        const duplicate = items.find(
            item => item.projectId === formData.projectId &&
                item.categoryId === formData.categoryId &&
                item.title.toLowerCase() === formData.title.toLowerCase()
        );
        if (duplicate) {
            addToast('Ya existe un presupuesto con la misma Actividad para este proyecto y categoría', 'warning');
            return;
        }

        const project = projects.find(p => p.id === formData.projectId);
        const area = areas.find(a => a.id === formData.areaId);
        const category = categories.find(c => c.id === formData.categoryId);
        const manager = users.find(u => u.id === formData.managerId);

        const newItem: BudgetItem = {
            ...formData,
            id: Math.random().toString(36).substr(2, 9),
            projectName: project?.name || '',
            areaName: area?.name || '',
            categoryName: category?.name || '',
            managerName: manager?.name || ''
        };

        setItems(prev => [...prev, newItem]);

        // Reset form but keep project/area for convenience
        setFormData(prev => ({
            ...prev,
            title: '',
            amount: '',
            description: '',
            categoryId: '',
            subLeaders: [],
            expirationDate: ''
            // Keep projectId, areaId, code, managerId for convenience
        }));

        addToast('Presupuesto agregado a la lista', 'success');
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const formatCurrency = (value: string) => {
        const num = parseFloat(value);
        if (isNaN(num)) return '$0';
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(num);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0) {
            addToast('Agrega al menos un presupuesto antes de enviar', 'warning');
            return;
        }

        setLoading(true);
        try {
            await api.post('/budgets/mass-create', {
                budgets: items.map(item => ({
                    title: item.title,
                    code: item.code || undefined,
                    amount: parseFloat(item.amount),
                    description: item.description || undefined,
                    projectId: item.projectId,
                    areaId: item.areaId,
                    categoryId: item.categoryId || undefined,
                    managerId: item.managerId || undefined,
                    subLeaders: item.subLeaders.length > 0 ? item.subLeaders : undefined,
                    expirationDate: item.expirationDate || undefined,
                    year: currentYear
                }))
            });

            addToast(`${items.length} presupuesto(s) creado(s) exitosamente`, 'success');
            router.push("/budget");
        } catch (err: any) {
            console.error("Error creating budgets:", err);
            addToast("Error al crear presupuestos: " + (err.response?.data?.error || err.message), 'error');
        } finally {
            setLoading(false);
        }
    };

    const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    if (!canManageBudgets) {
        return null;
    }

    return (
        <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 flex justify-between items-end"
            >
                <div>
                    <button
                        onClick={() => router.back()}
                        className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-primary-600 flex items-center gap-2 mb-4 transition-colors"
                    >
                        <ArrowLeft size={12} /> Volver a Presupuestos
                    </button>
                    <h2 className="text-4xl font-black tracking-tight mb-2">Creación Múltiple</h2>
                    <p className="text-gray-500 font-medium">Agrega varios presupuestos antes de enviar a aprobación.</p>
                </div>

                {items.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-4 bg-green-50 dark:bg-green-900/20 px-6 py-4 rounded-2xl border border-green-100 dark:border-green-800"
                    >
                        <DollarSign className="text-green-600" size={20} />
                        <div>
                            <p className="text-[10px] font-black uppercase text-green-600 tracking-widest">Total</p>
                            <p className="font-black text-xl">{formatCurrency(totalAmount.toString())}</p>
                        </div>
                    </motion.div>
                )}
            </motion.div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                {/* Form Section */}
                <div className="xl:col-span-7 space-y-8">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-8 border-b border-gray-50 dark:border-gray-700 pb-6">
                            <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center text-primary-600">
                                <Plus size={20} />
                            </div>
                            <h3 className="text-xl font-black tracking-tight">Agregar Presupuesto</h3>
                        </div>

                        {catalogsLoading ? (
                            <div className="text-center py-12">
                                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-gray-400 font-bold">Cargando catálogos...</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* 1. Proyecto (with auto-fill of code and leader) */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">
                                        Proyecto *
                                    </label>
                                    <div className="z-30 border border-transparent dark:border-gray-700 rounded-2xl overflow-hidden bg-gray-50 dark:bg-slate-900">
                                        <SearchableSelect
                                            value={formData.projectId}
                                            onChange={(val) => handleProjectChange({ target: { value: val } } as any)}
                                            options={[
                                                { value: "", label: "Selecciona proyecto" },
                                                ...projects.map(p => ({ value: p.id, label: p.name }))
                                            ]}
                                        />
                                    </div>
                                    {/* Auto-filled info from project */}
                                    {formData.projectId && (
                                        <div className="flex gap-4 mt-3 ml-1">
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span className="font-black text-gray-400">Código:</span>
                                                <span className="font-bold text-primary-600">{formData.code || 'Sin código'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span className="font-black text-gray-400">Líder:</span>
                                                <span className="font-bold text-primary-600">
                                                    {projects.find(p => p.id === formData.projectId)?.leader?.name || 'Sin asignar'}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 2. Área */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">
                                        Área *
                                    </label>
                                    <div className="z-20 border border-transparent dark:border-gray-700 rounded-2xl overflow-hidden bg-gray-50 dark:bg-slate-900">
                                        <SearchableSelect
                                            value={formData.areaId}
                                            onChange={(val) => setFormData(prev => ({ ...prev, areaId: val }))}
                                            options={[
                                                { value: "", label: "Selecciona área" },
                                                ...areas.map(a => ({ value: a.id, label: a.name }))
                                            ]}
                                        />
                                    </div>
                                </div>

                                {/* 3. Categoría */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">
                                        Rubro / Categoría *
                                    </label>
                                    <div className="z-10 border border-transparent dark:border-gray-700 rounded-2xl overflow-hidden bg-gray-50 dark:bg-slate-900">
                                        <SearchableSelect
                                            value={formData.categoryId}
                                            onChange={(val) => setFormData(prev => ({ ...prev, categoryId: val }))}
                                            options={[
                                                { value: "", label: "Sin categoría" },
                                                ...categories.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))
                                            ]}
                                        />
                                    </div>
                                </div>

                                {/* 4. Actividad (título manual) */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">
                                        Actividad *
                                    </label>
                                    <input
                                        type="text"
                                        name="title"
                                        value={formData.title}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold"
                                        placeholder="Nombre de la actividad o concepto..."
                                    />
                                    <p className="text-[9px] text-gray-400 mt-2 ml-1 font-medium">
                                        Debe ser única para cada combinación de proyecto y categoría.
                                    </p>
                                </div>

                                {/* 5. Monto */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">
                                        Monto Presupuestado *
                                    </label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="number"
                                            name="amount"
                                            value={formData.amount}
                                            onChange={handleChange}
                                            className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 pl-12 pr-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold text-xl"
                                            placeholder="0"
                                        />
                                    </div>
                                    {formData.amount && (
                                        <p className="text-sm text-primary-600 font-bold mt-2 ml-1">
                                            {formatCurrency(formData.amount)}
                                        </p>
                                    )}
                                </div>

                                {/* 5. Descripción */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">
                                        Descripción / Notas
                                    </label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        rows={3}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium"
                                        placeholder="Descripción del presupuesto..."
                                    />
                                </div>

                                {/* 6. Fecha de Vencimiento */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">
                                        Fecha de Vencimiento (opcional)
                                    </label>
                                    <input
                                        type="date"
                                        name="expirationDate"
                                        value={formData.expirationDate}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="w-full bg-gray-800 dark:bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] hover:bg-gray-700 transition-all flex items-center justify-center gap-3"
                                >
                                    <Plus size={18} /> Agregar a la lista
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* List Summary Section */}
                <div className="xl:col-span-5 space-y-8">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-8 border-b border-gray-50 dark:border-gray-700 pb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-600">
                                    <List size={20} />
                                </div>
                                <h3 className="text-xl font-black tracking-tight">Presupuestos Agregados</h3>
                            </div>
                            <span className="bg-gray-100 dark:bg-slate-700 px-3 py-1 rounded-full text-[10px] font-black text-gray-500">
                                {items.length} ítems
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-[500px] space-y-4 pr-2 custom-scrollbar">
                            <AnimatePresence initial={false}>
                                {items.length === 0 ? (
                                    <div className="text-center py-20">
                                        <Package className="mx-auto text-gray-200 dark:text-gray-700 mb-4" size={48} />
                                        <p className="text-gray-400 font-bold text-sm">No has agregado presupuestos todavía.</p>
                                    </div>
                                ) : (
                                    items.map((item) => (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="p-5 bg-gray-50 dark:bg-slate-900/50 rounded-3xl border border-gray-100 dark:border-gray-700 group"
                                        >
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1">
                                                    <h4 className="font-black text-gray-800 dark:text-gray-200 mb-1">{item.title}</h4>
                                                    <p className="text-lg font-black text-green-600 mb-2">{formatCurrency(item.amount)}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className="bg-white dark:bg-slate-800 px-2 py-1 rounded-lg text-[9px] font-bold text-gray-500 border border-gray-100 dark:border-gray-700">
                                                            {item.projectName}
                                                        </span>
                                                        <span className="bg-white dark:bg-slate-800 px-2 py-1 rounded-lg text-[9px] font-bold text-gray-500 border border-gray-100 dark:border-gray-700">
                                                            {item.areaName}
                                                        </span>
                                                        {item.categoryName && (
                                                            <span className="bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded-lg text-[9px] font-bold text-primary-600 border border-primary-100 dark:border-primary-800">
                                                                {item.categoryName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="pt-8 border-t border-gray-50 dark:border-gray-700 mt-auto">
                            {items.length > 0 && (
                                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-100 dark:border-green-800">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-green-600">Total General</span>
                                        <span className="text-2xl font-black text-green-600">{formatCurrency(totalAmount.toString())}</span>
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={handleSubmit}
                                disabled={loading || items.length === 0}
                                className="w-full bg-premium-gradient text-white py-6 rounded-[1.8rem] font-black text-lg shadow-2xl hover:shadow-primary-500/30 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                <Save size={20} />
                                {loading ? "Procesando..." : "Enviar a Aprobación"}
                            </button>
                            <p className="mt-4 text-[9px] text-center font-bold text-gray-400 tracking-widest uppercase">
                                Los presupuestos se crearán con estado "Pendiente de Aprobación"
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
