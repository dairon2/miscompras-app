"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Link as LinkIcon, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { invoiceService } from '@/services/invoiceService';
import { useToastStore } from '@/store/toastStore';

type ReconciliationItem = {
    invoice: {
        id: string;
        invoiceNumber: string;
        amount: number | string;
        issueDate: string;
        status: string;
        supplier: { name: string; nit?: string | null };
    };
    requirement: {
        id: string;
        groupId?: number | null;
        title: string;
        actualAmount?: number | string | null;
        purchaseOrderNumber?: string | null;
    };
    evidence: string[];
    confidence: 'HIGH' | 'REVIEW';
};

type ReconciliationResponse = {
    data: ReconciliationItem[];
    total: number;
    page: number;
    totalPages: number;
    stats: { unlinkedInvoices: number; highConfidence: number; ambiguous: number; invoicesWithoutFile: number; overdueOpenInvoices: number };
};

const formatCurrency = (value: number | string | null | undefined) => `$${Number(value || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function ReconciliationPage() {
    const { token, user } = useAuthStore();
    const router = useRouter();
    const { addToast } = useToastStore();
    const [result, setResult] = useState<ReconciliationResponse | null>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const canManage = ['ADMIN', 'DIRECTOR', 'DEVELOPER', 'COORDINATOR'].includes(user?.role || '');

    const loadSuggestions = useCallback(async () => {
        if (!token || !canManage) return;
        setLoading(true);
        try {
            const response = await invoiceService.getReconciliationSuggestions(token, { page, pageSize: 50, mode: 'suggested' });
            setResult(response);
            setSelected(new Set());
        } catch (error) {
            console.error(error);
            addToast('No se pudieron cargar las sugerencias de conciliación', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, canManage, page, token]);

    useEffect(() => {
        loadSuggestions();
    }, [loadSuggestions]);

    const confirmOne = async (item: ReconciliationItem) => {
        if (!token) return;
        setSaving(item.invoice.id);
        try {
            await invoiceService.reconcileInvoice(token, item.invoice.id, item.requirement.id);
            addToast(`Factura ${item.invoice.invoiceNumber} vinculada sin cambiar su estado`, 'success');
            loadSuggestions();
        } catch (error: any) {
            addToast(error?.response?.data?.error || 'No se pudo confirmar el vínculo', 'error');
        } finally {
            setSaving(null);
        }
    };

    const confirmSelected = async () => {
        if (!token || !result || selected.size === 0) return;
        const items = result.data
            .filter(item => selected.has(item.invoice.id))
            .map(item => ({ invoiceId: item.invoice.id, requirementId: item.requirement.id }));
        if (!window.confirm(`¿Confirmar ${items.length} vínculos de alta confianza? Los estados actuales de las facturas no cambiarán.`)) return;

        setSaving('batch');
        try {
            const response = await invoiceService.reconcileInvoicesBatch(token, items);
            addToast(`${response.reconciled} facturas conciliadas correctamente`, 'success');
            loadSuggestions();
        } catch (error: any) {
            addToast(error?.response?.data?.error || 'No se pudo conciliar el lote', 'error');
        } finally {
            setSaving(null);
        }
    };

    const toggleSelected = (invoiceId: string) => {
        setSelected(current => {
            const next = new Set(current);
            if (next.has(invoiceId)) next.delete(invoiceId);
            else next.add(invoiceId);
            return next;
        });
    };

    if (!canManage) {
        return <div className="p-10 text-center text-gray-500">No tienes permiso para conciliar facturas.</div>;
    }

    return (
        <div className="p-6 lg:p-10 max-w-[1600px] mx-auto space-y-6">
            <button onClick={() => router.push('/invoices')} className="text-gray-500 hover:text-gray-900 flex items-center gap-1 text-sm">
                <ChevronLeft className="w-4 h-4" /> Volver a Facturas
            </button>

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3 text-gray-900 dark:text-gray-100">
                        <LinkIcon className="w-7 h-7 text-violet-600" /> Conciliación de Facturas
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">Confirma solo vínculos respaldados por proveedor, valor y documento coincidente.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadSuggestions} disabled={loading || saving !== null} className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-semibold disabled:opacity-50">
                        <RefreshCw className={`inline w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Actualizar
                    </button>
                    <button onClick={confirmSelected} disabled={selected.size === 0 || saving !== null} className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 text-sm font-bold disabled:opacity-50">
                        <CheckCircle className="inline w-4 h-4 mr-2" />Confirmar seleccionadas ({selected.size})
                    </button>
                </div>
            </div>

            {result && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                    <Metric label="Facturas sin vínculo" value={result.stats.unlinkedInvoices} tone="text-slate-700" />
                    <Metric label="Sugerencias de alta confianza" value={result.stats.highConfidence} tone="text-emerald-700" />
                    <Metric label="Casos para revisión manual" value={result.stats.ambiguous} tone="text-amber-700" />
                    <Metric label="Facturas sin PDF" value={result.stats.invoicesWithoutFile} tone="text-rose-700" />
                    <Metric label="Vencidas sin pagar" value={result.stats.overdueOpenInvoices} tone="text-rose-700" />
                </div>
            )}

            <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 text-sm text-violet-900 dark:bg-violet-900/10 dark:text-violet-100">
                <ShieldCheck className="inline h-5 w-5 mr-2 text-violet-600" />
                Confirmar un vínculo conserva el estado actual de la factura, incluidos los pagos históricos, y deja una trazabilidad de la acción.
            </div>

            {loading ? (
                <div className="p-16 text-center text-gray-500"><RefreshCw className="w-5 h-5 animate-spin inline mr-2" />Buscando coincidencias verificables...</div>
            ) : !result || result.data.length === 0 ? (
                <div className="p-16 rounded-2xl border border-dashed text-center text-gray-500">No hay sugerencias pendientes en esta página.</div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="p-4 text-left"><input type="checkbox" checked={selected.size === result.data.length} onChange={() => setSelected(selected.size === result.data.length ? new Set() : new Set(result.data.map(item => item.invoice.id)))} /></th>
                                    <th className="p-4 text-left">Factura</th>
                                    <th className="p-4 text-left">Requerimiento sugerido</th>
                                    <th className="p-4 text-left">Evidencia</th>
                                    <th className="p-4 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {result.data.map(item => (
                                    <tr key={item.invoice.id} className="hover:bg-violet-50/40 dark:hover:bg-violet-900/10">
                                        <td className="p-4 align-top"><input type="checkbox" checked={selected.has(item.invoice.id)} onChange={() => toggleSelected(item.invoice.id)} /></td>
                                        <td className="p-4 align-top">
                                            <p className="font-bold text-slate-900 dark:text-white">{item.invoice.invoiceNumber}</p>
                                            <p className="text-xs text-gray-500">{item.invoice.supplier.name}</p>
                                            <p className="text-xs font-mono mt-1">{formatCurrency(item.invoice.amount)} · {item.invoice.status}</p>
                                        </td>
                                        <td className="p-4 align-top">
                                            <p className="text-xs font-bold text-violet-700 dark:text-violet-300">Requerimiento {item.requirement.groupId ? `#${item.requirement.groupId}` : 'sin número'}</p>
                                            <button onClick={() => router.push(`/requirements/${item.requirement.id}`)} className="font-semibold text-blue-600 hover:underline text-left">{item.requirement.title}</button>
                                            <p className="text-xs text-gray-500 mt-1">OC: {item.requirement.purchaseOrderNumber || 'Sin OC'} · {formatCurrency(item.requirement.actualAmount)}</p>
                                        </td>
                                        <td className="p-4 align-top">
                                            <div className="flex flex-wrap gap-1 max-w-xs">{item.evidence.map(value => <span key={value} className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">{value}</span>)}</div>
                                        </td>
                                        <td className="p-4 align-top text-right">
                                            <button onClick={() => confirmOne(item)} disabled={saving !== null} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                                                {saving === item.invoice.id ? 'Confirmando...' : 'Confirmar'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-gray-700 text-sm">
                        <span className="text-gray-500">Página {result.page} de {result.totalPages || 1} · {result.total} sugerencias</span>
                        <div className="flex gap-2">
                            <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1} className="p-2 rounded border disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                            <button onClick={() => setPage(value => Math.min(result.totalPages, value + 1))} disabled={page >= result.totalPages} className="p-2 rounded border disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
            )}

            {result?.stats.ambiguous ? <p className="flex items-center gap-2 text-xs text-amber-700"><AlertTriangle className="w-4 h-4" />Los casos ambiguos no se incluyen en el lote y requieren validación individual adicional.</p> : null}
        </div>
    );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
    return <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5"><p className="text-xs font-semibold uppercase text-gray-500">{label}</p><p className={`mt-2 text-3xl font-black ${tone}`}>{value.toLocaleString()}</p></div>;
}
