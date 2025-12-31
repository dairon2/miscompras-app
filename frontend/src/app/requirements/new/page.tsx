"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Save, X, Info, Package, DollarSign, Building, Truck, Paperclip, FileText, AlertTriangle, PieChart, Plus, Trash2, List } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { BudgetCascadeSelector } from "@/components";

interface Project { id: string; name: string }
interface Area { id: string; name: string }
interface Category { id: string; name: string; code: string }
interface Supplier { id: string; name: string }
interface Budget {
    id: string;
    title: string;
    amount: string;
    available: number;
    code: string;
    executionDate?: string;
    projectId: string;
    areaId: string;
    categoryId?: string;
    managerId?: string;
    category?: { id: string; name: string; code: string };
    project?: { id: string; name: string };
    area?: { id: string; name: string };
}

interface RequirementItem {
    id: string;
    title: string;
    description: string;
    quantity: string;
    projectId: string;
    areaId: string;
    budgetId: string;
    supplierId: string;
    manualSupplierName: string;
    isManualSupplier: boolean;
    projectName: string;
    areaName: string;
    budgetName: string;
    attachments?: File[];
}

export default function NewRequirementPage() {
    const { user } = useAuthStore();
    const { addToast } = useToastStore();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // List of items to submit
    const [items, setItems] = useState<RequirementItem[]>([]);

    // Attachments for current item
    const [currentAttachments, setCurrentAttachments] = useState<File[]>([]);

    // Current form data (for the item being added)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        quantity: '',
        projectId: '',
        areaId: '',
        budgetId: '',
        supplierId: '',
        manualSupplierName: '',
        isManualSupplier: false
    });

    // Options for selects
    const [options, setOptions] = useState({
        projects: [] as Project[],
        areas: [] as Area[],
        suppliers: [] as Supplier[],
        budgets: [] as Budget[]
    });
    const [budgetError, setBudgetError] = useState<string | null>(null);

    // Role-based permissions - Users with role USER only see their assigned area
    const userRole = user?.role || 'USER';
    const isAdminRole = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER'].includes(userRole);
    const userAreaId = user?.areaId || null;

    const fetchCatalogs = useCallback(async () => {
        try {
            const [p, a, s, b] = await Promise.all([
                api.get('/projects'),
                api.get('/areas'),
                api.get('/suppliers'),
                api.get('/budgets')
            ]);

            setOptions({
                projects: p.data,
                areas: a.data,
                suppliers: s.data,
                budgets: b.data
            });
        } catch (err) {
            console.error("Error fetching catalogs:", err);
            addToast('Error al cargar datos necesarios', 'error');
        }
    }, [addToast]);

    useEffect(() => {
        fetchCatalogs();
    }, [fetchCatalogs]);

    // Auto-select user's area if they are a regular user
    useEffect(() => {
        if (!isAdminRole && userAreaId && formData.areaId === '') {
            setFormData(prev => ({ ...prev, areaId: userAreaId }));
        }
    }, [isAdminRole, userAreaId, formData.areaId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const addItem = () => {
        if (!formData.title || !formData.projectId || !formData.areaId || !formData.budgetId) {
            addToast('Por favor completa los campos obligatorios del ítem', 'warning');
            return;
        }

        const project = options.projects.find(p => p.id === formData.projectId);
        const area = options.areas.find(a => a.id === formData.areaId);
        const budget = options.budgets.find(b => b.id === formData.budgetId);

        const newItem: RequirementItem = {
            ...formData,
            id: Math.random().toString(36).substr(2, 9),
            projectName: project?.name || '',
            areaName: area?.name || '',
            budgetName: budget?.category?.name ? `${budget.category.name} ($${parseFloat(budget.amount).toLocaleString()})` : 'Presupuesto',
            attachments: currentAttachments.length > 0 ? currentAttachments : undefined
        };

        setItems(prev => [...prev, newItem]);
        // Reset only item-specific fields, keep category/project if user wants to add similar items
        setFormData(prev => ({
            ...prev,
            title: '',
            description: '',
            quantity: '',
            supplierId: '',
            manualSupplierName: ''
        }));
        // Clear attachments for next item
        setCurrentAttachments([]);
        addToast('Ítem agregado a la lista', 'success');
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0) {
            addToast('Agrega al menos un ítem antes de enviar', 'warning');
            return;
        }

        setLoading(true);
        try {
            await api.post("/requirements/mass-create", {
                requirements: items.map(item => ({
                    title: item.title,
                    description: item.description,
                    quantity: item.quantity,
                    projectId: item.projectId,
                    areaId: item.areaId,
                    budgetId: item.budgetId,
                    supplierId: item.isManualSupplier ? null : item.supplierId,
                    manualSupplierName: item.isManualSupplier ? item.manualSupplierName : null
                }))
            });

            addToast("Solicitud múltiple creada exitosamente", 'success');
            router.push("/requirements");
        } catch (err: any) {
            addToast("Error al crear la solicitud: " + (err.response?.data?.error || err.message), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 lg:p-12 max-w-7xl mx-auto">
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
                        <X size={12} /> Cancelar y Volver
                    </button>
                    <h2 className="text-4xl font-black tracking-tight mb-2">Solicitud Múltiple</h2>
                    <p className="text-gray-500 font-medium">Agrega varios requerimientos a una misma solicitud administrativa.</p>
                </div>

                {items.length > 0 && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-4 bg-primary-50 dark:bg-primary-900/20 px-6 py-4 rounded-2xl border border-primary-100 dark:border-primary-800">
                        <List className="text-primary-600" size={20} />
                        <div>
                            <p className="text-[10px] font-black uppercase text-primary-600 tracking-widest">Items listos</p>
                            <p className="font-black text-xl">{items.length}</p>
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
                            <h3 className="text-xl font-black tracking-tight">Agregar Ítem</h3>
                        </div>

                        <div className="space-y-6">
                            {/* Budget Cascade Selector - Project → Category → Budget */}
                            <div className="p-6 bg-gradient-to-r from-primary-50/50 to-indigo-50/50 dark:from-primary-900/10 dark:to-indigo-900/10 rounded-3xl border border-primary-100 dark:border-primary-800">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-600 mb-4">Selección de Presupuesto</h4>
                                <BudgetCascadeSelector
                                    budgets={options.budgets}
                                    projects={options.projects}
                                    selectedBudgetId={formData.budgetId}
                                    onBudgetSelect={(budgetId, projectId, areaId) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            budgetId,
                                            projectId,
                                            areaId
                                        }));
                                    }}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">Título del Requerimiento</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold text-lg"
                                    placeholder="Ej: Cámara Sony A7IV"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">Cantidad / Detalle</label>
                                    <input
                                        type="text"
                                        name="quantity"
                                        value={formData.quantity}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold"
                                        placeholder="Ej: 2 unidades"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-2 ml-1">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Proveedor</label>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, isManualSupplier: !p.isManualSupplier }))}
                                            className="text-[10px] font-bold text-primary-600"
                                        >
                                            {formData.isManualSupplier ? "Elegir de lista" : "Escribir nombre"}
                                        </button>
                                    </div>
                                    {formData.isManualSupplier ? (
                                        <input
                                            type="text"
                                            name="manualSupplierName"
                                            value={formData.manualSupplierName}
                                            onChange={handleChange}
                                            className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold"
                                            placeholder="Nombre del proveedor sugerido"
                                        />
                                    ) : (
                                        <select
                                            name="supplierId"
                                            value={formData.supplierId}
                                            onChange={handleChange}
                                            className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold"
                                        >
                                            <option value="">Selecciona proveedor...</option>
                                            {options.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">Descripción / Justificación</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows={3}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium"
                                    placeholder="Explica por qué se necesita este ítem..."
                                />
                            </div>

                            {/* Attachments Field */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">
                                    <Paperclip size={12} className="inline mr-1" />
                                    Adjuntos (opcional)
                                </label>
                                <div className="bg-gray-50 dark:bg-slate-900 rounded-2xl p-4">
                                    <input
                                        type="file"
                                        multiple
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files || []);
                                            setCurrentAttachments(prev => [...prev, ...files]);
                                        }}
                                        className="hidden"
                                        id="attachmentInput"
                                    />
                                    <label
                                        htmlFor="attachmentInput"
                                        className="cursor-pointer flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 hover:text-primary-600 hover:border-primary-300 transition-all"
                                    >
                                        <Paperclip size={16} />
                                        <span className="text-sm font-bold">Haz clic para agregar archivos</span>
                                    </label>

                                    {currentAttachments.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {currentAttachments.map((file, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-800 px-3 py-2 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <FileText size={14} className="text-primary-500" />
                                                        <span className="text-xs font-bold truncate max-w-[200px]">{file.name}</span>
                                                        <span className="text-[10px] text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCurrentAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                        className="text-red-400 hover:text-red-600"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={addItem}
                                className="w-full bg-gray-800 dark:bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] hover:bg-gray-700 transition-all flex items-center justify-center gap-3"
                            >
                                <Plus size={18} /> Agregar a la lista
                            </button>

                        </div>
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
                                <h3 className="text-xl font-black tracking-tight">Ítems Agregados</h3>
                            </div>
                            <span className="bg-gray-100 dark:bg-slate-700 px-3 py-1 rounded-full text-[10px] font-black text-gray-500">{items.length} ítems</span>
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-[500px] space-y-4 pr-2 custom-scrollbar">
                            <AnimatePresence initial={false}>
                                {items.length === 0 ? (
                                    <div className="text-center py-20">
                                        <Package className="mx-auto text-gray-200 dark:text-gray-700 mb-4" size={48} />
                                        <p className="text-gray-400 font-bold text-sm">No has agregado ítems todavía.</p>
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
                                                    <p className="text-[10px] font-bold text-primary-600 mb-2">{item.budgetName}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className="bg-white dark:bg-slate-800 px-2 py-1 rounded-lg text-[9px] font-bold text-gray-500 border border-gray-100 dark:border-gray-700">{item.quantity}</span>
                                                        <span className="bg-white dark:bg-slate-800 px-2 py-1 rounded-lg text-[9px] font-bold text-gray-500 border border-gray-100 dark:border-gray-700">{item.areaName}</span>
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
                            <button
                                onClick={handleSubmit}
                                disabled={loading || items.length === 0}
                                className="w-full bg-premium-gradient text-white py-6 rounded-[1.8rem] font-black text-lg shadow-2xl hover:shadow-primary-500/30 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                <Save size={20} />
                                {loading ? "Procesando..." : "Enviar Solicitud Administrativa"}
                            </button>
                            <p className="mt-4 text-[9px] text-center font-bold text-gray-400 tracking-widest uppercase">
                                Se generará un PDF automático con todos los ítems.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
