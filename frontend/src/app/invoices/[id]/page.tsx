"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { invoiceService } from '@/services/invoiceService';
import LoadingButton from '@/components/LoadingButton';
import { ChevronLeft, FileText, CheckCircle, AlertTriangle, Link as LinkIcon, ExternalLink } from 'lucide-react';
import axios from 'axios';
import ConfirmModal from '@/components/ConfirmModal';
import { useToastStore } from '@/store/toastStore';
import { translateStatus } from '@/lib/translations';

type InvoiceAttachment = { id: string; fileName: string; fileUrl: string };
type InvoiceAuditLog = { id: string; action: string; details?: string | null; actorEmail?: string | null; createdAt: string };
type RequirementOption = { id: string; groupId?: number | null; title: string; status: string; actualAmount?: number | string | null; supplierId?: string | null };
type InvoiceDetail = {
    id: string;
    invoiceNumber: string;
    supplierId: string;
    amount: number | string;
    subtotal?: number | string | null;
    taxAmount?: number | string | null;
    issueDate: string;
    dueDate?: string | null;
    status: string;
    fileUrl?: string | null;
    purchaseOrderNumber?: string | null;
    requirementNumber?: string | null;
    observations?: string | null;
    causationNumber?: string | null;
    causationDate?: string | null;
    leaderApproval?: boolean | null;
    policyApproverName?: string | null;
    policyReviewObservations?: string | null;
    causationObservations?: string | null;
    transactionNumber?: string | null;
    supplier?: { name?: string | null } | null;
    budget?: { title?: string | null; code?: string | null } | null;
    commercialArea?: { name?: string | null } | null;
    requirement?: { id: string; groupId?: number | null; title?: string | null } | null;
    attachments?: InvoiceAttachment[];
    auditLogs?: InvoiceAuditLog[];
};

const formatRequirementReference = (groupId?: number | null, storedNumber?: string | null) => {
    const value = groupId ?? storedNumber;
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const text = String(value).trim();
    return text.startsWith('#') ? text : `#${text}`;
};

const getRequestErrorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) return error.response?.data?.error || fallback;
    return error instanceof Error ? error.message : fallback;
};

