"use client";

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { invoiceService } from '@/services/invoiceService';
import LoadingButton from '@/components/LoadingButton';
import { AlertTriangle, ChevronLeft, Paperclip, Upload } from 'lucide-react';
import axios from 'axios';
import { useToastStore } from '@/store/toastStore';
import SearchableSelect from '@/components/SearchableSelect';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

type SupplierOption = { id: string; name: string; nit?: string | null; taxId?: string | null };
type BudgetOption = { id: string; title?: string | null; description?: string | null; code?: string | null; category?: { name?: string | null } | null };
type AreaOption = { id: string; name: string };
type RequirementOption = {
    id: string;
    groupId?: number | null;
    title?: string | null;
    actualAmount?: number | string | null;
    purchaseOrderNumber?: string | null;
};

const getRequestErrorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) return error.response?.data?.error || error.response?.data?.details || fallback;
    return error instanceof Error ? error.message : fallback;
};

export default function NewInvoicePage() {
    const { token } = useAuthStore();
    const router = useRouter();
    const { addToast } = useToastStore();
    const [loading, setLoading] = useState(false);
    const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
    const [budgets, setBudgets] = useState<BudgetOption[]>([]);
    const [areas, setAreas] = useState<AreaOption[]>([]);
    const [requirements, setRequirements] = useState<RequirementOption[]>([]);
    const [requirementSearch, setRequirementSearch] = useState('');
    const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        invoiceNumber: '',
        purchaseOrderNumber: '',
        requirementId: '',
        budgetId: '',
        commercialAreaId: '',
        amount: '',
        subtotal: '',
        taxAmount: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        supplierId: '',
        observations: '',
        causationNumber: '',
        causationDate: '',
        leaderApproval: '',
        policyApproverName: '',
        policyReviewObservations: '',
        causationObservations: '',
        passToArea: '',
        costCenterOrProject: ''
    });
    const [file, setFile] = useState<File | null>(null);
    const [attachments, setAttachments] = useState<File[]>([]);

    const loadCatalogs = useCallback(async () => {
        if (!token) return;
        try {
            const [supplierResult, budgetResult, areaResult] = await Promise.allSettled([
                axios.get(`${API_URL}/suppliers`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/budgets`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/admin/areas`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            if (supplierResult.status === 'fulfilled') setSuppliers(supplierResult.value.data);
            if (budgetResult.status === 'fulfilled') setBudgets(budgetResult.value.data);
            if (areaResult.status === 'fulfilled') setAreas(areaResult.value.data);
        } catch (error) {
            console.error(error);
        }
    }, [token]);

    useEffect(() => {
        loadCatalogs();
    }, [loadCatalogs]);

    useEffect(() => {
        if (!token) return;
        const timeout = setTimeout(async () => {
            try {
                const result = await invoiceService.searchInvoiceRequirementOptions(token, {
                    supplierId: formData.supplierId || undefined,
                    search: requirementSearch.trim() || undefined
                });
                setRequirements(result);
            } catch (error) {
                console.error('Error loading requirements:', error);
            }
        }, 250);

        return () => clearTimeout(timeout);
    }, [token, formData.supplierId, requirementSearch]);

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

    const updateFinancialField = (field: 'subtotal' | 'taxAmount' | 'amount', value: string) => {
        setFormData(prev => {
            const next = { ...prev, [field]: value };
            if (field !== 'amount') {
                const subtotal = Number(field === 'subtotal' ? value : next.subtotal);
                const taxAmount = Number(field === 'taxAmount' ? value : next.taxAmount);
                if ((next.subtotal || next.taxAmount) && Number.isFinite(subtotal) && Number.isFinite(taxAmount)) {
                    next.amount = (subtotal + taxAmount).toFixed(2);
                }
            }
            return next;
        });
    };

    const appendIfPresent = (data: FormData, key: string, value: string) => {
        if (value !== '') data.append(key, value);
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
            data.append('supplierId', formData.supplierId);
            data.append('file', file);

            appendIfPresent(data, 'dueDate', formData.dueDate);
            appendIfPresent(data, 'purchaseOrderNumber', formData.purchaseOrderNumber);
            appendIfPresent(data, 'requirementId', formData.requirementId);
            appendIfPresent(data, 'budgetId', formData.budgetId);
            appendIfPresent(data, 'commercialAreaId', formData.commercialAreaId);
            appendIfPresent(data, 'subtotal', formData.subtotal);
            appendIfPresent(data, 'taxAmount', formData.taxAmount);
            appendIfPresent(data, 'observations', formData.observations);
            appendIfPresent(data, 'causationNumber', formData.causationNumber);
            appendIfPresent(data, 'causationDate', formData.causationDate);
            appendIfPresent(data, 'leaderApproval', formData.leaderApproval);
            appendIfPresent(data, 'policyApproverName', formData.policyApproverName);
            appendIfPresent(data, 'policyReviewObservations', formData.policyReviewObservations);
            appendIfPresent(data, 'causationObservations', formData.causationObservations);
            appendIfPresent(data, 'passToArea', formData.passToArea);
            appendIfPresent(data, 'costCenterOrProject', formData.costCenterOrProject);
            attachments.forEach(attachment => data.append('attachments', attachment));

            await invoiceService.createInvoice(token!, data);
            addToast('Factura creada exitosamente', 'success');
            router.push('/invoices');
        } catch (error: unknown) {
            console.error('Error creating invoice:', error);
            addToast(getRequestErrorMessage(error, 'Error al crear la factura'), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 flex items-center gap-1 mb-4">
                <ChevronLeft className="w-4 h-4" /> Volver
            </button>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Recepcionar Factura</h1>
                    <p className="text-gray-500 mt-1">Registra la información de factura, causación, aprobación y soportes.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <section className="space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-wider text-gray-400">Datos principales</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="z-20 md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Proveedor</label>
                                <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-700/50">
                                    <SearchableSelect
                                        value={formData.supplierId}
                                        onChange={(val) => setFormData({ ...formData, supplierId: val, requirementId: '' })}
                                        options={[
                                            { value: "", label: "Selecciona un proveedor" },
                                            ...suppliers.map(s => ({ value: s.id, label: `${s.name} (${s.nit || s.taxId || 'Sin NIT'})` }))
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
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-wider text-gray-400">Compra y presupuesto</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Orden de Compra</label>
                                <input
                                    type="text"
                                    value={formData.purchaseOrderNumber}
                                    onChange={e => setFormData({ ...formData, purchaseOrderNumber: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="Ejs: OC-2026-001"
                                />
                            </div>

                            <div className="z-20">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Requerimiento</label>
                                <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-700/50">
                                    <SearchableSelect
                                        value={formData.requirementId}
                                        onChange={(val) => setFormData({ ...formData, requirementId: val })}
                                        onInputChange={(value, meta) => {
                                            if (meta.action === 'input-change') setRequirementSearch(value);
                                        }}
                                        options={[
                                            { value: "", label: "Sin requerimiento vinculado" },
                                            ...requirements.map(req => ({
                                                value: req.id,
                                                label: `${req.groupId ? `#${req.groupId}` : 'Sin número'} - ${req.title || 'Requerimiento'}${req.purchaseOrderNumber ? ` · OC ${req.purchaseOrderNumber}` : ''}`
                                            }))
                                        ]}
                                        placeholder="Buscar por número, OC o título..."
                                    />
                                </div>
                            </div>

                            <div className="z-10">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Presupuesto</label>
                                <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-700/50">
                                    <SearchableSelect
                                        value={formData.budgetId}
                                        onChange={(val) => setFormData({ ...formData, budgetId: val })}
                                        options={[
                                            { value: "", label: "Selecciona un presupuesto" },
                                            ...budgets.map(b => ({
                                                value: b.id,
                                                label: `${b.code || 'Sin código'} - ${b.title || b.description || b.category?.name || 'Presupuesto'}`
                                            }))
                                        ]}
                                    />
                                </div>
                            </div>

                            <div className="z-10">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Área Comercial</label>
                                <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-700/50">
                                    <SearchableSelect
                                        value={formData.commercialAreaId}
                                        onChange={(val) => setFormData({ ...formData, commercialAreaId: val })}
                                        options={[
                                            { value: "", label: "Selecciona un área" },
                                            ...areas.map(a => ({ value: a.id, label: a.name }))
                                        ]}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Aprobación del Líder</label>
                                <select
                                    value={formData.leaderApproval}
                                    onChange={e => setFormData({ ...formData, leaderApproval: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                >
                                    <option value="">Pendiente / No aplica</option>
                                    <option value="true">Aprobada</option>
                                    <option value="false">No aprobada</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-wider text-gray-400">Valores</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <MoneyInput label="Subtotal" value={formData.subtotal} onChange={(value) => updateFinancialField('subtotal', value)} />
                            <MoneyInput label="IVA" value={formData.taxAmount} onChange={(value) => updateFinancialField('taxAmount', value)} />
                            <MoneyInput label="Total" required value={formData.amount} onChange={(value) => updateFinancialField('amount', value)} />
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-wider text-gray-400">Causación y pólizas</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Número de Causación</label>
                                <input
                                    type="text"
                                    value={formData.causationNumber}
                                    onChange={e => setFormData({ ...formData, causationNumber: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="Ejs: CAU-2026-001"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fecha de Causación</label>
                                <input
                                    type="date"
                                    value={formData.causationDate}
                                    onChange={e => setFormData({ ...formData, causationDate: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Revisar pólizas / Quién aprueba</label>
                                <input
                                    type="text"
                                    value={formData.policyApproverName}
                                    onChange={e => setFormData({ ...formData, policyApproverName: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="Nombre o cargo responsable"
                                />
                            </div>

                            <TextareaField
                                label="Observaciones"
                                value={formData.observations}
                                onChange={(value) => setFormData({ ...formData, observations: value })}
                                placeholder="Observaciones generales de la factura"
                            />
                            <TextareaField
                                label="Observaciones de Causación"
                                value={formData.causationObservations}
                                onChange={(value) => setFormData({ ...formData, causationObservations: value })}
                                placeholder="Notas contables o de causación"
                            />
                            <div className="md:col-span-2">
                                <TextareaField
                                    label="Observaciones de Revisión de Pólizas"
                                    value={formData.policyReviewObservations}
                                    onChange={(value) => setFormData({ ...formData, policyReviewObservations: value })}
                                    placeholder="Detalle de validación, pendientes o aprobador definido"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-wider text-gray-400">Documentos</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <UploadBox
                                label="Archivo PDF (Factura)"
                                icon={<Upload className="mx-auto h-12 w-12 text-gray-400" />}
                                fileLabel={file ? file.name : 'Sube un archivo'}
                                helpText="PDF hasta 10MB"
                                accept=".pdf,application/pdf"
                                onChange={(files) => setFile(files?.[0] || null)}
                            />

                            <UploadBox
                                label="Anexos"
                                icon={<Paperclip className="mx-auto h-12 w-12 text-gray-400" />}
                                fileLabel={attachments.length > 0 ? `${attachments.length} archivo(s) seleccionados` : 'Sube anexos'}
                                helpText="PDF, imágenes, Word o Excel"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                                multiple
                                onChange={(files) => setAttachments(Array.from(files || []))}
                            />
                        </div>
                        {attachments.length > 0 && (
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-600 dark:text-gray-300">
                                {attachments.map((attachment) => (
                                    <div key={`${attachment.name}-${attachment.lastModified}`} className="flex items-center gap-2 py-1">
                                        <Paperclip className="h-4 w-4 text-gray-400" />
                                        <span className="truncate">{attachment.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

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

function MoneyInput({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
            <div className="relative">
                <span className="absolute left-4 top-3.5 text-gray-400">$</span>
                <input
                    type="number"
                    required={required}
                    min="0"
                    step="0.01"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg"
                    placeholder="0.00"
                />
            </div>
        </div>
    );
}

function TextareaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
            <textarea
                rows={4}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                placeholder={placeholder}
            />
        </div>
    );
}

function UploadBox({
    label,
    icon,
    fileLabel,
    helpText,
    accept,
    multiple = false,
    onChange
}: {
    label: string;
    icon: ReactNode;
    fileLabel: string;
    helpText: string;
    accept: string;
    multiple?: boolean;
    onChange: (files: FileList | null) => void;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer relative min-h-[154px]">
                <div className="space-y-1 text-center">
                    {icon}
                    <div className="flex justify-center text-sm text-gray-600 dark:text-gray-400">
                        <span className="relative max-w-full truncate rounded-md font-medium text-blue-600 hover:text-blue-500">
                            {fileLabel}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500">{helpText}</p>
                </div>
                <input
                    type="file"
                    multiple={multiple}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept={accept}
                    onChange={e => onChange(e.target.files)}
                />
            </div>
        </div>
    );
}
