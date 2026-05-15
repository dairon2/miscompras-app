"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { invoiceService } from '@/services/invoiceService';
import LoadingButton from '@/components/LoadingButton';
import { AlertTriangle, ChevronLeft, Upload } from 'lucide-react';
import axios from 'axios';
import { useToastStore } from '@/store/toastStore';
import SearchableSelect from '@/components/SearchableSelect';

export default function NewInvoicePage() {
    const { token } = useAuthStore();
    const router = useRouter();
    const { addToast } = useToastStore();
    const [loading, setLoading] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        invoiceNumber: '',
        amount: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        supplierId: ''
    });
    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
        if (token) {
            loadSuppliers();
        }
    }, [token]);

    useEffect(() => {
        if (!token || !formData.supplierId || !formData.invoiceNumber.trim()) {
            setDuplicateWarning(null);
            return;
        }

        const timeout = setTimeout(async () => {
            try {
                const result = await invoiceService.checkDuplicateInvoice(token, formData.supplierId, formData.invoiceNumber);
                if (result.isDuplicate) {
                    setDuplicateWarning(`Ya existe una factura ${result.invoice?.invoiceNumber || formData.invoiceNumber} para este proveedor.`);
                } else {
                    setDuplicateWarning(null);
                }
            } catch (error) {
                console.error('Error checking duplicate invoice:', error);
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [token, formData.supplierId, formData.invoiceNumber]);

    const loadSuppliers = async () => {
        try {
            // Using direct fetch if service not available or use generic service
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/suppliers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuppliers(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            addToast('Debes adjuntar el PDF de la factura', 'error');
            return;
        }
        if (!formData.supplierId) {
            addToast('Selecciona un proveedor', 'error');
            return;
        }

        setLoading(true);
        try {
            const data = new FormData();
            data.append('invoiceNumber', formData.invoiceNumber);
            data.append('amount', formData.amount);
            data.append('issueDate', formData.issueDate);
            if (formData.dueDate) data.append('dueDate', formData.dueDate);
            data.append('supplierId', formData.supplierId);
            data.append('file', file);

            await invoiceService.createInvoice(token!, data);
            addToast('Factura creada exitosamente', 'success');
            router.push('/invoices');
        } catch (error: any) {
            console.error('Error creating invoice:', error);
            const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Error al crear la factura';
            addToast(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 flex items-center gap-1 mb-4">
                <ChevronLeft className="w-4 h-4" /> Volver
            </button>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Recepcionar Factura</h1>
                    <p className="text-gray-500 mt-1">Sube la factura digital para iniciar el proceso de verificación.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="z-10 col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Proveedor</label>
                            <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-700/50">
                                <SearchableSelect
                                    value={formData.supplierId}
                                    onChange={(val) => setFormData({ ...formData, supplierId: val })}
                                    options={[
                                        { value: "", label: "Selecciona un proveedor" },
                                        ...suppliers.map(s => ({ value: s.id, label: `${s.name} (${s.nit})` }))
                                    ]}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Número de Factura</label>
                            <input
                                type="text"
                                required
                                value={formData.invoiceNumber}
                                onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="Ejs: FE-1234"
                            />
                            {duplicateWarning && (
                                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-300">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                    <span>{duplicateWarning} Revisa antes de continuar.</span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fecha Emisión</label>
                            <input
                                type="date"
                                required
                                value={formData.issueDate}
                                onChange={e => setFormData({ ...formData, issueDate: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fecha Vencimiento</label>
                            <input
                                type="date"
                                value={formData.dueDate}
                                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Monto Total</label>
                            <div className="relative">
                                <span className="absolute left-4 top-3.5 text-gray-400">$</span>
                                <input
                                    type="number"
                                    required
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Archivo PDF (Factura)</label>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer relative">
                                <div className="space-y-1 text-center">
                                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                    <div className="flex text-sm text-gray-600 dark:text-gray-400">
                                        <span className="relative rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                            {file ? file.name : 'Sube un archivo'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500">PDF hasta 10MB</p>
                                </div>
                                <input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    accept=".pdf,application/pdf"
                                    onChange={e => setFile(e.target.files?.[0] || null)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <LoadingButton
                            isLoading={loading}
                            type="submit"
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all"
                        >
                            Recepcionar Factura
                        </LoadingButton>
                    </div>
                </form>
            </div>
        </div>
    );
}
