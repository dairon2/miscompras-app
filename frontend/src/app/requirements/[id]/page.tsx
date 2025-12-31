"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import {
    ArrowLeft,
    Calendar,
    FileText,
    Building,
    Package,
    User,
    DollarSign,
    CheckCircle,
    XCircle,
    Clock,
    History,
    Download,
    Paperclip,
    ExternalLink,
    Edit3,
    Settings,
    X,
    Save,
    Info,
    Loader2,
    Tag
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { resolveApiUrl } from "@/lib/utils";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Attachment {
    id: string;
    fileName: string;
    fileUrl: string;
}

interface Requirement {
    id: string;
    title: string;
    description: string;
    quantity?: string;
    estimatedAmount?: number;
    actualAmount?: number;
    status: string;
    procurementStatus: string;
    projectId: string;
    areaId: string;
    supplierId?: string;
    manualSupplierName?: string;
    attachments: Attachment[];
    purchaseOrderNumber?: string;
    invoiceNumber?: string;
    deliveryDate?: string;
    receivedDate?: string;
    reqCategory: string;
    createdAt: string;
    project: { name: string };
    area: { name: string };
    supplier?: { id: string; name: string };
    createdBy: { id: string; name?: string; email: string };
    createdById: string;
    receivedAtSatisfaction: boolean;
    logs: Array<{ id: string; action: string; details: string; createdAt: string }>;
}

