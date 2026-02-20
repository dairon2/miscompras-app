"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CreditCard,
    Plus,
    Trash2,
    Calendar,
    DollarSign,
    FileText,
    X,
    Save,
    Loader2,
    Receipt,
    CheckCircle,
    Pencil
} from 'lucide-react';
import api from '@/lib/api';
import { useToastStore } from '@/store/toastStore';

interface Payment {
    id: string;
    paymentNumber: number;
    amount: number;
    invoiceNumber?: string;
    purchaseOrder?: string;
    paymentDate?: string;
    observations?: string;
    createdAt: string;
}

interface PaymentsSectionProps {
    requirementId: string;
    hasMultiplePayments: boolean;
    totalAmount: number;
    canEdit: boolean;
    onPaymentsChange?: () => void;
}

export default function PaymentsSection({
    requirementId,
    hasMultiplePayments,
    totalAmount,
    canEdit,
    onPaymentsChange
}: PaymentsSectionProps) {
    const { addToast } = useToastStore();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingPayment, setEditingPayment] = useState<string | null>(null);

    const [form, setForm] = useState({
        amount: '',
        invoiceNumber: '',
        purchaseOrder: '',
        paymentDate: new Date().toISOString().split('T')[0],
        observations: ''
    });

    useEffect(() => {
        fetchPayments();
    }, [requirementId]);

    const fetchPayments = async () => {
        try {
            const res = await api.get(`/payments/${requirementId}`);
            setPayments(res.data);
        } catch (error) {
            console.error('Error fetching payments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.amount || parseFloat(form.amount) <= 0) {
            addToast('Ingresa un monto válido', 'error');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                amount: parseFloat(form.amount),
                invoiceNumber: form.invoiceNumber || null,
                purchaseOrder: form.purchaseOrder || null,
                paymentDate: form.paymentDate || null,
                observations: form.observations || null
            };

            if (editingPayment) {
                await api.put(`/payments/update/${editingPayment}`, payload);
                addToast('Abono actualizado exitosamente', 'success');
            } else {
                await api.post(`/payments/${requirementId}`, payload);
                addToast('Pago registrado exitosamente', 'success');
            }
            setShowModal(false);
            setEditingPayment(null);
            setForm({ amount: '', invoiceNumber: '', purchaseOrder: '', paymentDate: new Date().toISOString().split('T')[0], observations: '' });
            fetchPayments();
            onPaymentsChange?.();
        } catch (error: any) {
            addToast(error.response?.data?.error || (editingPayment ? 'Error al actualizar abono' : 'Error al registrar pago'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (payment: Payment) => {
        setForm({
            amount: payment.amount.toString(),
            invoiceNumber: payment.invoiceNumber || '',
            purchaseOrder: payment.purchaseOrder || '',
            paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            observations: payment.observations || ''
        });
        setEditingPayment(payment.id);
        setShowModal(true);
    };

    const handleDelete = async (paymentId: string) => {
        if (!confirm('¿Estás seguro de eliminar este pago?')) return;

        try {
            await api.delete(`/payments/delete/${paymentId}`);
            addToast('Pago eliminado', 'success');
            fetchPayments();
            onPaymentsChange?.();
        } catch (error: any) {
            addToast(error.response?.data?.error || 'Error al eliminar pago', 'error');
        }
    };

    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
    const remaining = totalAmount - totalPaid;
    const progress = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

    if (!hasMultiplePayments) {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl text-amber-600 flex-shrink-0">
                        <CreditCard size={24} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg font-black">Pagos en Cuotas</h3>
                        <p className="text-xs text-gray-500">
                            {payments.length} de máximo 24 pagos registrados
                        </p>
                    </div>
                </div>
                {canEdit && payments.length < 24 && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors whitespace-nowrap"
                    >
                        <Plus size={16} />
                        Agregar Abono
                    </button>
                )}
            </div>

            {/* Progress Bar */}
            {totalAmount > 0 && (
                <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold text-gray-600">Progreso de Pago</span>
                        <span className="font-black text-amber-600">{progress.toFixed(1)}%</span>
                    </div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(progress, 100)}%` }}
                            transition={{ duration: 0.5 }}
                            className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-xs">
                        <span className="text-gray-500">
                            Pagado: <span className="font-bold text-green-600">${totalPaid.toLocaleString()}</span>
                        </span>
                        <span className="text-gray-500">
                            Pendiente: <span className="font-bold text-red-600">${remaining.toLocaleString()}</span>
                        </span>
                    </div>
                </div>
            )}

            {/* Payments List */}
            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-amber-500" size={32} />
                </div>
            ) : payments.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    <Receipt className="mx-auto mb-2 opacity-50" size={40} />
                    <p>No hay pagos registrados</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Scrollable container - max 4 items visible (approx 340px) */}
                    <div className="max-h-[340px] overflow-y-auto space-y-3 pr-2">
                        {payments.map((payment) => (
                            <motion.div
                                key={payment.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-gray-700 relative"
                            >
                                <div className="flex items-start gap-4">
                                    {/* Column 1: Badge */}
                                    <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 font-black text-sm flex-shrink-0">
                                        #{payment.paymentNumber}
                                    </div>

                                    {/* Column 2: Content Stack */}
                                    <div className="flex-1 min-w-0 space-y-2">

                                        {/* Row 1: Amount */}
                                        <p className="font-black text-lg text-green-600 tracking-tight leading-none">
                                            ${parseFloat(payment.amount.toString()).toLocaleString()}
                                        </p>

                                        {/* Row 2: Date and Delete */}
                                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                                            {payment.paymentDate ? (
                                                <span className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300">
                                                    <Calendar size={14} className="text-gray-400" />
                                                    {new Date(payment.paymentDate).toLocaleDateString('es-CO', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric'
                                                    })}
                                                </span>
                                            ) : <span></span>}

                                            {canEdit && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleEdit(payment)}
                                                        className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600 transition-colors font-medium px-2 py-1 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg"
                                                    >
                                                        <Pencil size={14} />
                                                        <span>Editar</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(payment.id)}
                                                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors font-medium px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                                    >
                                                        <Trash2 size={14} />
                                                        <span>Eliminar</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Row 3: Details (Stacked) */}
                                        <div className="space-y-1">
                                            {payment.invoiceNumber && (
                                                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                    <span className="font-medium min-w-[30px]">Fac:</span>
                                                    <span className="font-bold text-gray-900 dark:text-white">{payment.invoiceNumber}</span>
                                                </div>
                                            )}
                                            {payment.purchaseOrder && (
                                                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                    <span className="font-medium min-w-[30px]">OC:</span>
                                                    <span className="font-bold text-gray-900 dark:text-white">{payment.purchaseOrder}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Row 4: Observations */}
                                        {payment.observations && (
                                            <p className="text-xs text-gray-400 italic pt-1">
                                                {payment.observations}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Scroll indicator if more than 4 payments */}
                    {payments.length > 4 && (
                        <p className="text-center text-xs text-gray-400">
                            Desliza para ver más pagos ({payments.length} total)
                        </p>
                    )}

                    {/* Fully Paid Badge */}
                    {progress >= 100 && (
                        <div className="flex items-center justify-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl text-green-600 font-black">
                            <CheckCircle size={20} />
                            Pagado Completamente
                        </div>
                    )}
                </div>
            )}

            {/* Add Payment Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => { setShowModal(false); setEditingPayment(null); setForm({ amount: '', invoiceNumber: '', purchaseOrder: '', paymentDate: new Date().toISOString().split('T')[0], observations: '' }); }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-500 rounded-xl text-white">
                                        <Plus size={20} />
                                    </div>
                                    <h3 className="text-xl font-black">{editingPayment ? 'Editar Abono' : `Registrar Abono #${payments.length + 1}`}</h3>
                                </div>
                                <button
                                    onClick={() => { setShowModal(false); setEditingPayment(null); setForm({ amount: '', invoiceNumber: '', purchaseOrder: '', paymentDate: new Date().toISOString().split('T')[0], observations: '' }); }}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-600">Monto del Abono *</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                                        <input
                                            type="text"
                                            value={form.amount ? Number(form.amount).toLocaleString('es-CO') : ''}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                setForm({ ...form, amount: val });
                                            }}
                                            placeholder="0.00"
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 pl-12 rounded-2xl font-black text-green-600 text-lg focus:ring-2 ring-amber-500 outline-none"
                                            required
                                        />
                                    </div>
                                    {remaining > 0 && (
                                        <p className="text-xs text-gray-400">
                                            Saldo pendiente: <span className="font-bold text-red-500">${remaining.toLocaleString()}</span>
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-600">Número de Factura</label>
                                        <input
                                            type="text"
                                            value={form.invoiceNumber}
                                            onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                                            placeholder="FAC-001"
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl font-bold focus:ring-2 ring-amber-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-600">Orden de Compra</label>
                                        <input
                                            type="text"
                                            value={form.purchaseOrder}
                                            onChange={(e) => setForm({ ...form, purchaseOrder: e.target.value })}
                                            placeholder="OC-001"
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl font-bold focus:ring-2 ring-amber-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-600">Fecha de Pago</label>
                                        <input
                                            type="date"
                                            value={form.paymentDate}
                                            onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl font-bold focus:ring-2 ring-amber-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-600">Observaciones</label>
                                    <textarea
                                        value={form.observations}
                                        onChange={(e) => setForm({ ...form, observations: e.target.value })}
                                        placeholder="Notas adicionales..."
                                        rows={2}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl font-bold focus:ring-2 ring-amber-500 outline-none resize-none"
                                    />
                                </div>

                                <div className="flex justify-end gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
                                    >
                                        {saving ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <Save size={18} />
                                        )}
                                        {editingPayment ? 'Actualizar Abono' : 'Registrar Abono'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
