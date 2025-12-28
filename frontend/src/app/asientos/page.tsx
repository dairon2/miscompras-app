"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Plus,
    BookOpen,
    Calendar,
    Building,
    DollarSign,
    Eye,
    Trash2,
    FileSpreadsheet,
    Download,
    User
} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface Asiento {
    id: string;
    title: string;
    description?: string;
    amount: number;
    actualAmount?: number;
    status: string;
    project?: { name: string };
    area?: { name: string };
    category: string;
    executor?: { name: string };
}

export default function AsientosPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [asientos, setAsientos] = useState<Asiento[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [asientoToDelete, setAsientoToDelete] = useState<Asiento | null>(null);

    // Year filter
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

    // Role-based permissions
    const userRole = user?.role || 'USER';
    const canCreate = ['ADMIN', 'DIRECTOR', 'LEADER'].includes(userRole);
    const canDelete = ['ADMIN', 'DIRECTOR'].includes(userRole);

    useEffect(() => {
        fetchAsientos();
    }, [selectedYear]);

    const fetchAsientos = async () => {
        setLoading(true);
        try {
            const response = await api.get('/requirements/asientos', {
                params: { year: selectedYear }
            });
            setAsientos(response.data);
        } catch (err) {
            console.error("Error fetching asientos", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (asiento: Asiento) => {
        setAsientoToDelete(asiento);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!asientoToDelete) return;
        try {
            await api.delete(`/requirements/${asientoToDelete.id}`);
            fetchAsientos();
            setDeleteModalOpen(false);
            setAsientoToDelete(null);
        } catch (err) {
            console.error("Error deleting asiento", err);
        }
    };

    // Filter by search term
    const filteredAsientos = asientos.filter((a) => {
        const matchesSearch = !searchTerm ||
            a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.description?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const getCategoryLabel = (category: string) => {
        const labels: any = {
            'ANTICIPO': 'Anticipo',
            'COMPRA': 'Compra',
            'COMPRA_ONLINE': 'Compra Online',
            'CONTRATO': 'Contrato',
            'ORDEN_COMPRA': 'Orden de Compra',
            'ORDEN_SERVICIO': 'Orden de Servicio',
            'ORDEN_PRODUCCION': 'Orden de Producción',
            'SERVICIO': 'Servicio'
        };
        return labels[category] || category;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 font-bold">Cargando asientos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-12 max-w-7xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
            >
                <div className="flex items-center gap-6">
                    <div>
                        <h2 className="text-4xl font-black tracking-tight mb-2">Asientos Contables</h2>
                        <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.2em]">Registros Pre-aprobados de Compras</p>
                    </div>

                    {/* Year Selector */}
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <Calendar size={18} className="text-primary-600" />
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="bg-transparent font-black text-lg appearance-none cursor-pointer pr-6 focus:outline-none"
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                        {selectedYear !== currentYear && (
                            <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                                Histórico
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {canCreate && (
                        <button
                            onClick={() => router.push('/asientos/new')}
                            className="flex items-center gap-2 bg-primary-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg hover:bg-primary-700 hover:-translate-y-1 transition-all active:scale-95 whitespace-nowrap uppercase text-[10px] tracking-widest"
                        >
                            <Plus size={18} />
                            <span>Nuevo Asiento</span>
                        </button>
                    )}
                </div>
            </motion.div>

            {/* Search Bar */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden mb-8"
            >
                <div className="p-6 flex flex-wrap gap-4 border-b border-gray-50 dark:border-gray-700">
                    <div className="flex-1 min-w-[250px] relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por título o descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-slate-900 border-none rounded-2xl font-bold outline-none focus:ring-2 ring-primary-500"
                        />
                    </div>
                </div>

                {/* Asientos Table (Desktop) */}
                <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Título</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Categoría</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Proyecto</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Monto Total</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Pagos</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Creado por</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAsientos.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <BookOpen className="mx-auto mb-4 text-gray-300" size={48} />
                                        <p className="text-gray-400 font-bold">No hay asientos registrados</p>
                                        <p className="text-gray-300 text-sm">Crea un nuevo asiento para comenzar</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredAsientos.map((asiento: any) => {
                                    const totalPaid = asiento.payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0) || 0;
                                    const totalAmount = parseFloat(asiento.totalAmount || asiento.actualAmount || 0);
                                    const paymentProgress = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

                                    return (
                                        <tr
                                            key={asiento.id}
                                            className="border-b border-gray-50 dark:border-gray-700 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors cursor-pointer"
                                            onClick={() => router.push(`/requirements/${asiento.id}`)}
                                        >
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
                                                        <BookOpen size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-sm">{asiento.title}</p>
                                                        <p className="text-[10px] text-gray-400 font-bold">{new Date(asiento.createdAt).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                                                    {getCategoryLabel(asiento.reqCategory)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <Building size={14} className="text-gray-400" />
                                                    <span className="text-sm font-bold">{asiento.project?.name || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <DollarSign size={14} className="text-green-500" />
                                                    <span className="font-black text-green-600">
                                                        ${totalAmount.toLocaleString()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="w-32">
                                                    <div className="flex justify-between text-[9px] font-bold text-gray-500 mb-1">
                                                        <span>{asiento.payments?.length || 0} pagos</span>
                                                        <span>{paymentProgress.toFixed(0)}%</span>
                                                    </div>
                                                    <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-green-500 rounded-full transition-all"
                                                            style={{ width: `${Math.min(paymentProgress, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <User size={14} className="text-gray-400" />
                                                    <span className="text-sm font-bold">{asiento.createdBy?.name || asiento.createdBy?.email || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/requirements/${asiento.id}`);
                                                        }}
                                                        className="p-3 bg-white dark:bg-slate-800 hover:bg-primary-600 hover:text-white rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all text-primary-600"
                                                        title="Ver detalle"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    {canDelete && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteClick(asiento);
                                                            }}
                                                            className="p-3 bg-white dark:bg-slate-800 hover:bg-red-600 hover:text-white rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all text-red-500"
                                                            title="Eliminar asiento"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Asientos Cards (Mobile) */}
                <div className="lg:hidden p-4 space-y-4">
                    {filteredAsientos.length === 0 ? (
                        <div className="py-12 text-center">
                            <BookOpen className="mx-auto mb-4 text-gray-300" size={48} />
                            <p className="text-gray-400 font-bold">No hay asientos registrados</p>
                        </div>
                    ) : (
                        filteredAsientos.map((asiento: any) => (
                            <div
                                key={asiento.id}
                                onClick={() => router.push(`/requirements/${asiento.id}`)}
                                className="bg-gray-50/50 dark:bg-slate-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
                                            <BookOpen size={18} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-sm">{asiento.title}</h4>
                                            <p className="text-[10px] text-gray-400 font-bold">{new Date(asiento.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-100">
                                        {getCategoryLabel(asiento.reqCategory)}
                                    </span>
                                </div>
                                <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-gray-400 uppercase">Monto Total:</span>
                                        <span className="font-black text-green-600">${parseFloat(asiento.totalAmount || asiento.actualAmount || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-gray-400 uppercase">Pagos:</span>
                                        <span className="text-xs font-bold">{asiento.payments?.length || 0} recibo(s)</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </motion.div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setDeleteModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Trash2 className="w-8 h-8 text-red-600" />
                                </div>
                                <h3 className="text-xl font-black mb-2">¿Eliminar asiento?</h3>
                                <p className="text-gray-500 text-sm">
                                    Esta acción no se puede deshacer. Se eliminará permanentemente el asiento:
                                </p>
                                <p className="font-bold text-primary-600 mt-2">
                                    &quot;{asientoToDelete?.title}&quot;
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setDeleteModalOpen(false)}
                                    className="flex-1 py-3 px-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    className="flex-1 py-3 px-6 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
