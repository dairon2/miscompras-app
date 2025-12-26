"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Save, X, Info, Package, DollarSign, Building, Truck, Paperclip, FileText, AlertTriangle } from "lucide-react";
import api from "@/lib/api";

export default function NewRequirementPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        quantity: "",
        projectId: "",
        areaId: "",
        supplierId: "",
        manualSupplierName: "",
        isManualSupplier: false
    });
    const [attachments, setAttachments] = useState<File[]>([]);

    const [options, setOptions] = useState({
        projects: [],
        areas: [],
        suppliers: [],
        budgets: []
    });
    const [budgetError, setBudgetError] = useState<string | null>(null);

    useEffect(() => {
        // Fetch options for the form
        const fetchOptions = async () => {
            try {
                // In a real app, these would be API calls
                // For now, if they fail, we use empty arrays
                const [projRes, areaRes, suppRes, budRes] = await Promise.all([
                    api.get('/projects').catch(() => ({ data: [] })),
                    api.get('/areas').catch(() => ({ data: [] })),
                    api.get('/suppliers').catch(() => ({ data: [] })),
                    api.get('/budgets').catch(() => ({ data: [] }))
                ]);

                setOptions({
                    projects: projRes.data,
                    areas: areaRes.data,
                    suppliers: suppRes.data,
                    budgets: budRes.data
                });
            } catch (err) {
                console.error("Error fetching form options", err);
            }
        };
        fetchOptions();
        fetchOptions();
    }, []);

    useEffect(() => {
        if (formData.projectId && formData.areaId) {
            const budget = (options as any).budgets.find((b: any) => b.projectId === formData.projectId && b.areaId === formData.areaId);
            if (budget) {
                if (budget.executionDate && new Date(budget.executionDate) < new Date()) {
                    setBudgetError(`El presupuesto asignado venció el ${new Date(budget.executionDate).toLocaleDateString()}. No se pueden crear nuevas solicitudes.`);
                } else {
                    setBudgetError(null);
                }
            } else {
                // If no budget found, maybe warn or allow (depending on business rule). For now allowing but checking if we want to strict mode.
                setBudgetError(null);
            }
        } else {
            setBudgetError(null);
        }
    }, [formData.projectId, formData.areaId, (options as any).budgets]);

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = new FormData();
            data.append("title", formData.title);
            data.append("description", formData.description);
            data.append("quantity", formData.quantity);
            data.append("projectId", formData.projectId);
            data.append("areaId", formData.areaId);
            if (formData.isManualSupplier) {
                data.append("manualSupplierName", formData.manualSupplierName);
            } else if (formData.supplierId) {
                data.append("supplierId", formData.supplierId);
            }

            attachments.forEach(file => {
                data.append("attachments", file);
            });

            await api.post("/requirements", data);
            router.push("/requirements");
        } catch (err: any) {
            alert("Error al crear el requerimiento: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 lg:p-12 max-w-5xl mx-auto">
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
                    <h2 className="text-4xl font-black tracking-tight mb-2">Nuevo Requerimiento</h2>
                    <p className="text-gray-500 font-medium">Completa la información para iniciar el proceso de compra.</p>
                </div>
            </motion.div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column - Main Info */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-8 border-b border-gray-50 dark:border-gray-700 pb-6">
                            <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center text-primary-600">
                                <Info size={20} />
                            </div>
                            <h3 className="text-xl font-black tracking-tight">Información General</h3>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">Título del Requerimiento</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold text-lg"
                                    placeholder="Ej: Insumos de limpieza para sala A"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">Descripción Detallada</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows={5}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium"
                                    placeholder="Describe los productos o servicios necesarios..."
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-8 border-b border-gray-50 dark:border-gray-700 pb-6">
                            <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center text-green-600">
                                <DollarSign size={20} />
                            </div>
                            <h3 className="text-xl font-black tracking-tight">Presupuesto y Proveedor</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">Cantidad / Unidades</label>
                                <div className="relative">
                                    <Package className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        name="quantity"
                                        value={formData.quantity}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 pl-14 pr-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold text-lg"
                                        placeholder="Ej: 5 unidades, 1 servicio, etc."
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2 ml-1">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Proveedor Sugerido</label>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, isManualSupplier: !prev.isManualSupplier }))}
                                        className="text-[10px] font-bold text-primary-600 hover:underline"
                                    >
                                        {formData.isManualSupplier ? "Seleccionar de la lista" : "Ingresar manualmente"}
                                    </button>
                                </div>
                                <div className="relative">
                                    <Truck className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    {formData.isManualSupplier ? (
                                        <input
                                            type="text"
                                            name="manualSupplierName"
                                            value={formData.manualSupplierName}
                                            onChange={handleChange}
                                            className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 pl-14 pr-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold"
                                            placeholder="Nombre del proveedor sugerido"
                                            required={formData.isManualSupplier}
                                        />
                                    ) : (
                                        <select
                                            name="supplierId"
                                            value={formData.supplierId}
                                            onChange={handleChange}
                                            className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 pl-14 pr-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold appearance-none cursor-pointer"
                                        >
                                            <option value="">Selecciona un proveedor...</option>
                                            {options.suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-8 border-b border-gray-50 dark:border-gray-700 pb-6">
                            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600">
                                <Paperclip size={20} />
                            </div>
                            <h3 className="text-xl font-black tracking-tight">Archivos Adjuntos</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-center w-full">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-100 border-dashed rounded-3xl cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-slate-900 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-slate-800 transition-all">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Paperclip className="w-8 h-8 mb-3 text-gray-400" />
                                        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-black">Haz clic para adjuntar</span> o arrastra y suelta</p>
                                        <p className="text-xs text-gray-400">PDF, Imágenes o Especificaciones técnicas</p>
                                    </div>
                                    <input type="file" className="hidden" multiple onChange={handleFileChange} />
                                </label>
                            </div>

                            {attachments.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                                    {attachments.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-gray-700">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <FileText size={18} className="text-primary-500 flex-shrink-0" />
                                                <span className="text-sm font-bold truncate max-w-[150px]">{file.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeAttachment(index)}
                                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column - Selectors & Submit */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center gap-2">
                            <Building size={12} /> Clasificación
                        </label>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-2">Proyecto</label>
                                <select
                                    name="projectId"
                                    value={formData.projectId}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary-500 font-bold"
                                    required
                                >
                                    <option value="">Seleccionar Proyecto...</option>
                                    {options.projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-2">Área Solicitante</label>
                                <select
                                    name="areaId"
                                    value={formData.areaId}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary-500 font-bold"
                                    required
                                >
                                    <option value="">Seleccionar Área...</option>
                                    {options.areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        </div>
                        {budgetError && (
                            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800 flex items-start gap-3 mt-4">
                                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
                                <p className="text-xs font-bold text-red-600 dark:text-red-400">{budgetError}</p>
                            </div>
                        )}
                    </div>

                    <div className="p-2 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-[2rem]">
                        <button
                            type="submit"
                            disabled={loading || !!budgetError}
                            className="w-full bg-premium-gradient text-white py-6 rounded-[1.8rem] font-black text-xl shadow-2xl hover:shadow-primary-500/20 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            <Save size={24} />
                            {loading ? "Enviando..." : "Crear Solicitud"}
                        </button>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/50">
                        <p className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase tracking-widest leading-loose text-center">
                            Esta solicitud pasará por un proceso de aprobación jerárquico. Se te notificará por correo.
                        </p>
                    </div>
                </div>
            </form>
        </div>
    );
}