export default function RequirementDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { user: currentUser } = useAuthStore();
    const [requirement, setRequirement] = useState<Requirement | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Edit Form State
    const [editForm, setEditForm] = useState<any>({});
    const [projects, setProjects] = useState([]);
    const [areas, setAreas] = useState([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [newFiles, setNewFiles] = useState<File[]>([]);
    const [deleteAttachmentIds, setDeleteAttachmentIds] = useState<string[]>([]);

    // Status Change State
    interface StatusForm {
        status: string;
        procurementStatus: string;
        remarks: string;
        receivedAtSatisfaction: boolean;
    }

    const [showStatusModal, setShowStatusModal] = useState(false);
    const [statusForm, setStatusForm] = useState<StatusForm>({ status: '', procurementStatus: '', remarks: '', receivedAtSatisfaction: false });
    const [formError, setFormError] = useState('');
    const [selectedFile, setSelectedFile] = useState<Attachment | null>(null);

    const requestStatusOptions = [
        { value: 'PENDING_APPROVAL', label: 'En espera por aprobación' },
        { value: 'APPROVED', label: 'Aprobado' },
        { value: 'REJECTED', label: 'Rechazado' }
    ];

    const procurementStatusOptions = [
        { value: 'ANULADO', label: 'Anulado' },
        { value: 'ENTREGADO', label: 'Entregado' },
        { value: 'EN_TRAMITE', label: 'En trámite' },
        { value: 'PENDIENTE', label: 'Pendientes' },
        { value: 'FINALIZADO', label: 'Finalizado' },
        { value: 'POSTERGADO', label: 'Postergado' }
    ];

    const categoryOptions = [
        { value: 'COMPRA', label: 'Compra' },
        { value: 'SERVICIO', label: 'Servicio' },
        { value: 'ORDEN_COMPRA', label: 'Orden de Compra' },
        { value: 'ORDEN_SERVICIO', label: 'Orden de Servicio' },
        { value: 'ANTICIPO', label: 'Anticipo' },
        { value: 'CONTRATO', label: 'Contrato' },
        { value: 'ORDEN_PRODUCCION', label: 'Orden de Producción' },
        { value: 'COMPRA_ONLINE', label: 'Compra Online' }
    ];

    const getStatusLabel = (status: string) => {
        return requestStatusOptions.find(opt => opt.value === status)?.label || status;
    };

    const getProcStatusLabel = (status: string) => {
        return procurementStatusOptions.find(opt => opt.value === status)?.label || status;
    };

    useEffect(() => {
        fetchRequirement();
    }, [id]);

    const fetchRequirement = async () => {
        try {
            const response = await api.get(`/requirements/${id}`);
            setRequirement(response.data);
            setEditForm({
                title: response.data.title,
                description: response.data.description,
                quantity: response.data.quantity || '',
                estimatedAmount: response.data.estimatedAmount || '',
                actualAmount: response.data.actualAmount || '',
                projectId: response.data.projectId,
                areaId: response.data.areaId,
                supplierId: response.data.supplierId || '',
                manualSupplierName: response.data.manualSupplierName || '',
                purchaseOrderNumber: response.data.purchaseOrderNumber || '',
                invoiceNumber: response.data.invoiceNumber || '',
                status: response.data.status,
                procurementStatus: response.data.procurementStatus,
                reqCategory: response.data.reqCategory,
                deliveryDate: response.data.deliveryDate ? response.data.deliveryDate.split('T')[0] : '',
                receivedDate: response.data.receivedDate ? response.data.receivedDate.split('T')[0] : '',
                receivedAtSatisfaction: response.data.receivedAtSatisfaction
            });
            setStatusForm({
                status: response.data.status,
                procurementStatus: response.data.procurementStatus,
                remarks: '',
                receivedAtSatisfaction: false
            });
            setNewFiles([]);
            setDeleteAttachmentIds([]);
        } catch (err) {
            console.error("Error fetching requirement", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCatalogs = async () => {
        try {
            const [p, a, s] = await Promise.all([
                api.get('/projects'),
                api.get('/areas'),
                api.get('/suppliers')
            ]);
            setProjects(p.data);
            setAreas(a.data);
            setSuppliers(s.data);
        } catch (err) {
            console.error("Error fetching catalogs", err);
        }
    };

    useEffect(() => {
        if (isEditing) fetchCatalogs();
    }, [isEditing]);

    const handleStatusUpdate = async () => {
        if (!statusForm.remarks) {
            setFormError("El comentario es obligatorio para justificar el cambio de estado.");
            return;
        }

        setFormError('');
        setActionLoading(true);
        try {
            await api.patch(`/requirements/${id}/status`, {
                status: statusForm.status,
                procurementStatus: statusForm.procurementStatus,
                remarks: statusForm.remarks,
                receivedAtSatisfaction: statusForm.receivedAtSatisfaction,
                satisfactionComments: statusForm.remarks
            });
            setShowStatusModal(false);
            await fetchRequirement();
        } catch (err) {
            setFormError("Error al actualizar el estado. Intenta de nuevo.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleSaveEdit = async () => {
        setActionLoading(true);
        try {
            const formData = new FormData();
            Object.keys(editForm).forEach(key => {
                if (editForm[key] !== undefined && editForm[key] !== null) {
                    formData.append(key, editForm[key]);
                } else if (editForm[key] === null || editForm[key] === '') {
                    formData.append(key, 'null');
                }
            });

            deleteAttachmentIds.forEach(id => {
                formData.append('deleteAttachmentIds', id);
            });

            newFiles.forEach(file => {
                formData.append('attachments', file);
            });

            await api.put(`/requirements/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setIsEditing(false);
            await fetchRequirement();
        } catch (err) {
            console.error("Save error:", err);
            alert("Error al guardar los cambios");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        const element = document.getElementById('requirement-content');
        if (!element) return;

        setActionLoading(true);
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                logging: false,
                useCORS: true
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            if (requirement) {
                pdf.save(`Requerimiento-${requirement.id}.pdf`);
            }
        } catch (err) {
            console.error("Error generating PDF", err);
            alert("Error al generar el PDF");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="p-12 text-center font-bold">Cargando...</div>;
    if (!requirement) return <div className="p-12 text-center font-bold text-red-500">Requerimiento no encontrado</div>;

    const isFinalState = requirement.status === 'PAID' || requirement.status === 'REJECTED';
    const isCreator = currentUser?.id === requirement.createdById || currentUser?.email === requirement.createdBy.email;
    const userRole = currentUser?.role || 'USER';

    // Role-based permissions
    // isAdmin: Can edit details (includes COORDINATOR now)
    const isAdmin = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER'].includes(userRole);
    // isApprover: Can approve/reject PENDING_APPROVAL requests (Director and Coordinator, NOT Leader)
    const isApprover = ['ADMIN', 'DIRECTOR', 'COORDINATOR'].includes(userRole);
    const canDelete = ['ADMIN', 'DIRECTOR'].includes(userRole);

    // Approval permissions for different stages
    const canApproveCoordination = requirement.status === 'PENDING_COORDINATION' && ['ADMIN', 'LEADER', 'COORDINATOR'].includes(userRole);
    const canApproveFinance = requirement.status === 'PENDING_FINANCE' && ['ADMIN', 'DIRECTOR'].includes(userRole);

    // Generic approve for PENDING_APPROVAL - Director and Coordinator can approve
    const canApprovePending = requirement.status === 'PENDING_APPROVAL' && isApprover;

    const canManageProcurement = requirement.status === 'APPROVED' && (requirement.procurementStatus === 'PENDIENTE' || requirement.procurementStatus === 'EN_TRAMITE' || requirement.procurementStatus === 'ENTREGADO');
    const canMarkReceived = requirement.procurementStatus === 'ENTREGADO' && isCreator && !requirement.receivedAtSatisfaction;

    const canManage = userRole === 'ADMIN';

    // Full edit: ADMIN/DIRECTOR/LEADER can edit everything
    // Regular users can ONLY mark received at satisfaction on their own requests
    const canFullEdit = isAdmin;
    const canEditObservationsOnly = !isAdmin && isCreator;

    // User who created can only see their request status and mark satisfaction
    const isUserOnly = userRole === 'USER';


    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'APPROVED':
            case 'FINALIZADO': return <CheckCircle className="text-green-500" />;
            case 'REJECTED':
            case 'CANCELLED':
            case 'ANULADO': return <XCircle className="text-red-500" />;
            case 'EN_TRAMITE':
            case 'PENDIENTE': return <Clock className="text-yellow-500" />;
            case 'ENTREGADO': return <Package className="text-blue-500" />;
            case 'POSTERGADO': return <History className="text-gray-400" />;
            case 'APPROVED': return <CheckCircle className="text-green-500" />;
            case 'PENDING_APPROVAL': return <Clock className="text-yellow-500" />;
            default: return <FileText className="text-gray-500" />;
        }
    };

    return (
        <div className="p-6 lg:p-12 max-w-6xl mx-auto">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-8"
            >
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-400 hover:text-primary-600 font-black uppercase text-[10px] tracking-widest transition-colors"
                >
                    <ArrowLeft size={16} /> Volver al Listado
                </button>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-8" id="requirement-content">
                    {/* Action buttons moved to the top */}
                    {(canApprovePending || canApproveCoordination || canApproveFinance || canManageProcurement || canMarkReceived || canManage || canFullEdit || canEditObservationsOnly) && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-wrap gap-4 mb-4"
                        >
                            {/* Approve button for PENDING_APPROVAL status - Director/Coordinator */}
                            {canApprovePending && (
                                <>
                                    <button
                                        onClick={() => {
                                            setFormError('');
                                            setStatusForm({ ...statusForm, status: 'APPROVED', remarks: '' });
                                            setShowStatusModal(true);
                                        }}
                                        disabled={actionLoading}
                                        className="flex-1 bg-green-500 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-green-600 transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle size={20} /> Aprobar Solicitud
                                    </button>
                                    <button
                                        onClick={() => {
                                            setFormError('');
                                            setStatusForm({ ...statusForm, status: 'REJECTED', remarks: '' });
                                            setShowStatusModal(true);
                                        }}
                                        disabled={actionLoading}
                                        className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                                    >
                                        <XCircle size={20} /> Rechazar
                                    </button>
                                </>
                            )}
                            {canApproveCoordination && (
                                <>
                                    <button
                                        onClick={() => {
                                            setFormError('');
                                            setStatusForm({ ...statusForm, status: 'PENDING_FINANCE', remarks: '' });
                                            setShowStatusModal(true);
                                        }}
                                        disabled={actionLoading}
                                        className="flex-1 bg-green-500 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-green-600 transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle size={20} /> Aprobar Coordinación
                                    </button>
                                </>
                            )}

                            {canApproveFinance && (
                                <>
                                    <button
                                        onClick={() => {
                                            setFormError('');
                                            setStatusForm({ ...statusForm, status: 'APPROVED_FOR_PURCHASE', remarks: '' });
                                            setShowStatusModal(true);
                                        }}
                                        disabled={actionLoading}
                                        className="flex-1 bg-green-500 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-green-600 transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle size={20} /> Aprobar Finanzas
                                    </button>
                                </>
                            )}
                            {(canApproveCoordination || canApproveFinance) && (
                                <button
                                    onClick={() => {
                                        setFormError('');
                                        setStatusForm({ ...statusForm, status: 'REJECTED', remarks: '' });
                                        setShowStatusModal(true);
                                    }}
                                    disabled={actionLoading}
                                    className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <XCircle size={20} /> Rechazar
                                </button>
                            )}

                            {canManageProcurement && !isUserOnly && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex-1 bg-primary-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <Settings size={20} /> Ingresar Datos de Compra
                                </button>
                            )}

                            {canMarkReceived && (
                                <div className="flex-1 bg-green-50 p-2 rounded-2xl border border-green-100 flex items-center justify-center gap-2 text-center">
                                    <Info className="text-green-600" size={16} />
                                    <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Usa el panel de confirmación abajo</span>
                                </div>
                            )}

                            {canManage && (
                                <button
                                    onClick={() => setShowStatusModal(true)}
                                    disabled={actionLoading}
                                    className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-4 rounded-2xl font-black border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <Settings size={20} /> Cambiar Estado
                                </button>
                            )}

                            {canFullEdit && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex-1 bg-primary-50 text-primary-600 py-4 rounded-2xl font-black border border-primary-100 hover:bg-primary-100 transition-all flex items-center justify-center gap-2"
                                >
                                    <Edit3 size={20} /> Editar Detalles
                                </button>
                            )}

                            {canEditObservationsOnly && !isUserOnly && (
                                <button
                                    onClick={() => setShowStatusModal(true)}
                                    className="flex-1 bg-amber-50 text-amber-600 py-4 rounded-2xl font-black border border-amber-100 hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                                >
                                    <Edit3 size={20} /> Agregar Observaciones
                                </button>
                            )}
                        </motion.div>
                    )}

                    <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-start mb-8 pb-8 border-b border-gray-50 dark:border-gray-700">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-600 mb-2">Detalle de Requerimiento</p>
                                <h1 className="text-3xl font-black tracking-tight">{requirement.title}</h1>
                                <p className="text-gray-400 font-bold text-xs mt-2 uppercase tracking-tighter">ID: {requirement.id}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Estado Solicitud</span>
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-2 ${requirement.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-100' :
                                    requirement.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-100' :
                                        'bg-yellow-50 text-yellow-700 border-yellow-100'
                                    }`}>
                                    {getStatusIcon(requirement.status)}
                                    {getStatusLabel(requirement.status)}
                                </span>
                            </div>
                            <div className="flex flex-col items-end gap-2 text-right">
                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Estado Trámite</span>
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-2 ${requirement.procurementStatus === 'FINALIZADO' ? 'bg-green-50 text-green-700 border-green-100' :
                                    requirement.procurementStatus === 'ANULADO' ? 'bg-red-50 text-red-700 border-red-100' :
                                        requirement.procurementStatus === 'ENTREGADO' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                            'bg-indigo-50 text-indigo-700 border-indigo-100'
                                    }`}>
                                    {getStatusIcon(requirement.procurementStatus)}
                                    {getProcStatusLabel(requirement.procurementStatus)}
                                </span>
                            </div>
                            {requirement.status === 'APPROVED' && (
                                <button
                                    onClick={handleDownloadPDF}
                                    disabled={actionLoading}
                                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary-600 hover:underline mt-2 disabled:opacity-50"
                                >
                                    {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                    {actionLoading ? "Generando..." : "Descargar PDF"}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                        <div className="space-y-6">
                            <InfoItem icon={<Building />} label="Proyecto" value={requirement.project.name} />
                            <InfoItem icon={<Package />} label="Área" value={requirement.area.name} />
                            <InfoItem icon={<User />} label="Solicitado por" value={requirement.createdBy.name || requirement.createdBy.email} />
                            <InfoItem
                                icon={<Tag />}
                                label="Categoría"
                                value={categoryOptions.find(o => o.value === requirement.reqCategory)?.label || requirement.reqCategory}
                            />
                            {requirement.purchaseOrderNumber && (
                                <InfoItem icon={<FileText className="text-blue-500" />} label="Orden de Compra" value={requirement.purchaseOrderNumber} />
                            )}
                        </div>
                        <div className="space-y-6">
                            <InfoItem icon={<Calendar />} label="Fecha de Solicitud" value={new Date(requirement.createdAt).toLocaleDateString()} />
                            <InfoItem
                                icon={<Calendar className="text-orange-500" />}
                                label="Fecha Acordada"
                                value={requirement.deliveryDate ? new Date(requirement.deliveryDate).toLocaleDateString() : "No definida"}
                            />
                            <InfoItem
                                icon={<Calendar className="text-green-500" />}
                                label="Fecha de Recepción"
                                value={requirement.receivedDate ? new Date(requirement.receivedDate).toLocaleDateString() : "Pendiente"}
                            />
                            <InfoItem
                                icon={<DollarSign />}
                                label="Monto Real"
                                value={requirement?.actualAmount ? `$${parseFloat(requirement.actualAmount.toString()).toLocaleString()}` : "Pendiente"}
                                highlight={!!requirement?.actualAmount}
                            />
                            <InfoItem icon={<Package />} label="Proveedor" value={requirement.supplier?.name || requirement.manualSupplierName || "No especificado"} />
                            {requirement.invoiceNumber && (
                                <InfoItem icon={<FileText className="text-purple-500" />} label="Factura" value={requirement.invoiceNumber} />
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Descripción</label>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium bg-gray-50 dark:bg-slate-900/50 p-6 rounded-3xl">
                            {requirement.description}
                        </p>
                    </div>

                    {requirement.attachments?.length > 0 && (
                        <div className="mt-8">
                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Archivos Adjuntos ({requirement.attachments.length})</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {requirement.attachments.map((file: Attachment) => (
                                    <div key={file.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all group cursor-pointer"
                                        onClick={() => setSelectedFile(file)}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                                            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 shadow-sm group-hover:scale-110 transition-transform">
                                                <Paperclip size={16} />
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <span className="text-sm font-bold truncate block">{file.fileName}</span>
                                                <span className="text-xs text-gray-400 font-medium">Click para ver</span>
                                            </div>
                                        </div>
                                        <a
                                            href={resolveApiUrl(file.fileUrl)}
                                            download
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-2 text-gray-400 hover:text-primary-500 transition-colors hover:bg-white dark:hover:bg-slate-800 rounded-lg"
                                            title="Descargar archivo"
                                        >
                                            <Download size={16} />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {requirement.quantity && (
                        <div className="mt-8">
                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Cantidad / Unidades</label>
                            <p className="font-bold text-lg text-primary-900 bg-primary-50 px-6 py-3 rounded-2xl border border-primary-100 inline-block">
                                {requirement.quantity}
                            </p>
                        </div>
                    )}

                    {canMarkReceived && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-12 bg-premium-gradient p-[2px] rounded-[3rem] shadow-2xl relative overflow-hidden group"
                        >
                            <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.9rem] flex flex-col md:flex-row gap-8 items-center">
                                <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-[2rem] flex items-center justify-center text-green-500 flex-shrink-0 animate-pulse">
                                    <CheckCircle size={40} />
                                </div>
                                <div className="flex-1 space-y-4 text-center md:text-left">
                                    <h3 className="text-2xl font-black tracking-tight">Confirmar Recibido a Satisfacción</h3>
                                    <p className="text-gray-500 font-medium text-sm">¿Has recibido los productos o servicios solicitados tal como se esperaba? Por favor deja un comentario sobre la entrega.</p>
                                    <textarea
                                        value={statusForm.remarks}
                                        onChange={(e) => setStatusForm({ ...statusForm, procurementStatus: 'FINALIZADO', receivedAtSatisfaction: true, remarks: e.target.value })}
                                        placeholder="Escribe tu comentario de satisfacción aquí... (Requerido)"
                                        className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl p-6 font-bold focus:ring-2 ring-green-500 outline-none resize-none transition-all shadow-inner text-sm"
                                        rows={3}
                                    />
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <button
                                            onClick={handleStatusUpdate}
                                            disabled={actionLoading || !statusForm.remarks}
                                            className="flex-[2] bg-green-500 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-green-600 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:grayscale uppercase tracking-widest text-xs"
                                        >
                                            <CheckCircle size={20} />
                                            {actionLoading ? "Confirmando..." : "Confirmar Recepción"}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setStatusForm({ ...statusForm, status: 'REJECTED', remarks: '' });
                                                setShowStatusModal(true);
                                            }}
                                            className="flex-1 bg-red-50 text-red-600 py-4 rounded-2xl font-black border border-red-100 hover:bg-red-100 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                                        >
                                            <XCircle size={18} /> Reportar Problema
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}


                </div>

                {/* Timeline / Logs */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-8 border-b border-gray-50 dark:border-gray-700 pb-6">
                            <History className="text-primary-500" size={20} />
                            <h3 className="text-xl font-black tracking-tight">Historial</h3>
                        </div>
                        <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100 dark:before:bg-gray-700">
                            {requirement.logs?.map((log) => (
                                <div key={log.id} className="relative pl-10">
                                    <div className="absolute left-0 top-1 w-8 h-8 rounded-full bg-white dark:bg-slate-800 border-2 border-primary-500 z-10 flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary-600 mb-1">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </p>
                                    <p className="font-bold text-sm mb-1">{log.action}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{log.details}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden"
                    >
                        <div className="p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50">
                            <h3 className="text-xl font-black tracking-tight uppercase">Editar Requerimiento</h3>
                            <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-10 max-h-[75vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Left Column */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Título de la Solicitud</label>
                                        <input
                                            type="text"
                                            value={editForm.title}
                                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Cantidad / Unidades</label>
                                            <input
                                                type="text"
                                                value={editForm.quantity}
                                                onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Valor Real de Compra</label>
                                            <input
                                                type="number"
                                                value={editForm.actualAmount}
                                                onChange={(e) => setEditForm({ ...editForm, actualAmount: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none text-green-600"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Factura</label>
                                            <input
                                                type="text"
                                                value={editForm.invoiceNumber}
                                                onChange={(e) => setEditForm({ ...editForm, invoiceNumber: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Orden de Compra</label>
                                            <input
                                                type="text"
                                                value={editForm.purchaseOrderNumber}
                                                onChange={(e) => setEditForm({ ...editForm, purchaseOrderNumber: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Proveedor Asignado</label>
                                        <select
                                            value={editForm.supplierId}
                                            onChange={(e) => setEditForm({ ...editForm, supplierId: e.target.value, manualSupplierName: '' })}
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                        >
                                            <option value="">(Sin asignar)</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Estado del Trámite</label>
                                        <select
                                            value={editForm.procurementStatus}
                                            onChange={(e) => setEditForm({ ...editForm, procurementStatus: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                        >
                                            {procurementStatusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Right Column */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Categoría del Requerimiento</label>
                                        <select
                                            value={editForm.reqCategory}
                                            onChange={(e) => setEditForm({ ...editForm, reqCategory: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                        >
                                            {categoryOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Fecha Acordada</label>
                                            <input
                                                type="date"
                                                value={editForm.deliveryDate}
                                                onChange={(e) => setEditForm({ ...editForm, deliveryDate: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Fecha Recibido</label>
                                            <input
                                                type="date"
                                                value={editForm.receivedDate}
                                                onChange={(e) => setEditForm({ ...editForm, receivedDate: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Descripción</label>
                                        <textarea
                                            rows={2}
                                            value={editForm.description}
                                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none resize-none"
                                        />
                                    </div>

                                    {/* Multiple Payments Toggle */}
                                    <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                                                    <DollarSign size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-sm">Pagos en Cuotas</h4>
                                                    <p className="text-[10px] text-gray-500 font-medium">
                                                        {editForm.hasMultiplePayments
                                                            ? 'Múltiples pagos habilitados'
                                                            : 'Pago único'}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setEditForm({ ...editForm, hasMultiplePayments: !editForm.hasMultiplePayments })}
                                                className={`w-12 h-7 rounded-full transition-all relative ${editForm.hasMultiplePayments ? 'bg-amber-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                                            >
                                                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${editForm.hasMultiplePayments ? 'left-6' : 'left-1'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Archivos Adjuntos</label>

                                        {/* Existing attachments */}
                                        <div className="space-y-2">
                                            {requirement.attachments.filter(a => !deleteAttachmentIds.includes(a.id)).map(att => (
                                                <div key={att.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                                    <span className="text-xs font-bold truncate flex-1 pr-2">{att.fileName}</span>
                                                    <button
                                                        onClick={() => setDeleteAttachmentIds([...deleteAttachmentIds, att.id])}
                                                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                            {deleteAttachmentIds.length > 0 && (
                                                <p className="text-[10px] text-red-500 font-bold ml-2">
                                                    {deleteAttachmentIds.length} archivo(s) marcados para eliminar
                                                </p>
                                            )}
                                        </div>

                                        {/* New files upload */}
                                        <div className="space-y-2">
                                            <input
                                                type="file"
                                                multiple
                                                id="file-upload-edit"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files) {
                                                        setNewFiles([...newFiles, ...Array.from(e.target.files)]);
                                                    }
                                                }}
                                            />
                                            <label
                                                htmlFor="file-upload-edit"
                                                className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-gray-500 hover:border-primary-500 hover:text-primary-500 cursor-pointer transition-all font-bold text-xs"
                                            >
                                                <Paperclip size={16} /> Subir nuevos archivos
                                            </label>

                                            {newFiles.length > 0 && (
                                                <div className="space-y-1">
                                                    {newFiles.map((f, i) => (
                                                        <div key={i} className="flex items-center justify-between text-[10px] font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg">
                                                            <span className="truncate">{f.name}</span>
                                                            <button onClick={() => setNewFiles(newFiles.filter((_, idx) => idx !== i))}>
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-gray-50 dark:bg-slate-900/50 flex gap-4">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex-1 py-4 rounded-2xl font-black text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all tracking-widest uppercase text-xs"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={actionLoading}
                                className="flex-[2] bg-primary-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-primary-700 transition-all flex items-center justify-center gap-2 tracking-widest uppercase text-xs disabled:opacity-50"
                            >
                                {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Guardar Cambios</>}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Status Change Modal */}
            {showStatusModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
                    >
                        <div className="p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50">
                            <h3 className="text-xl font-black tracking-tight uppercase">Actualizar Estado</h3>
                            <button onClick={() => setShowStatusModal(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-10 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Estado Solicitud</label>
                                    <select
                                        disabled={!canManage}
                                        value={statusForm.status}
                                        onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-5 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none appearance-none"
                                    >
                                        {requestStatusOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Estado Trámite</label>
                                    <select
                                        value={statusForm.procurementStatus}
                                        onChange={(e) => setStatusForm({ ...statusForm, procurementStatus: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-5 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none appearance-none"
                                    >
                                        {procurementStatusOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Comentarios / Justificación</label>
                                {formError && <p className="text-[10px] font-bold text-red-500 ml-2 animate-pulse">{formError}</p>}
                                <textarea
                                    rows={4}
                                    value={statusForm.remarks}
                                    onChange={(e) => {
                                        setStatusForm({ ...statusForm, remarks: e.target.value });
                                        if (e.target.value) setFormError('');
                                    }}
                                    placeholder="Explica el motivo del cambio..."
                                    className={`w-full bg-gray-50 dark:bg-slate-900 border ${formError ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-100 dark:border-gray-700'} p-5 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none resize-none transition-all`}
                                />
                            </div>
                        </div>

                        <div className="p-8 bg-gray-50 dark:bg-slate-900/50 flex gap-4">
                            <button
                                onClick={() => setShowStatusModal(false)}
                                className="flex-1 py-4 rounded-2xl font-black text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all tracking-widest uppercase text-[10px]"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleStatusUpdate}
                                disabled={actionLoading}
                                className="flex-[2] bg-slate-900 dark:bg-primary-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-slate-800 dark:hover:bg-primary-500 transition-all flex items-center justify-center gap-2 tracking-widest uppercase text-[10px]"
                            >
                                {actionLoading ? "Actualizando..." : "Confirmar Cambio"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* File Viewer Modal */}
            {selectedFile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setSelectedFile(null)}
                        className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="relative w-full max-w-5xl h-[80vh] bg-white dark:bg-slate-800 rounded-[3rem] shadow-3xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-slate-900/80 to-transparent z-10 p-8 flex justify-between items-start">
                            <div>
                                <h3 className="text-white font-black text-xl mb-1">{selectedFile.fileName}</h3>
                                <p className="text-white/60 text-xs font-medium">Archivo adjunto</p>
                            </div>
                            <div className="flex gap-2">
                                <a
                                    href={selectedFile.fileUrl.startsWith('http') ? selectedFile.fileUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/${selectedFile.fileUrl}`}
                                    download
                                    className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all backdrop-blur-sm"
                                    title="Descargar"
                                >
                                    <Download size={20} />
                                </a>
                                <button
                                    onClick={() => setSelectedFile(null)}
                                    className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all backdrop-blur-sm"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="w-full h-full flex items-center justify-center p-4">
                            {selectedFile.fileName.toLowerCase().endsWith('.pdf') ? (
                                <iframe
                                    src={selectedFile.fileUrl.startsWith('http') ? selectedFile.fileUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/${selectedFile.fileUrl}`}
                                    className="w-full h-full rounded-2xl"
                                    title={selectedFile.fileName}
                                />
                            ) : selectedFile.fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                                <div className="relative w-full h-full">
                                    <Image
                                        src={selectedFile.fileUrl.startsWith('http') ? selectedFile.fileUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/${selectedFile.fileUrl}`}
                                        alt={selectedFile.fileName}
                                        fill
                                        className="object-contain rounded-2xl"
                                    />
                                </div>
                            ) : (
                                <div className="text-center p-12">
                                    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-6">
                                        <Paperclip className="w-10 h-10 text-gray-400" />
                                    </div>
                                    <h4 className="text-2xl font-black mb-2">Vista previa no disponible</h4>
                                    <p className="text-gray-500 mb-6">Este tipo de archivo no se puede visualizar en el navegador</p>
                                    <a
                                        href={selectedFile.fileUrl.startsWith('http') ? selectedFile.fileUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/${selectedFile.fileUrl}`}
                                        download
                                        className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-primary-700 transition-all"
                                    >
                                        <Download size={18} />
                                        Descargar archivo
                                    </a>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

function InfoItem({ icon, label, value, highlight = false }: any) {
    return (
        <div className="flex gap-4 items-center">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${highlight ? 'bg-primary-500 text-white' : 'bg-gray-50 dark:bg-primary-900/20 text-primary-500'}`}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
                <p className={`font-black tracking-tight ${highlight ? 'text-2xl text-primary-900 dark:text-white' : 'text-md text-gray-700 dark:text-gray-200'}`}>{value}</p>
            </div>
        </div>
    );
}
