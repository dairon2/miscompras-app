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
    User,
    ChevronDown
} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useFilterStore } from "@/store/filterStore";
import YearSelector from "@/components/YearSelector";

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
    budget?: { code: string; name: string };
    supplier?: { name: string };
    invoiceNumber?: string;
    purchaseOrderNumber?: string;
    groupId?: number;
    createdAt: string;
    payments?: any[];
    createdBy?: { name: string; email: string };
    reqCategory: string;
    totalAmount?: number;
    hasMultiplePayments?: boolean;
}

export default function AsientosPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [asientos, setAsientos] = useState<Asiento[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [asientoToDelete, setAsientoToDelete] = useState<Asiento | null>(null);

    // Filter store for persistence
    const { asientos: storedFilters, setAsientosFilter, clearAsientosFilters } = useFilterStore();
    const searchTerm = storedFilters.searchTerm;
    const setSearchTerm = (value: string) => setAsientosFilter({ searchTerm: value });

    // Year filter from store
    const currentYear = new Date().getFullYear();
    const selectedYear = storedFilters.selectedYear;
    const setSelectedYear = (year: number) => setAsientosFilter({ selectedYear: year });
    const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);

    useEffect(() => {
        api.get('/requirements/years')
            .then(res => setAvailableYears(res.data))
            .catch(err => console.error("Error loading years:", err));
    }, []);

    // Role-based permissions
    const userRole = user?.role || 'USER';
    const canCreate = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR'].includes(userRole);
    const canDelete = ['ADMIN', 'DIRECTOR', 'COORDINATOR'].includes(userRole);

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

    // Filters from store
    const selectedSupplier = storedFilters.selectedSupplier;
    const setSelectedSupplier = (value: string) => setAsientosFilter({ selectedSupplier: value });
    const selectedProject = storedFilters.selectedProject;
    const setSelectedProject = (value: string) => setAsientosFilter({ selectedProject: value });
    const selectedCategory = storedFilters.selectedCategory;
    const setSelectedCategory = (value: string) => setAsientosFilter({ selectedCategory: value });
    const sortOrder = storedFilters.sortOrder;
    const setSortOrder = (value: 'asc' | 'desc') => setAsientosFilter({ sortOrder: value });
    const [projects, setProjects] = useState([]);
    const [suppliers, setSuppliers] = useState([]);

    useEffect(() => {
        fetchCatalogs();
    }, []);

    const fetchCatalogs = async () => {
        try {
            const [p, s] = await Promise.all([
                api.get('/projects'),
                api.get('/suppliers')
            ]);
            setProjects(p.data);
            setSuppliers(s.data);
        } catch (err) {
            console.error("Error fetching catalogs", err);
        }
    };

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

    // Filter and Sort logic
    const filteredAsientos = asientos.filter((a) => {
        const matchesSearch = !searchTerm ||
            a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.description?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (a.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.purchaseOrderNumber || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesSupplier = !selectedSupplier || a.supplier?.name === selectedSupplier; // Simplistic match by name, ideally ID
        const matchesProject = !selectedProject || a.project?.name === selectedProject; // Simplistic match by name
        const matchesCategory = !selectedCategory || a.reqCategory === selectedCategory;

        return matchesSearch && matchesSupplier && matchesProject && matchesCategory;
    }).sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

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
        <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
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
                    <YearSelector
                        selectedYear={selectedYear}
                        availableYears={availableYears}
                        onChange={setSelectedYear}
                    />
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

            {/* Filters and Search Bar */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden mb-8"
            >
                <div className="p-6 flex flex-col gap-6 border-b border-gray-50 dark:border-gray-700">

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por título, descripción, factura, OC..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-slate-900 border-none rounded-2xl font-bold outline-none focus:ring-2 ring-primary-500"
                        />
                    </div>

                    {/* Filters Row */}
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Supplier Filter */}
                        <div className="relative min-w-[200px]">
                            <select
                                value={selectedSupplier}
                                onChange={(e) => setSelectedSupplier(e.target.value)}
                                className="w-full appearance-none bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 pr-10 font-bold text-xs text-gray-600 dark:text-gray-300 focus:ring-2 ring-primary-500 outline-none"
                            >
                                <option value="">Todos los Proveedores</option>
                                {suppliers.map((s: any) => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                        </div>

                        {/* Project Filter */}
                        <div className="relative min-w-[200px]">
                            <select
                                value={selectedProject}
                                onChange={(e) => setSelectedProject(e.target.value)}
                                className="w-full appearance-none bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 pr-10 font-bold text-xs text-gray-600 dark:text-gray-300 focus:ring-2 ring-primary-500 outline-none"
                            >
                                <option value="">Todos los Proyectos</option>
                                {projects.map((p: any) => (
                                    <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                        </div>

                        {/* Category Filter */}
                        <div className="relative min-w-[200px]">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full appearance-none bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 pr-10 font-bold text-xs text-gray-600 dark:text-gray-300 focus:ring-2 ring-primary-500 outline-none"
                            >
                                <option value="">Todas las Categorías</option>
                                {['ANTICIPO', 'COMPRA', 'COMPRA_ONLINE', 'CONTRATO', 'ORDEN_COMPRA', 'ORDEN_SERVICIO', 'ORDEN_PRODUCCION', 'SERVICIO'].map((cat) => (
                                    <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                        </div>

                        <div className="flex-1"></div>

                        {/* Sort Toggle */}
                        <button
                            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                            className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-slate-900 rounded-2xl font-bold text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Calendar size={14} />
                            {sortOrder === 'desc' ? 'Más recientes' : 'Más antiguos'}
                        </button>
                    </div>
                </div>

                {/* Asientos Table (Desktop) */}
                <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Título</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Presupuesto</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Proveedor</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Factura</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Orden de Compra</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Valor</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Pagos</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAsientos.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <BookOpen className="mx-auto mb-4 text-gray-300" size={48} />
                                        <p className="text-gray-400 font-bold">No hay asientos registrados</p>
                                        <p className="text-gray-300 text-sm">Prueba ajustando los filtros</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredAsientos.map((asiento) => {
                                    const totalPaid = asiento.payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0) || 0;
                                    const totalAmount = parseFloat((asiento.totalAmount || asiento.actualAmount || 0).toString());
                                    // If NOT multiple payments, we assume it's a single full payment or just show 100% bar if specific status needs it.
                                    // Actually user asked: "si el asiento no fue marcado para varios pagos, en la columna de pagos debe mostrar la barra al 100% o indicativo de un solo pago"
                                    const isSinglePayment = (asiento as any).hasMultiplePayments === false;
                                    const paymentProgress = isSinglePayment ? 100 : (totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0);

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
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {asiento.groupId && (
                                                                <span className="text-[10px] font-black text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-1.5 py-0.5 rounded">
                                                                    #{asiento.groupId}
                                                                </span>
                                                            )}
                                                            <p className="text-[10px] text-gray-400 font-bold">{new Date(asiento.createdAt).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <Building size={14} className="text-gray-400" />
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold">{asiento.project?.name || '-'}</span>
                                                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{getCategoryLabel(asiento.reqCategory)}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <User size={14} className="text-gray-400" />
                                                    <span className="text-xs font-bold truncate max-w-[150px]">{asiento.supplier?.name || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{asiento.invoiceNumber || '-'}</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{asiento.purchaseOrderNumber || '-'}</span>
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
                                                    {isSinglePayment ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-1 bg-green-50 text-green-700 rounded-lg text-[9px] font-black uppercase tracking-wide border border-green-100">
                                                                Pago Único
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <>
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
                                                        </>
                                                    )}
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
                        filteredAsientos.map((asiento) => (
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
                                        <span className="font-black text-green-600">${parseFloat((asiento.totalAmount || asiento.actualAmount || 0).toString()).toLocaleString()}</span>
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
