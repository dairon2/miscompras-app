"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { invoiceService } from '@/services/invoiceService';
import { Plus, FileText, Eye, Trash2, Search, RefreshCw } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';

type InvoiceListItem = {
    id: string;
    invoiceNumber: string;
    amount: number | string;
    issueDate: string;
    status: string;
    supplier?: { name?: string | null } | null;
    requirement?: { id: string; title?: string | null } | null;
};

export default function InvoicesPage() {
    const { token, user } = useAuthStore();
    const router = useRouter();
    const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const { addToast } = useToastStore();
    const canDeleteInvoices = ['ADMIN', 'DIRECTOR', 'DEVELOPER', 'COORDINATOR'].includes(user?.role || '');

    const loadInvoices = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const data = await invoiceService.getInvoices(token, {
                status: filterStatus || undefined,
                search: search.trim() || undefined
            });
            setInvoices(data);
        } catch (requestError) {
            console.error(requestError);
            setError('No se pudieron cargar las facturas.');
        } finally {
            setLoading(false);
        }
    }, [token, filterStatus, search]);

    useEffect(() => {
        if (!token) return;
        const timeout = setTimeout(() => loadInvoices(), 250);
        return () => clearTimeout(timeout);
    }, [token, loadInvoices]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'RECEIVED': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Recibida</span>;
            case 'VERIFIED': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">Verificada</span>;
            case 'APPROVED': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Por Pagar</span>;
            case 'PAID': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">Pagada</span>;
            case 'REJECTED': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">Rechazada</span>;
            default: return <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800">{status}</span>;
        }
    };

    return (
        <div className="p-6 lg:p-10 max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <FileText className="w-8 h-8 text-blue-600" />
                        Gestión de Facturas
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Administra y valida las facturas de proveedores</p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => router.push('/invoices/new')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Factura
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                <div className="relative max-w-xl">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder="Buscar por factura, proveedor, OC o requerimiento..."
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700/50"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto">
                    {[
                        ['', 'Todas'],
                        ['RECEIVED', 'Pendientes de Verificación'],
                        ['VERIFIED', 'Por Aprobar'],
                        ['APPROVED', 'Listas para Pago'],
                        ['PAID', 'Pagadas'],
                        ['REJECTED', 'Rechazadas']
                    ].map(([status, label]) => (
                        <button key={status || 'all'} onClick={() => setFilterStatus(status)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === status ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}`}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 p-12 text-gray-500">
                        <RefreshCw className="h-5 w-5 animate-spin" /> Cargando facturas...
                    </div>
                ) : error ? (
                    <div className="p-12 text-center text-red-600">
                        <p>{error}</p>
                        <button onClick={loadInvoices} className="mt-3 font-semibold underline">Intentar de nuevo</button>
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No hay facturas registradas</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-900/50">
                                <tr>
                                    <th className="px-6 py-3">Factura #</th>
                                    <th className="px-6 py-3">Proveedor</th>
                                    <th className="px-6 py-3">Monto</th>
                                    <th className="px-6 py-3">Fecha Emisión</th>
                                    <th className="px-6 py-3">Estado</th>
                                    <th className="px-6 py-3">OC Vinculada</th>
                                    <th className="px-6 py-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {invoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                                            {inv.invoiceNumber}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                            {inv.supplier?.name || '-'}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                                            ${Number(inv.amount).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(inv.issueDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(inv.status)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {inv.requirement ? (
                                                <span className="text-blue-600 hover:underline cursor-pointer" onClick={() => router.push(`/requirements/${inv.requirement?.id}`)}>
                                                    {inv.requirement.title}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic">No vinculada</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => router.push(`/invoices/${inv.id}`)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Ver factura"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                {canDeleteInvoices && inv.status !== 'PAID' && (
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm('¿Estás seguro de eliminar esta factura?')) {
                                                                try {
                                                                    await invoiceService.deleteInvoice(token!, inv.id);
                                                                    addToast('Factura eliminada', 'success');
                                                                    loadInvoices();
                                                                } catch (error) {
                                                                    console.error(error);
                                                                    addToast('No se pudo eliminar la factura', 'error');
                                                                }
                                                            }
                                                        }}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
