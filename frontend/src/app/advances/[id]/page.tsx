"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle, Download, FileText, Paperclip, RefreshCw, Send, WalletCards, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';

type Advance = {
    id: string; consecutive: number; year: number; requestDate: string; beneficiaryType: string; beneficiaryDocument: string; beneficiaryName: string; purpose: string; amount: number | string; status: string; costCenter?: string | null; costCenterCode?: string | null; legalizationDueDate?: string | null; legalizationNotes?: string | null; cancellationReason?: string | null;
    supplier?: { name: string } | null; requirement?: { id: string; title: string } | null; budget?: { title: string; code?: string | null } | null; project?: { name: string } | null; area?: { name: string } | null;
    requestedBy?: { name?: string | null; email: string }; approvedBy?: { name?: string | null; email: string } | null; disbursedBy?: { name?: string | null; email: string } | null; legalizedBy?: { name?: string | null; email: string } | null;
    attachments: Array<{ id: string; fileName: string; fileUrl: string; createdAt: string }>;
    auditLogs: Array<{ id: string; action: string; details?: string | null; fromStatus?: string | null; toStatus?: string | null; actorEmail?: string | null; createdAt: string }>;
};

const STATUS_LABELS: Record<string, string> = { REQUESTED: 'Solicitado', APPROVED: 'Aprobado', DISBURSED: 'Desembolsado', LEGALIZED: 'Legalizado', REJECTED: 'Rechazado', CANCELLED: 'Anulado' };
const statusTone: Record<string, string> = { REQUESTED: 'bg-amber-100 text-amber-800', APPROVED: 'bg-blue-100 text-blue-800', DISBURSED: 'bg-violet-100 text-violet-800', LEGALIZED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-800', CANCELLED: 'bg-slate-100 text-slate-700' };
const formatCurrency = (amount: number | string) => `$${Number(amount).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

export default function AdvanceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuthStore();
    const { addToast } = useToastStore();
    const [advance, setAdvance] = useState<Advance | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const attachmentInput = useRef<HTMLInputElement>(null);
    const canManage = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'].includes(user?.role || '');

    const loadAdvance = useCallback(async () => {
        if (!params.id) return;
        setLoading(true);
        try { const result = await api.get<Advance>(`/advances/${params.id}`); setAdvance(result.data); }
        catch (error) { console.error(error); addToast('No se pudo cargar el anticipo', 'error'); }
        finally { setLoading(false); }
    }, [addToast, params.id]);

    useEffect(() => { loadAdvance(); }, [loadAdvance]);

    const updateStatus = async (status: string) => {
        if (!advance) return;
        let data: Record<string, string> = { status };
        if (status === 'LEGALIZED') { const notes = window.prompt('Observaciones de legalización (opcional):', ''); if (notes === null) return; data.legalizationNotes = notes; }
        if (status === 'CANCELLED') { const reason = window.prompt('Motivo de anulación:', ''); if (!reason) return; data.cancellationReason = reason; }
        if (!window.confirm(`¿Confirmar cambio a ${STATUS_LABELS[status]}?`)) return;
        setSaving(true);
        try { await api.patch(`/advances/${advance.id}/status`, data); addToast('Estado actualizado correctamente', 'success'); loadAdvance(); }
        catch (error: any) { addToast(error.response?.data?.error || 'No se pudo actualizar el estado', 'error'); }
        finally { setSaving(false); }
    };

    const attachFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []); if (!files.length || !advance) return;
        setSaving(true);
        try { const data = new FormData(); files.forEach(file => data.append('attachments', file)); await api.post(`/advances/${advance.id}/attachments`, data); addToast('Soportes adjuntados correctamente', 'success'); loadAdvance(); }
        catch (error: any) { addToast(error.response?.data?.error || 'No se pudieron adjuntar los soportes', 'error'); }
        finally { setSaving(false); event.target.value = ''; }
    };

    const downloadPdf = async () => {
        if (!advance) return;
        try { const result = await api.get(`/advances/${advance.id}/pdf`, { responseType: 'blob' }); const url = URL.createObjectURL(result.data); const link = document.createElement('a'); link.href = url; link.download = `Solicitud_Anticipo_${advance.year}_${advance.consecutive}.pdf`; link.click(); URL.revokeObjectURL(url); }
        catch (error) { console.error(error); addToast('No se pudo generar el PDF', 'error'); }
    };

    if (loading) return <div className="p-16 text-center text-gray-500"><RefreshCw className="inline animate-spin w-5 h-5 mr-2" />Cargando anticipo...</div>;
    if (!advance) return <div className="p-16 text-center text-gray-500">Anticipo no encontrado.</div>;
    const overdue = advance.status === 'DISBURSED' && advance.legalizationDueDate && new Date(advance.legalizationDueDate) < new Date();

    return <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center gap-3"><button onClick={() => router.push('/advances')} className="text-gray-500 hover:text-teal-700 flex items-center gap-1 text-sm"><ArrowLeft className="w-4 h-4" />Volver a Anticipos</button><button onClick={downloadPdf} className="px-4 py-2 rounded-lg border border-teal-200 text-teal-700 font-semibold hover:bg-teal-50"><Download className="inline w-4 h-4 mr-2" />Descargar formato PDF</button></div>
        <div className="rounded-2xl bg-gradient-to-r from-teal-700 to-cyan-700 text-white p-7 shadow-lg"><div className="flex flex-col sm:flex-row justify-between gap-4"><div><p className="text-teal-100 text-sm font-semibold">SOLICITUD DE ANTICIPO</p><h1 className="text-3xl font-black mt-1">{advance.year}-{advance.consecutive}</h1><p className="text-sm mt-2">{advance.beneficiaryName} · {advance.beneficiaryDocument}</p></div><div className="text-left sm:text-right"><span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${statusTone[advance.status]}`}>{STATUS_LABELS[advance.status]}</span><p className="text-2xl font-mono font-bold mt-3">{formatCurrency(advance.amount)}</p></div></div></div>
        {overdue && <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 text-sm"><AlertTriangle className="inline w-5 h-5 mr-2" />Este anticipo venció el {new Date(advance.legalizationDueDate!).toLocaleDateString('es-CO')} y sigue pendiente de legalización.</div>}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><section className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border p-6"><h2 className="font-bold flex items-center gap-2"><WalletCards className="w-5 h-5 text-teal-600" />Información del anticipo</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 mt-6 text-sm"><Info label="Fecha" value={new Date(advance.requestDate).toLocaleDateString('es-CO')} /><Info label="Tipo" value={advance.beneficiaryType === 'EMPLOYEE' ? 'Empleado' : 'Proveedor / contratista'} /><Info label="Centro de costos" value={advance.costCenter || '-'} /><Info label="Código centro de costos" value={advance.costCenterCode || '-'} /><Info label="Proyecto" value={advance.project?.name || '-'} /><Info label="Área" value={advance.area?.name || '-'} /><Info label="Presupuesto" value={advance.budget ? `${advance.budget.code || ''} ${advance.budget.title}` : '-'} /><Info label="Requerimiento" value={advance.requirement?.title || '-'} /><div className="sm:col-span-2"><Info label="Objeto" value={advance.purpose} /></div>{advance.legalizationDueDate && <Info label="Fecha máxima de legalización" value={new Date(advance.legalizationDueDate).toLocaleDateString('es-CO')} />}{advance.legalizationNotes && <div className="sm:col-span-2"><Info label="Observaciones de legalización" value={advance.legalizationNotes} /></div>}{advance.cancellationReason && <div className="sm:col-span-2"><Info label="Motivo de anulación" value={advance.cancellationReason} /></div>}</div></section>
            <section className="bg-white dark:bg-gray-800 rounded-2xl border p-6"><h2 className="font-bold">Acciones</h2>{canManage ? <div className="mt-4 space-y-2">{advance.status === 'REQUESTED' && <Action label="Aprobar anticipo" icon={<CheckCircle className="w-4 h-4" />} onClick={() => updateStatus('APPROVED')} tone="bg-blue-600" />}{advance.status === 'APPROVED' && <Action label="Registrar desembolso" icon={<Send className="w-4 h-4" />} onClick={() => updateStatus('DISBURSED')} tone="bg-violet-600" />}{advance.status === 'DISBURSED' && <Action label="Registrar legalización" icon={<CheckCircle className="w-4 h-4" />} onClick={() => updateStatus('LEGALIZED')} tone="bg-emerald-600" />}{['REQUESTED', 'APPROVED', 'DISBURSED'].includes(advance.status) && <Action label="Anular anticipo" icon={<XCircle className="w-4 h-4" />} onClick={() => updateStatus('CANCELLED')} tone="bg-red-600" />}<input ref={attachmentInput} type="file" className="hidden" multiple onChange={attachFiles} /><button disabled={saving} onClick={() => attachmentInput.current?.click()} className="w-full py-2.5 rounded-lg border font-semibold hover:bg-gray-50 disabled:opacity-50"><Paperclip className="inline w-4 h-4 mr-2" />Adjuntar soportes</button></div> : <p className="text-sm text-gray-500 mt-3">Modo consulta para auditoría.</p>}</section></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><section className="bg-white dark:bg-gray-800 rounded-2xl border p-6"><h2 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-teal-600" />Soportes ({advance.attachments.length})</h2><div className="mt-4 space-y-2">{advance.attachments.length ? advance.attachments.map(item => <a key={item.id} href={item.fileUrl} target="_blank" rel="noreferrer" className="flex justify-between gap-3 p-3 rounded-lg bg-gray-50 hover:bg-teal-50 text-sm"><span className="truncate">{item.fileName}</span><Download className="w-4 h-4 text-teal-700" /></a>) : <p className="text-sm text-gray-500">No hay soportes adjuntos.</p>}</div></section><section className="bg-white dark:bg-gray-800 rounded-2xl border p-6"><h2 className="font-bold">Trazabilidad</h2><div className="mt-4 space-y-4 border-l-2 border-teal-100 pl-4">{advance.auditLogs.map(log => <div key={log.id} className="text-sm"><p className="font-semibold">{log.action.replace('ADVANCE_', '').replaceAll('_', ' ')}</p><p className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleString('es-CO')} · {log.actorEmail || 'Sistema'}</p>{log.details && <p className="text-xs mt-1 text-gray-600">{log.details}</p>}</div>)}</div></section></div>
    </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-gray-500">{label}</p><p className="font-medium mt-1 break-words">{value}</p></div>; }
function Action({ label, icon, onClick, tone }: { label: string; icon: React.ReactNode; onClick: () => void; tone: string }) { return <button onClick={onClick} className={`w-full py-2.5 rounded-lg text-white font-bold text-sm hover:opacity-90 ${tone}`}>{icon}<span className="ml-2">{label}</span></button>; }
