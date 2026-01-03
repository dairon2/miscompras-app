"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    Truck,
    Mail,
    Phone,
    Building2,
    FileText,
    Package,
    DollarSign,
    Calendar,
    Eye,
    Loader2,
    AlertTriangle,
    CheckCircle,
    Clock,
    XCircle,
    MapPin,
    User,
    Receipt
} from "lucide-react";
import api from "@/lib/api";

interface SupplierDetail {
    id: string;
    name: string;
    taxId?: string;
    nit?: string;
    contactEmail?: string;
    contactPhone?: string;
    email?: string;
    phone?: string;
    address?: string;
    contactName?: string;
    createdAt: string;
    requirements: Array<{
        id: string;
        title: string;
        status: string;
        totalAmount?: number;
        actualAmount?: number;
        createdAt: string;
        area: { name: string };
        project: { name: string };
        budget?: { category?: { name: string } };
    }>;
    invoices: Array<{
        id: string;
        invoiceNumber?: string;
        amount: number;
        status: string;
        createdAt: string;
        requirement?: { title: string };
    }>;
    stats: {
        totalRequirements: number;
        totalInvoices: number;
        totalAmount: number;
        approvedRequirements: number;
        pendingRequirements: number;
    };
}

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'requirements' | 'invoices'>('requirements');

    useEffect(() => {
        fetchSupplier();
    }, [id]);

    const fetchSupplier = async () => {
        try {
            const response = await api.get(`/suppliers/${id}`);
            setSupplier(response.data);
        } catch (err) {
            console.error("Error fetching supplier", err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
            case 'PAID':
                return <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-green-50 text-green-700 border border-green-200 flex items-center gap-1"><CheckCircle size={10} /> {status === 'PAID' ? 'Pagada' : 'Aprobado'}</span>;
            case 'REJECTED':
            case 'CANCELLED':
                return <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-red-50 text-red-700 border border-red-200 flex items-center gap-1"><XCircle size={10} /> Rechazado</span>;
            case 'VERIFIED':
                return <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1"><CheckCircle size={10} /> Verificada</span>;
            default:
                return <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-yellow-50 text-yellow-700 border border-yellow-200 flex items-center gap-1"><Clock size={10} /> Pendiente</span>;
        }
    };

    if (loading) {
        return (
            <div className="p-12 flex justify-center items-center min-h-screen">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                    <Loader2 size={40} className="text-primary-600" />
                </motion.div>
            </div>
        );
    }

    if (!supplier) {
        return (
            <div className="p-12 text-center">
                <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
                <h2 className="text-xl font-bold">Proveedor no encontrado</h2>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-12 max-w-6xl mx-auto">
            {/* Back Button */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-8">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-primary-600 font-black uppercase text-[10px] tracking-widest transition-colors">
                    <ArrowLeft size={16} /> Volver a Proveedores
                </button>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Header Card */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600">
                                    <Truck size={32} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-600 mb-1">Proveedor</p>
                                    <h1 className="text-3xl font-black tracking-tight">{supplier.name}</h1>
                                    {(supplier.taxId || supplier.nit) && (
                                        <p className="text-gray-400 font-bold text-xs mt-1">NIT: {supplier.taxId || supplier.nit}</p>
                                    )}
                                </div>
                            </div>
                            <span className="px-4 py-2 rounded-full text-xs font-black uppercase bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                                <CheckCircle size={14} /> Activo
                            </span>
                        </div>

                        {/* Stats Summary */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-gradient-to-br from-primary-50 to-indigo-50 dark:from-primary-900/20 dark:to-indigo-900/20 p-4 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Requerimientos</p>
                                <p className="text-2xl font-black text-primary-600">{supplier.stats.totalRequirements}</p>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Facturas</p>
                                <p className="text-2xl font-black text-green-600">{supplier.stats.totalInvoices}</p>
                            </div>
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-4 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Monto Total</p>
                                <p className="text-xl font-black text-orange-600">{formatCurrency(supplier.stats.totalAmount)}</p>
                            </div>
                        </div>

                        {/* Contact Info Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-primary-500 border border-gray-100 dark:border-gray-700">
                                    <Mail size={18} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase text-gray-400">Correo</p>
                                    <p className="text-sm font-bold">{supplier.contactEmail || supplier.email || 'No disponible'}</p>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-primary-500 border border-gray-100 dark:border-gray-700">
                                    <Phone size={18} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase text-gray-400">Teléfono</p>
                                    <p className="text-sm font-bold">{supplier.contactPhone || supplier.phone || 'No disponible'}</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Tabs */}
                    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl">
                        <button
                            onClick={() => setActiveTab('requirements')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'requirements' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Package size={18} /> Requerimientos ({supplier.requirements?.length || 0})
                        </button>
                        <button
                            onClick={() => setActiveTab('invoices')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'invoices' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Receipt size={18} /> Facturas ({supplier.invoices?.length || 0})
                        </button>
                    </div>

                    {/* Requirements List */}
                    {activeTab === 'requirements' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                    <Package size={20} />
                                </div>
                                <h3 className="text-lg font-black">Requerimientos Asociados</h3>
                            </div>
                            {supplier.requirements?.length > 0 ? (
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {supplier.requirements.map(req => (
                                        <div key={req.id} onClick={() => router.push(`/requirements/${req.id}`)} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${req.status === 'APPROVED' ? 'bg-green-500' : req.status === 'REJECTED' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                                                <div>
                                                    <span className="font-bold text-sm block">{req.title}</span>
                                                    <span className="text-[10px] text-gray-400">{req.project?.name} • {req.area?.name}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="text-sm font-bold text-primary-600 block">
                                                        {formatCurrency(Number(req.actualAmount || req.totalAmount || 0))}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">{new Date(req.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <Eye size={16} className="text-gray-400" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm text-center py-10 bg-gray-50 dark:bg-slate-900 rounded-2xl">No hay requerimientos asociados a este proveedor</p>
                            )}
                        </motion.div>
                    )}

                    {/* Invoices List */}
                    {activeTab === 'invoices' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
                                    <Receipt size={20} />
                                </div>
                                <h3 className="text-lg font-black">Facturas Registradas</h3>
                            </div>
                            {supplier.invoices?.length > 0 ? (
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {supplier.invoices.map(inv => (
                                        <div key={inv.id} onClick={() => router.push(`/invoices/${inv.id}`)} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-purple-500 border border-gray-100 dark:border-gray-700">
                                                    <FileText size={18} />
                                                </div>
                                                <div>
                                                    <span className="font-bold text-sm block">{inv.invoiceNumber || `Factura ${inv.id.slice(0, 8)}`}</span>
                                                    <span className="text-[10px] text-gray-400">{inv.requirement?.title || 'Sin requerimiento'}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="text-sm font-bold text-primary-600 block">
                                                        {formatCurrency(Number(inv.amount || 0))}
                                                    </span>
                                                    {getStatusBadge(inv.status)}
                                                </div>
                                                <Eye size={16} className="text-gray-400" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm text-center py-10 bg-gray-50 dark:bg-slate-900 rounded-2xl">No hay facturas registradas para este proveedor</p>
                            )}
                        </motion.div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Info Card */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6 border-b border-gray-50 dark:border-gray-700 pb-4">Información</h3>

                        <div className="space-y-5">
                            {supplier.contactName && (
                                <div className="flex items-start gap-3">
                                    <User size={16} className="text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-[9px] font-black uppercase text-gray-400">Contacto</p>
                                        <p className="font-bold text-sm">{supplier.contactName}</p>
                                    </div>
                                </div>
                            )}

                            {supplier.address && (
                                <div className="flex items-start gap-3">
                                    <MapPin size={16} className="text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-[9px] font-black uppercase text-gray-400">Dirección</p>
                                        <p className="font-bold text-sm">{supplier.address}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-start gap-3">
                                <Calendar size={16} className="text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-[9px] font-black uppercase text-gray-400">Registrado</p>
                                    <p className="font-bold text-sm">{new Date(supplier.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Building2 size={16} className="text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-[9px] font-black uppercase text-gray-400">Estado</p>
                                    <p className="font-bold text-sm text-green-600">Activo</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Stats Card */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6 border-b border-gray-50 dark:border-gray-700 pb-4">Resumen</h3>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm text-gray-500">Aprobados</span>
                                <span className="font-black text-green-600">{supplier.stats.approvedRequirements}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-t border-gray-50 dark:border-gray-700">
                                <span className="text-sm text-gray-500">Pendientes</span>
                                <span className="font-black text-yellow-600">{supplier.stats.pendingRequirements}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-t border-gray-50 dark:border-gray-700">
                                <span className="text-sm text-gray-500">Total Operaciones</span>
                                <span className="font-black text-primary-600">{supplier.stats.totalRequirements + supplier.stats.totalInvoices}</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
