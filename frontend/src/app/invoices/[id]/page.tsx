"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { invoiceService } from '@/services/invoiceService';
import LoadingButton from '@/components/LoadingButton';
import { ChevronLeft, FileText, CheckCircle, AlertTriangle, Link as LinkIcon, ExternalLink } from 'lucide-react';
import axios from 'axios';
import ConfirmModal from '@/components/ConfirmModal';
import { useToastStore } from '@/store/toastStore';

export default function InvoiceDetailPage() {
    const { token, user } = useAuthStore();
    const params = useParams();
    const router = useRouter();
    const { addToast } = useToastStore();
    const [invoice, setInvoice] = useState<any>(null);
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
    const [requirements, setRequirements] = useState<any[]>([]);
    const [selectedReq, setSelectedReq] = useState<any>(null);
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        if (token && params.id) {
            loadInvoice();
        }
    }, [token, params.id]);

    const loadInvoice = async () => {
        try {
            // Re-using getInvoices for now or need a specific getById endpoint in service?
            // The service doesn't have getById, so we might need to filter or add it.
            // Let's assume we can filter by ID or just use the list for now to find it.
            // Ideally backend should have getInvoiceById. 
            // Controller has getInvoices (list) but not getById. I should add it or filter client side.
            // For speed, let's filter client side from the list or add the endpoint. 
            // Looking at backend routes: router.get('/', ... getInvoices). No /:id.
            // I'll update backend later to be proper, for now I'll fetch all (inefficient) or just fix backend.
            // Actually, let's use the list and find.
            const all = await invoiceService.getInvoices(token!);
            const found = all.find((i: any) => i.id === params.id);
            setInvoice(found);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const searchRequirements = async () => {
        if (!searchQuery) return;
        try {
            // Using existing requirements endpoint with search
            // The existing endpoint might not support search param.
            // Let's fetch all and filter client side for prototype.
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/requirements/all`, { // Admin endpoint usually has all
                headers: { Authorization: `Bearer ${token}` }
            });
            const matches = res.data.data ? res.data.data : res.data; // Handle pagination structure or plain array
            const filtered = (Array.isArray(matches) ? matches : []).filter((r: any) =>
                r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.id.includes(searchQuery)
            ).slice(0, 5);
            setRequirements(filtered);
        } catch (error) {
            console.error(error);
        }
    };

    const handleVerify = async () => {
        if (!selectedReq) return;
        setVerifying(true);
        try {
            await invoiceService.verifyInvoice(token!, invoice.id, selectedReq.id);
            addToast('Factura vinculada exitosamente', 'success');
            loadInvoice();
            setSelectedReq(null);
        } catch (error: any) {
            addToast(error.response?.data?.error || 'Error al vincular', 'error');
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
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
            await invoiceService.approveInvoice(token!, invoice.id);
            addToast('Pago autorizado con éxito', 'success');
            loadInvoice();
        } catch (error) {
            addToast('Error al autorizar pago', 'error');
        }
    };

    const handlePay = async () => {
        const date = prompt('Fecha de Pago (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
        if (!date) return;

        try {
            await invoiceService.payInvoice(token!, invoice.id, { paymentDate: date });
            addToast('Pago registrado correctamente', 'success');
            loadInvoice();
        } catch (error) {
            addToast('Error al registrar pago', 'error');
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

    const isMatchCorrect = selectedReq && Math.abs(parseFloat(invoice.amount) - (parseFloat(selectedReq.actualAmount || '0'))) < 1.0;

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
                                {invoice.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                            <div>
                                <label className="block text-gray-500 text-xs">Monto Factura</label>
                                <p className="text-lg font-mono font-bold">${Number(invoice.amount).toLocaleString()}</p>
                            </div>
                            <div>
                                <label className="block text-gray-500 text-xs">Fecha Emisión</label>
                                <p className="font-medium">{new Date(invoice.issueDate).toLocaleDateString()}</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                            {invoice.status === 'VERIFIED' && (
                                <button onClick={handleApprove} className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold hover:bg-amber-600 transition-colors shadow-sm">
                                    Autorizar Pago
                                </button>
                            )}
                            {invoice.status === 'APPROVED' && (
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

                        {invoice.status === 'RECEIVED' ? (
                            <div className="space-y-4">
                                <p className="text-xs text-gray-500">Busca el requerimiento aprobado para vincular.</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="ID o Título..."
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
                                                <p className="font-bold text-sm">{req.title}</p>
                                                <div className="flex justify-between text-xs mt-1">
                                                    <span className={req.status === 'APPROVED' ? 'text-green-600' : 'text-amber-600'}>{req.status}</span>
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
                            <div className="text-center py-8 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-800/30">
                                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                                <p className="font-bold text-green-800 dark:text-green-400">Vinculación Exitosa</p>
                                {invoice.requirement && (
                                    <div className="mt-4 p-4 bg-white dark:bg-gray-800 mx-4 rounded-lg shadow-sm text-left border dark:border-gray-700">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Orden de Compra</p>
                                        <p className="font-bold text-sm text-blue-600 hover:underline cursor-pointer" onClick={() => router.push(`/requirements/${invoice.requirement.id}`)}>
                                            {invoice.requirement.title}
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-1">ID: {invoice.requirement.id}</p>
                                    </div>
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
