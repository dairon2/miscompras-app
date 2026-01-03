"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search, Filter, Plus, Truck, Mail, Phone,
    ExternalLink, Building2, List, LayoutGrid, X,
    Package, ArrowRightCircle, FileText, Briefcase, User, Download, FileSpreadsheet, Save
} from "lucide-react";
import api from "@/lib/api";
import { exportSuppliers } from "@/lib/excelExport";
import { useAuthStore } from "@/store/authStore";

export default function SuppliersPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        taxId: "",
        contactEmail: "",
        contactPhone: ""
    });

    // Role-based permissions for supplier management
    const userRole = user?.role || 'USER';
    const canManageSuppliers = ['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER'].includes(userRole);


    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            const response = await api.get("/suppliers");
            setSuppliers(response.data);
        } catch (err) {
            console.error("Error fetching suppliers", err);
        } finally {
            setLoading(false);
        }
    };

    const navigateToSupplier = (supplierId: string) => {
        router.push(`/suppliers/${supplierId}`);
    };

    const handleCreateSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post("/suppliers", formData);
            setShowCreateModal(false);
            setFormData({ name: "", taxId: "", contactEmail: "", contactPhone: "" });
            fetchSuppliers();
            alert("Proveedor registrado exitosamente");
        } catch (error) {
            console.error("Error creating supplier", error);
            alert("Error al registrar proveedor");
        }
    };

    return (
        <div className="p-6 lg:p-12 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div>
                    <h2 className="text-4xl font-black tracking-tight mb-2">Proveedores</h2>
                    <p className="text-gray-500 font-medium">Gestión y trazabilidad de aliados estratégicos.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-2 rounded-xl transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <List size={20} />
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            try {
                                exportSuppliers(suppliers);
                            } catch (error) {
                                console.error('Error al exportar:', error);
                                alert('Error al generar el archivo Excel');
                            }
                        }}
                        className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 px-6 py-4 rounded-2xl font-black shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 uppercase text-[10px] tracking-widest"
                    >
                        <FileSpreadsheet size={18} className="text-green-600" />
                        <Download size={18} className="text-primary-600" />
                        <span>EXPORTAR XLSX</span>
                    </button>

                    {canManageSuppliers && (
                        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-slate-900 dark:bg-primary-600 text-white px-6 py-4 rounded-2xl font-black shadow-xl hover:-translate-y-1 transition-all active:scale-95 whitespace-nowrap">
                            <Plus className="w-5 h-5" />
                            Registrar Proveedor
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="py-24 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                    Consultando catálogo de proveedores...
                </div>
            ) : suppliers.length === 0 ? (
                <div className="py-24 text-center bg-white dark:bg-slate-800 rounded-[3rem] border border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-gray-400 font-black text-xs uppercase">No se encontraron proveedores registrados</p>
                </div>
            ) : (
                <>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

                            {suppliers.map((supp: any, index) => (
                                <SupplierCard key={supp.id} supplier={supp} index={index} onClick={() => navigateToSupplier(supp.id)} />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-gray-700">
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Proveedor / NIT</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Contacto Principal</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Teléfono</th>
                                        <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Estado</th>
                                        <th className="p-6"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliers.map((supp: any) => (
                                        <tr key={supp.id} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors group">
                                            <td className="p-6">
                                                <p className="font-black text-sm mb-1 group-hover:text-primary-600 transition-colors">{supp.name}</p>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{supp.taxId}</p>
                                            </td>
                                            <td className="p-6 text-xs font-bold text-gray-600 dark:text-gray-300">{supp.contactEmail || 'N/A'}</td>
                                            <td className="p-6 text-xs font-bold text-gray-600 dark:text-gray-300">{supp.contactPhone || 'N/A'}</td>
                                            <td className="p-6">
                                                <span className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-green-100 dark:border-green-800/30">
                                                    Activo
                                                </span>
                                            </td>
                                            <td className="p-6 text-right">
                                                <button
                                                    onClick={() => navigateToSupplier(supp.id)}
                                                    className="p-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-400 hover:text-primary-600 rounded-xl transition-all"
                                                >
                                                    <ArrowRightCircle size={20} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* Create Supplier Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowCreateModal(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-3xl p-10 overflow-hidden"
                        >
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="absolute top-8 right-8 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-all"
                            >
                                <X size={24} />
                            </button>

                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600">
                                    <Truck size={24} />
                                </div>
                                <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-600 rounded-full text-[10px] font-black uppercase tracking-widest">Nuevo Registro</span>
                            </div>

                            <h2 className="text-3xl font-black tracking-tight mb-2">Registrar Proveedor</h2>
                            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-10">Información comercial y de contacto</p>

                            <form onSubmit={handleCreateSupplier} className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Razón Social</label>
                                        <div className="relative">
                                            <Building2 className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="text" required
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                                placeholder="Nombre de la empresa"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">NIT / Identificación</label>
                                        <div className="relative">
                                            <FileText className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="text" required
                                                value={formData.taxId}
                                                onChange={e => setFormData({ ...formData, taxId: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                                placeholder="900.000.000-0"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Correo Electrónico</label>
                                        <div className="relative">
                                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="email" required
                                                value={formData.contactEmail}
                                                onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                                placeholder="contacto@empresa.com"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Teléfono</label>
                                        <div className="relative">
                                            <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="text" required
                                                value={formData.contactPhone}
                                                onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900/50 border-0 rounded-2xl py-5 pl-14 pr-6 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                                placeholder="(604) 123 4567"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" className="w-full bg-premium-gradient text-white py-5 rounded-2xl font-black shadow-2xl hover:-translate-y-1 hover:shadow-primary-500/30 transition-all active:scale-95 flex items-center justify-center gap-2">
                                    <Save size={20} />
                                    Guardar Proveedor
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function SupplierCard({ supplier, index, onClick }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={onClick}
            className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700 hover:shadow-2xl transition-all group cursor-pointer active:scale-95"
        >
            <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-all shadow-lg shadow-transparent group-hover:shadow-primary-500/30">
                    <Truck size={28} />
                </div>
                <span className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-green-100 dark:border-green-800/30">
                    Activo
                </span>
            </div>

            <h3 className="text-xl font-black tracking-tight mb-1 group-hover:text-primary-600 transition-colors">{supplier.name}</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-50 dark:border-gray-700 pb-4">NIT: {supplier.taxId}</p>

            <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    <Mail size={16} className="text-primary-400" />
                    <span className="truncate">{supplier.contactEmail || "Sin correo"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    <Phone size={16} className="text-primary-400" />
                    <span>{supplier.contactPhone || "Sin teléfono"}</span>
                </div>
            </div>

            <div className="pt-6 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center opacity-60 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-gray-400" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Acreditado</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black text-primary-600 uppercase">
                    Ver Historial
                    <ArrowRightCircle size={14} />
                </div>
            </div>
        </motion.div>
    );
}