export default function InvoiceDetailPage() {
    const { token, user } = useAuthStore();
    const params = useParams();
    const router = useRouter();
    const { addToast } = useToastStore();
    const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'danger' | 'warning' | 'success' | 'info';
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: () => { }
    });

    // Matching State
    const [searchQuery, setSearchQuery] = useState('');
    const [requirements, setRequirements] = useState<RequirementOption[]>([]);
    const [selectedReq, setSelectedReq] = useState<RequirementOption | null>(null);
    const [verifying, setVerifying] = useState(false);

    const loadInvoice = useCallback(async () => {
        if (!token || !params.id) return;
        try {
            const found = await invoiceService.getInvoiceById(token, String(params.id));
            setInvoice(found);
        } catch (error) {
            console.error(error);
            addToast('No se pudo cargar la factura', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, params.id, token]);

    useEffect(() => {
        if (token && params.id) {
            loadInvoice();
        }
    }, [loadInvoice, params.id, token]);

    const searchRequirements = async () => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        if (!normalizedQuery || !invoice) return;
        try {
            const matches = await invoiceService.searchCompatibleRequirements(token!, invoice.id, normalizedQuery) as RequirementOption[];
            setRequirements(matches);
            if (matches.length === 0) addToast('No se encontraron requerimientos aprobados compatibles', 'info');
        } catch (error) {
            console.error(error);
            addToast('No se pudieron consultar los requerimientos', 'error');
        }
    };

    const handleVerify = async () => {
        if (!selectedReq || !invoice) return;
        setVerifying(true);
        try {
            await invoiceService.verifyInvoice(token!, invoice.id, selectedReq.id);
            addToast('Factura vinculada exitosamente', 'success');
            loadInvoice();
            setSelectedReq(null);
        } catch (error: unknown) {
            addToast(getRequestErrorMessage(error, 'Error al vincular'), 'error');
        } finally {
            setVerifying(false);
        }
    };

    const handleApprove = () => {
        setConfirmConfig({
            isOpen: true,
            title: '¿Autorizar Pago?',
            message: '¿Estás seguro de que deseas autorizar el pago de esta factura? Esta acción es irreversible.',
            type: 'info',
            onConfirm: executeApprove
        });
    };

    const executeApprove = async () => {
        if (!invoice) return;
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
            await invoiceService.approveInvoice(token!, invoice.id);
            addToast('Pago autorizado con éxito', 'success');
            loadInvoice();
        } catch (error: unknown) {
            addToast(getRequestErrorMessage(error, 'Error al autorizar pago'), 'error');
        }
    };

    const handlePay = async () => {
        if (!invoice) return;
        const date = prompt('Fecha de Pago (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
        if (!date) return;
        const transactionNumber = prompt('Número de transacción o comprobante (opcional):', '') || undefined;

        try {
            await invoiceService.payInvoice(token!, invoice.id, { paymentDate: date, transactionNumber });
            addToast('Pago registrado correctamente', 'success');
            loadInvoice();
        } catch (error: unknown) {
            addToast(getRequestErrorMessage(error, 'Error al registrar pago'), 'error');
        }
    };

    if (loading) return <div className="p-12 text-center">Cargando...</div>;
    if (!invoice) return <div className="p-12 text-center">Factura no encontrada</div>;

    const getFileUrl = (url: string) => {
        if (!url) return "";
        if (url.startsWith('http')) return url;
        const baseUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '');
        return `${baseUrl}/${url.replace(/\\/g, '/')}`;
    };

    const isMatchCorrect = selectedReq && Math.abs(Number(invoice.amount) - Number(selectedReq.actualAmount || 0)) < 1.0;
    const userRole = user?.role || '';
    const canManageInvoices = ['ADMIN', 'DIRECTOR', 'DEVELOPER', 'COORDINATOR'].includes(userRole);
    const canApproveInvoices = ['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER', 'COORDINATOR'].includes(userRole);
    const canPayInvoices = ['ADMIN', 'DIRECTOR', 'DEVELOPER', 'COORDINATOR'].includes(userRole);
    const formatCurrency = (value: number | string | null | undefined) => value !== null && value !== undefined ? `$${Number(value).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
    const leaderApprovalLabel = invoice.leaderApproval === true ? 'Aprobada' : invoice.leaderApproval === false ? 'No aprobada' : 'Pendiente / No aplica';
    const requirementReference = formatRequirementReference(invoice.requirement?.groupId, invoice.requirementNumber);
    const getAuditDetails = (log: InvoiceAuditLog) => {
        if (!log.details || !invoice.requirement?.id || !requirementReference || !['INVOICE_RECONCILED', 'INVOICE_VERIFIED'].includes(log.action)) return log.details;
        return log.details.replaceAll(invoice.requirement.id, requirementReference);
    };
    const auditActionLabel = (action: string) => ({
        INVOICE_CREATED: 'Factura recepcionada',
        INVOICE_VERIFIED: 'Factura vinculada',
        INVOICE_RECONCILED: 'Vínculo conciliado',
        INVOICE_APPROVED: 'Pago autorizado',
        INVOICE_PAID: 'Pago registrado',
        INVOICE_DELETED: 'Factura eliminada'
    }[action] || action);

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Volver
            </button>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* PDF Viewer (Main Panel) */}
                <div className="xl:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-[800px] flex flex-col">
                        <div className="p-4 flex justify-between items-center border-b dark:border-gray-700">
                            <h3 className="font-bold flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                Visor de Documento
                            </h3>
                            {invoice.fileUrl && (
                                <a
                                    href={getFileUrl(invoice.fileUrl)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                                >
                                    Abrir en ventana nueva <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-b-xl overflow-hidden">
                            {invoice.fileUrl ? (
                                <iframe
                                    src={`${getFileUrl(invoice.fileUrl)}#toolbar=0`}
                                    className="w-full h-full border-none"
                                    title="Invoice PDF"
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <AlertTriangle className="w-12 h-12 mb-2" />
                                    <p>No hay documento adjunto</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar: Details & Matching */}
                <div className="space-y-6">
                    {/* Invoice Details Card */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-xl font-bold">Factura #{invoice.invoiceNumber}</h2>
                                <p className="text-gray-500 text-sm">{invoice.supplier?.name}</p>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                {translateStatus(invoice.status)}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                            <div>
                                <label className="block text-gray-500 text-xs">Monto Factura</label>
                                <p className="text-lg font-mono font-bold">{formatCurrency(invoice.amount)}</p>
                            </div>
                            <div>
                                <label className="block text-gray-500 text-xs">Fecha Emisión</label>
                                <p className="font-medium">{new Date(invoice.issueDate).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="space-y-5 border-t border-gray-100 pt-5 text-sm dark:border-gray-700">
                            <div className="grid grid-cols-2 gap-4">
                                <InfoBlock label="Subtotal" value={formatCurrency(invoice.subtotal)} />
                                <InfoBlock label="IVA" value={formatCurrency(invoice.taxAmount)} />
                                <InfoBlock label="Orden de Compra" value={invoice.purchaseOrderNumber || '-'} />
                                <InfoBlock label="Requerimiento" value={requirementReference || (invoice.requirement ? 'Vinculado' : '-')} />
                                <InfoBlock label="Vencimiento" value={invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'} />
                                <InfoBlock label="Presupuesto" value={invoice.budget?.title || invoice.budget?.code || '-'} />
                                <InfoBlock label="Área Comercial" value={invoice.commercialArea?.name || '-'} />
                                <InfoBlock label="Causación" value={invoice.causationNumber || '-'} />
                                <InfoBlock label="Fecha Causación" value={invoice.causationDate ? new Date(invoice.causationDate).toLocaleDateString() : '-'} />
                                <InfoBlock label="Aprobación Líder" value={leaderApprovalLabel} />
                                <InfoBlock label="Aprueba Pólizas" value={invoice.policyApproverName || '-'} />
                                <InfoBlock label="Transacción" value={invoice.transactionNumber || '-'} />
                            </div>

                            {(invoice.observations || invoice.causationObservations || invoice.policyReviewObservations) && (
                                <div className="space-y-3">
                                    {invoice.observations && <LongInfoBlock label="Observaciones" value={invoice.observations} />}
                                    {invoice.causationObservations && <LongInfoBlock label="Observaciones de Causación" value={invoice.causationObservations} />}
                                    {invoice.policyReviewObservations && <LongInfoBlock label="Observaciones de Pólizas" value={invoice.policyReviewObservations} />}
                                </div>
                            )}

                            {invoice.attachments && invoice.attachments.length > 0 && (
                                <div>
                                    <label className="block text-gray-500 text-xs mb-2">Anexos</label>
                                    <div className="space-y-2">
                                        {invoice.attachments.map((attachment: InvoiceAttachment) => (
                                            <a
                                                key={attachment.id}
                                                href={getFileUrl(attachment.fileUrl)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-gray-700 dark:hover:bg-blue-900/20"
                                            >
                                                <span className="truncate">{attachment.fileName}</span>
                                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {invoice.auditLogs && invoice.auditLogs.length > 0 && (
                                <div>
                                    <label className="block text-gray-500 text-xs mb-2">Trazabilidad</label>
                                    <div className="space-y-3 border-l-2 border-blue-100 pl-4 dark:border-blue-900/40">
                                        {invoice.auditLogs.map((log: InvoiceAuditLog) => (
                                            <div key={log.id} className="relative text-xs">
                                                <span className="absolute -left-[23px] top-0.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-white dark:ring-gray-800" />
                                                <p className="font-semibold text-gray-800 dark:text-gray-200">{auditActionLabel(log.action)}</p>
                                                <p className="text-gray-500">{new Date(log.createdAt).toLocaleString()} {log.actorEmail ? `· ${log.actorEmail}` : ''}</p>
                                                {getAuditDetails(log) && <p className="mt-1 text-gray-600 dark:text-gray-400">{getAuditDetails(log)}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="space-y-2 mt-6">
                            {invoice.status === 'VERIFIED' && canApproveInvoices && (
                                <button onClick={handleApprove} className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold hover:bg-amber-600 transition-colors shadow-sm">
                                    Autorizar Pago
                                </button>
                            )}
                            {invoice.status === 'APPROVED' && canPayInvoices && (
                                <button onClick={handlePay} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-sm">
                                    Registrar Pago
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 3-Way Match Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <LinkIcon className="w-5 h-5 text-purple-600" />
                            Vinculación (3-Way Match)
                        </h3>

                        {invoice.requirement ? (
                            <div className="text-center py-8 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-800/30">
                                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                                <p className="font-bold text-green-800 dark:text-green-400">Vinculación confirmada</p>
                                <div className="mt-4 p-4 bg-white dark:bg-gray-800 mx-4 rounded-lg shadow-sm text-left border dark:border-gray-700">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Requerimiento {requirementReference || 'vinculado'}</p>
                                    <p className="font-bold text-sm text-blue-600 hover:underline cursor-pointer" onClick={() => router.push(`/requirements/${invoice.requirement?.id}`)}>
                                        {invoice.requirement.title || `Abrir requerimiento ${requirementReference || ''}`}
                                    </p>
                                </div>
                            </div>
                        ) : invoice.status === 'RECEIVED' ? (
                            canManageInvoices ? (
                                <div className="space-y-4">
                                <p className="text-xs text-gray-500">Busca el requerimiento aprobado para vincular.</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Número, OC o título..."
                                        className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                    <button
                                        onClick={searchRequirements}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors"
                                    >
                                        Buscar
                                    </button>
                                </div>

                                {requirements.length > 0 && (
                                    <div className="space-y-2 mt-4 max-h-60 overflow-y-auto">
                                        {requirements.map(req => (
                                            <div
                                                key={req.id}
                                                onClick={() => setSelectedReq(req)}
                                                className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedReq?.id === req.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                            >
                                                <p className="font-bold text-sm">Requerimiento {formatRequirementReference(req.groupId) || 'sin número'} · {req.title}</p>
                                                <div className="flex justify-between text-xs mt-1">
                                                    <span className={req.status === 'APPROVED' ? 'text-green-600' : 'text-amber-600'}>{translateStatus(req.status)}</span>
                                                    <span className="font-mono font-bold">${Number(req.actualAmount || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {selectedReq && (
                                    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <h4 className="font-bold text-xs mb-2 uppercase text-gray-500">Resumen</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span>Factura:</span>
                                                <span className="font-mono font-bold">${Number(invoice.amount).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Requerimiento:</span>
                                                <span className="font-mono font-bold">${Number(selectedReq.actualAmount || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="pt-2 border-t dark:border-gray-700 flex justify-between items-center font-bold">
                                                <span>Diferencia:</span>
                                                <span className={isMatchCorrect ? 'text-green-600' : 'text-red-600'}>
                                                    ${(Number(invoice.amount) - Number(selectedReq.actualAmount || 0)).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        {!isMatchCorrect && (
                                            <div className="mt-3 flex items-start gap-2 text-amber-600 text-[10px] bg-amber-50 dark:bg-amber-900/10 p-2 rounded">
                                                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                                <span>Los montos no coinciden. Revisa antes de verificar.</span>
                                            </div>
                                        )}

                                        <LoadingButton
                                            isLoading={verifying}
                                            onClick={handleVerify}
                                            className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-bold shadow-md transition-all active:scale-[0.98]"
                                        >
                                            Vincular Factura
                                        </LoadingButton>
                                    </div>
                                )}
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
                                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                                    <p className="font-bold text-amber-800 dark:text-amber-300">Pendiente de vinculación</p>
                                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Un usuario autorizado debe vincular esta factura a un requerimiento aprobado.</p>
                                </div>
                            )
                        ) : (
                            <div className="text-center py-8 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
                                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                                <p className="font-bold text-amber-800 dark:text-amber-300">Pendiente de conciliación</p>
                                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Esta factura no tiene un requerimiento vinculado. Su estado actual se conservará.</p>
                                {canManageInvoices && (
                                    <button onClick={() => router.push('/invoices/reconciliation')} className="mt-4 px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
                                        Abrir conciliación administrativa
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                type={confirmConfig.type}
            />
        </div>
    );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <label className="block text-gray-500 text-xs">{label}</label>
            <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{value}</p>
        </div>
    );
}

function LongInfoBlock({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <label className="block text-gray-500 text-xs">{label}</label>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-700 dark:bg-gray-900/40 dark:text-gray-300">{value}</p>
        </div>
    );
}
