"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    Save,
    BookOpen,
    Building,
    Package,
    DollarSign,
    FileText,
    User,
    Loader2,
    CreditCard,
    ToggleLeft,
    ToggleRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { BudgetCascadeSelector } from "@/components";

export default function NewAsientoPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState([]);
    const [areas, setAreas] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [budgets, setBudgets] = useState([]);

    const [form, setForm] = useState({
        title: '',
        description: '',
        quantity: '',
        totalAmount: '',
        actualAmount: '',
        projectId: '',
        areaId: '',
        supplierId: '',
        manualSupplierName: '',
        budgetId: '',
        reqCategory: 'COMPRA',
        purchaseOrderNumber: '',
        invoiceNumber: '',
        hasMultiplePayments: false
    });

    const categories = [
        { value: 'ANTICIPO', label: 'Anticipo' },
        { value: 'COMPRA', label: 'Compra' },
        { value: 'COMPRA_ONLINE', label: 'Compra Online' },
        { value: 'CONTRATO', label: 'Contrato' },
        { value: 'ORDEN_COMPRA', label: 'Orden de Compra' },
        { value: 'ORDEN_SERVICIO', label: 'Orden de Servicio' },
        { value: 'ORDEN_PRODUCCION', label: 'Orden de Producción' },
        { value: 'SERVICIO', label: 'Servicio' }
    ];

    useEffect(() => {
        fetchCatalogs();
    }, []);

    const fetchCatalogs = async () => {
        try {
            const [p, a, s, b] = await Promise.all([
                api.get('/projects'),
                api.get('/areas'),
                api.get('/suppliers'),
                api.get('/budgets', { params: { status: 'APPROVED' } })
            ]);
            setProjects(p.data);
            setAreas(a.data);
            setSuppliers(s.data);
            // Filter only approved budgets with available funds and not expired
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const approvedBudgets = b.data.filter((budget: any) => {
                const isApproved = budget.status === 'APPROVED';
                const hasFunds = parseFloat(budget.available) > 0;
                const isNotExpired = !budget.expirationDate || new Date(budget.expirationDate) >= today;
                return isApproved && hasFunds && isNotExpired;
            });
            setBudgets(approvedBudgets);
        } catch (err) {
            console.error("Error fetching catalogs", err);
        }
    };

    const handleChange = (e: any) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.title || !form.projectId || !form.areaId) {
            alert('Por favor completa los campos obligatorios: Título, Proyecto y Área');
            return;
        }

        setLoading(true);
        try {
            await api.post('/requirements/asientos', form);
            router.push('/asientos');
        } catch (err: any) {
            console.error("Error creating asiento", err);
            alert(err.response?.data?.error || 'Error al crear el asiento');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 lg:p-12 max-w-4xl mx-auto">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-8"
            >
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-400 hover:text-primary-600 font-black uppercase text-[10px] tracking-widest transition-colors"
                >
                    <ArrowLeft size={16} /> Volver a Asientos
                </button>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
                <div className="p-10 border-b border-gray-50 dark:border-gray-700 bg-gradient-to-r from-primary-50/50 to-indigo-50/50 dark:from-primary-900/10 dark:to-indigo-900/10">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center text-white shadow-lg">
                            <BookOpen size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">Nuevo Asiento</h1>
                            <p className="text-gray-500 font-bold text-xs mt-1">Registro pre-aprobado de compra</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-8">
                    {/* Basic Information */}
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                            <FileText size={14} /> Información Básica
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-black text-gray-600">Título *</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={form.title}
                                    onChange={handleChange}
                                    placeholder="Ej: Compra de equipos de cómputo"
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                    required
                                />
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-black text-gray-600">Descripción</label>
                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    placeholder="Detalle del asiento contable..."
                                    rows={3}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none resize-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Categoría</label>
                                <select
                                    name="reqCategory"
                                    value={form.reqCategory}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none appearance-none"
                                >
                                    {categories.map(cat => (
                                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Cantidad / Unidades</label>
                                <input
                                    type="text"
                                    name="quantity"
                                    value={form.quantity}
                                    onChange={handleChange}
                                    placeholder="Ej: 5 unidades"
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Assignment - Budget Cascade Selector */}
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                            <Building size={14} /> Asignación de Presupuesto
                        </h3>

                        <div className="p-6 bg-gradient-to-r from-primary-50/50 to-indigo-50/50 dark:from-primary-900/10 dark:to-indigo-900/10 rounded-3xl border border-primary-100 dark:border-primary-800">
                            <BudgetCascadeSelector
                                budgets={budgets}
                                projects={projects}
                                selectedBudgetId={form.budgetId}
                                onBudgetSelect={(budgetId, projectId, areaId) => {
                                    setForm(prev => ({
                                        ...prev,
                                        budgetId,
                                        projectId,
                                        areaId
                                    }));
                                }}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Proveedor</label>
                                <select
                                    name="supplierId"
                                    value={form.supplierId}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none appearance-none"
                                >
                                    <option value="">Seleccionar proveedor</option>
                                    {suppliers.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Proveedor Manual</label>
                                <input
                                    type="text"
                                    name="manualSupplierName"
                                    value={form.manualSupplierName}
                                    onChange={handleChange}
                                    placeholder="Si no está en la lista..."
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Financial Information */}
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                            <DollarSign size={14} /> Información Financiera
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Monto Total</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                                    <input
                                        type="number"
                                        name="totalAmount"
                                        value={form.totalAmount}
                                        onChange={handleChange}
                                        placeholder="0"
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 pl-12 rounded-2xl font-black text-green-600 focus:ring-2 ring-primary-500 outline-none"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-400 font-medium">Este monto se descontará del presupuesto inmediatamente</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Monto Real (si difiere)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="number"
                                        name="actualAmount"
                                        value={form.actualAmount}
                                        onChange={handleChange}
                                        placeholder="0"
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 pl-12 rounded-2xl font-black focus:ring-2 ring-primary-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Orden de Compra</label>
                                <input
                                    type="text"
                                    name="purchaseOrderNumber"
                                    value={form.purchaseOrderNumber}
                                    onChange={handleChange}
                                    placeholder="OC-001"
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Factura</label>
                                <input
                                    type="text"
                                    name="invoiceNumber"
                                    value={form.invoiceNumber}
                                    onChange={handleChange}
                                    placeholder="FAC-001"
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Multiple Payments Toggle */}
                        <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/20">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                                        <CreditCard size={22} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-sm">Pagos en Cuotas</h4>
                                        <p className="text-[11px] text-gray-500 font-medium">
                                            {form.hasMultiplePayments
                                                ? 'Podrás registrar hasta 12 pagos diferentes'
                                                : 'Activar si el pago se realizará en varias cuotas'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, hasMultiplePayments: !prev.hasMultiplePayments }))}
                                    className={`p-2 rounded-xl transition-all ${form.hasMultiplePayments ? 'bg-amber-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-500'}`}
                                >
                                    {form.hasMultiplePayments ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end gap-4 pt-6 border-t border-gray-50 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-8 py-4 rounded-2xl font-black text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase text-xs tracking-widest"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Crear Asiento
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
