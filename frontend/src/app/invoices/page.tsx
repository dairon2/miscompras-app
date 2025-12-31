"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { invoiceService } from '@/services/invoiceService';
import { Plus, CheckCircle, Clock, FileText, Upload, DollarSign, Filter } from 'lucide-react';
import LoadingButton from '@/components/LoadingButton';

export default function InvoicesPage() {
    const { token, user } = useAuthStore();
    const router = useRouter();
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('');

    useEffect(() => {
        if (token) {
            loadInvoices();
        }
    }, [token, filterStatus]);

    const loadInvoices = async () => {
        setLoading(true);
        try {
            const data = await invoiceService.getInvoices(token!, { status: filterStatus || undefined });
            setInvoices(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'RECEIVED': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Recibida</span>;
            case 'VERIFIED': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">Verificada</span>;
            case 'APPROVED': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Por Pagar</span>;
            case 'PAID': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">Pagada</span>;
            default: return <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800">{status}</span>;
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
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
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex gap-4 overflow-x-auto">
                <button onClick={() => setFilterStatus('')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${!filterStatus ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-600 hover:bg-gray-50'}`}>
                    Todas
                </button>
                <button onClick={() => setFilterStatus('RECEIVED')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === 'RECEIVED' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                    Pendientes de Verificación
                </button>
                <button onClick={() => setFilterStatus('VERIFIED')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === 'VERIFIED' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                    Por Aprobar
                </button>
                <button onClick={() => setFilterStatus('APPROVED')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === 'APPROVED' ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                    Listas para Pago
                </button>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {invoices.length === 0 && !loading ? (
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
                                                <span className="text-blue-600 hover:underline cursor-pointer" onClick={() => router.push(`/requirements/${inv.requirement.id}`)}>
                                                    {inv.requirement.title}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic">No vinculada</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => router.push(`/invoices/${inv.id}`)}
                                                className="text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                Gestionar
                                            </button>
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
