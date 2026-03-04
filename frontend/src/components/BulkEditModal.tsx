import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, AlertTriangle, CheckCircle } from "lucide-react";
import api from "@/lib/api";
import SearchableSelect from "./SearchableSelect";

interface BulkEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: string[];
    onSuccess: () => void;
}

export default function BulkEditModal({ isOpen, onClose, selectedIds, onSuccess }: BulkEditModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        supplierId: "",
        manualSupplierName: "",
        invoiceNumber: "",
        purchaseOrderNumber: "",
        procurementStatus: "",
        status: "",
        observations: "" // For appending to logs or similar
    });

    const [suppliers, setSuppliers] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchSuppliers();
        }
    }, [isOpen]);

    const fetchSuppliers = async () => {
        try {
            const res = await api.get('/suppliers');
            setSuppliers(res.data);
        } catch (error) {
            console.error('Error loading suppliers', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Filter out empty fields to only send what changed
        const updates: any = {};
        if (formData.supplierId) updates.supplierId = formData.supplierId;
        if (formData.manualSupplierName) updates.manualSupplierName = formData.manualSupplierName;
        if (formData.invoiceNumber) updates.invoiceNumber = formData.invoiceNumber;
        if (formData.purchaseOrderNumber) updates.purchaseOrderNumber = formData.purchaseOrderNumber;
        if (formData.procurementStatus) updates.procurementStatus = formData.procurementStatus;
        if (formData.status) updates.status = formData.status;
        if (formData.observations) updates.observations = formData.observations; // handled in backend history log

        try {
            await api.put('/requirements/mass-update', {
                ids: selectedIds,
                updates
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error updating requirements', error);
            alert('Error al actualizar los requerimientos');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden"
                >
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-black text-gray-800 dark:text-white">Edición Masiva</h2>
                            <p className="text-sm text-gray-500 font-bold">Editando {selectedIds.length} requerimientos</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl p-4 flex gap-3">
                            <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                                Los campos que dejes vacíos NO se modificarán. Solo llena los datos que deseas cambiar para todos los items seleccionados.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Proovedor */}
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-gray-400 tracking-wider">Proveedor Registrado</label>
                                <SearchableSelect
                                    value={formData.supplierId}
                                    onChange={(val) => setFormData({ ...formData, supplierId: val, manualSupplierName: '' })}
                                    options={[
                                        { value: "", label: "-- No cambiar --" },
                                        ...suppliers.map(s => ({ value: s.id, label: `${s.name} - ${s.nit}` }))
                                    ]}
                                    placeholder="Seleccionar proveedor"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-gray-400 tracking-wider">O Proveedor Manual</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                    placeholder="Nombre del proveedor..."
                                    value={formData.manualSupplierName}
                                    onChange={(e) => setFormData({ ...formData, manualSupplierName: e.target.value, supplierId: '' })}
                                    disabled={!!formData.supplierId}
                                />
                            </div>

                            {/* Factura y Orden */}
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-gray-400 tracking-wider">Número de Factura</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                    placeholder="Ej: FE-1234"
                                    value={formData.invoiceNumber}
                                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-gray-400 tracking-wider">Orden de Compra</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                    placeholder="Ej: OC-2026-001"
                                    value={formData.purchaseOrderNumber}
                                    onChange={(e) => setFormData({ ...formData, purchaseOrderNumber: e.target.value })}
                                />
                            </div>

                            {/* Estados */}
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-gray-400 tracking-wider">Estado de Trámite</label>
                                <SearchableSelect
                                    value={formData.procurementStatus}
                                    onChange={(val) => setFormData({ ...formData, procurementStatus: val })}
                                    options={[
                                        { value: "", label: "-- No cambiar --" },
                                        { value: "PENDIENTE", label: "Pendiente" },
                                        { value: "EN_TRAMITE", label: "En trámite" },
                                        { value: "ENTREGADO", label: "Entregado" },
                                        { value: "FINALIZADO", label: "Finalizado" },
                                        { value: "ANULADO", label: "Anulado" },
                                        { value: "POSTERGADO", label: "Postergado" }
                                    ]}
                                    placeholder="Estado de trámite"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-gray-400 tracking-wider">Estado Solicitud</label>
                                <SearchableSelect
                                    value={formData.status}
                                    onChange={(val) => setFormData({ ...formData, status: val })}
                                    options={[
                                        { value: "", label: "-- No cambiar --" },
                                        { value: "APPROVED", label: "Aprobado" },
                                        { value: "PENDING_APPROVAL", label: "Pendiente Aprobación" },
                                        { value: "REJECTED", label: "Rechazado" }
                                    ]}
                                    placeholder="Estado solicitud"
                                />
                            </div>
                        </div>
                    </form>

                    <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50/50 dark:bg-slate-900/50">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex items-center gap-2 px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-black shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save size={18} />
                            )}
                            Guardar Cambios
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
