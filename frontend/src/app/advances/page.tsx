"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileUp, Plus, RefreshCw, Search, WalletCards } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';

type Advance = {
    id: string;
    consecutive: number;
    year: number;
    requestDate: string;
    beneficiaryType: 'SUPPLIER' | 'EMPLOYEE';
    beneficiaryDocument: string;
    beneficiaryName: string;
    purpose: string;
    amount: number | string;
    status: string;
    costCenter?: string | null;
};

type AdvanceResponse = {
    data: Advance[];
    total: number;
    page: number;
    totalPages: number;
    summary: { byStatus: Array<{ status: string; _count: { _all: number } }>; pendingLegalization: number };
};

const STATUS_LABELS: Record<string, string> = {
    REQUESTED: 'Solicitado', APPROVED: 'Aprobado', DISBURSED: 'Desembolsado', LEGALIZED: 'Legalizado', REJECTED: 'Rechazado', CANCELLED: 'Anulado'
};

const STATUS_COLORS: Record<string, string> = {
    REQUESTED: 'bg-amber-100 text-amber-800', APPROVED: 'bg-blue-100 text-blue-800', DISBURSED: 'bg-violet-100 text-violet-800', LEGALIZED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-800', CANCELLED: 'bg-slate-100 text-slate-700'
};

const formatCurrency = (value: number | string) => `$${Number(value).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

export default function AdvancesPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { addToast } = useToastStore();
    const [response, setResponse] = useState<AdvanceResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<{ totalRows: number; validRows: number; invalidRows: number; existingRows: number } | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const canManage = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'].includes(user?.role || '');
    const canView = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER', 'AUDITOR'].includes(user?.role || '');

    const loadAdvances = useCallback(async () => {
        if (!canView) return;
        setLoading(true);
        try {
            const result = await api.get<AdvanceResponse>('/advances', { params: { page, pageSize: 50, year, status: status || undefined, search: search || undefined } });
            setResponse(result.data);
        } catch (error) {
            console.error(error);
            addToast('No se pudieron cargar los anticipos', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, canView, page, search, status, year]);

    useEffect(() => { const timer = setTimeout(loadAdvances, 200); return () => clearTimeout(timer); }, [loadAdvances]);

    const previewImport = async () => {
        if (!file) return addToast('Selecciona primero el archivo histórico de anticipos', 'error');
        setImporting(true);
        try {
            const data = new FormData(); data.append('file', file);
            const result = await api.post('/advances/import/preview', data);
            setPreview(result.data);
        } catch (error: any) {
            addToast(error.response?.data?.error || 'No se pudo validar el archivo', 'error');
        } finally { setImporting(false); }
    };

    const importFile = async () => {
        if (!file || !preview) return;
        setImporting(true);
        try {
            const data = new FormData(); data.append('file', file);
            const result = await api.post('/advances/import', data);
            addToast(`Importación completada: ${result.data.imported} anticipos nuevos`, 'success');
            setImportOpen(false); setFile(null); setPreview(null); loadAdvances();
        } catch (error: any) {
            addToast(error.response?.data?.error || 'No se pudieron importar los anticipos', 'error');
        } finally { setImporting(false); }
    };

    const exportHistory = async () => {
        try {
            const result = await api.get('/advances/export', { params: { year, status: status || undefined }, responseType: 'blob' });
            const url = URL.createObjectURL(result.data);
            const link = document.createElement('a');
            link.href = url; link.download = `Anticipos_${year}.xlsx`; link.click(); URL.revokeObjectURL(url);
        } catch (error) { console.error(error); addToast('No se pudo exportar el historial de anticipos', 'error'); }
    };

    if (!canView) return <div className="p-10 text-center text-gray-500">No tienes permiso para ver Anticipos.</div>;

    const statusCount = (key: string) => response?.summary.byStatus.find(item => item.status === key)?._count._all || 0;

    return (
        <div className="p-6 lg:p-10 max-w-[1800px] mx-auto space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3"><WalletCards className="w-8 h-8 text-teal-600" />Anticipos</h1>
                    <p className="text-sm text-gray-500 mt-1">Registro, desembolso y legalización de anticipos del Museo.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={exportHistory} className="px-4 py-2 rounded-lg border border-gray-200 font-semibold hover:bg-gray-50"><Download className="inline w-4 h-4 mr-2" />Exportar Excel</button>
                    {canManage && <>
                        <button onClick={() => { setImportOpen(true); setPreview(null); }} className="px-4 py-2 rounded-lg border border-teal-200 text-teal-700 font-semibold hover:bg-teal-50"><FileUp className="inline w-4 h-4 mr-2" />Importar historial</button>
                        <button onClick={() => router.push('/advances/new')} className="px-4 py-2 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700"><Plus className="inline w-4 h-4 mr-2" />Nuevo anticipo</button>
                    </>}
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Metric label="Solicitados" value={statusCount('REQUESTED')} tone="text-amber-700" />
                <Metric label="Aprobados" value={statusCount('APPROVED')} tone="text-blue-700" />
                <Metric label="Desembolsados" value={statusCount('DISBURSED')} tone="text-violet-700" />
                <Metric label="Legalizados" value={statusCount('LEGALIZED')} tone="text-emerald-700" />
                <Metric label="Vencidos por legalizar" value={response?.summary.pendingLegalization || 0} tone="text-red-700" />
            </div>

            <div className="flex flex-col md:flex-row gap-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4">
                <div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar por beneficiario, NIT, objeto o centro de costos" className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm" /></div>
                <input type="number" value={year} onChange={event => { setYear(Number(event.target.value)); setPage(1); }} className="w-28 px-3 py-2 rounded-lg border text-sm" title="Año" />
                <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border text-sm"><option value="">Todos los estados</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <button onClick={loadAdvances} className="p-2 rounded-lg border hover:bg-gray-50" title="Actualizar"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                {loading ? <div className="p-16 text-center text-gray-500"><RefreshCw className="inline animate-spin w-5 h-5 mr-2" />Cargando anticipos...</div> : response?.data.length ? <>
                    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500 uppercase"><tr><th className="p-4 text-left">Nro.</th><th className="p-4 text-left">Fecha</th><th className="p-4 text-left">Beneficiario</th><th className="p-4 text-left">Objeto</th><th className="p-4 text-left">Centro de costos</th><th className="p-4 text-right">Valor</th><th className="p-4 text-center">Estado</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{response.data.map(advance => <tr key={advance.id} onClick={() => router.push(`/advances/${advance.id}`)} className="cursor-pointer hover:bg-teal-50/50 dark:hover:bg-teal-900/10"><td className="p-4 font-black text-teal-700">{advance.year}-{advance.consecutive}</td><td className="p-4 text-xs">{new Date(advance.requestDate).toLocaleDateString('es-CO')}</td><td className="p-4"><p className="font-semibold">{advance.beneficiaryName}</p><p className="text-xs text-gray-500">{advance.beneficiaryDocument} · {advance.beneficiaryType === 'EMPLOYEE' ? 'Empleado' : 'Proveedor'}</p></td><td className="p-4 max-w-[320px] truncate" title={advance.purpose}>{advance.purpose}</td><td className="p-4 text-xs">{advance.costCenter || '-'}</td><td className="p-4 text-right font-mono font-bold">{formatCurrency(advance.amount)}</td><td className="p-4 text-center"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[advance.status]}`}>{STATUS_LABELS[advance.status]}</span></td></tr>)}</tbody></table></div>
                    <div className="p-4 border-t flex items-center justify-between text-sm"><span className="text-gray-500">{response.total.toLocaleString()} anticipos</span><div className="flex items-center gap-2"><button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1} className="p-2 border rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button><span>Página {response.page} de {response.totalPages || 1}</span><button onClick={() => setPage(value => Math.min(response.totalPages, value + 1))} disabled={page >= response.totalPages} className="p-2 border rounded disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button></div></div>
                </> : <div className="p-16 text-center text-gray-500">No hay anticipos para los filtros seleccionados.</div>}
            </div>

            {importOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 p-6 space-y-5 shadow-2xl"><div><h2 className="text-xl font-bold">Importar historial de anticipos</h2><p className="text-sm text-gray-500 mt-1">Primero revisamos el archivo. No se guardará nada hasta que confirmes.</p></div><input type="file" accept=".xlsx,.xlsm,.xls" onChange={event => { setFile(event.target.files?.[0] || null); setPreview(null); }} className="block w-full text-sm" />{preview && <div className="rounded-xl bg-teal-50 p-4 text-sm space-y-1"><p><b>{preview.validRows}</b> filas válidas de {preview.totalRows}</p><p>{preview.existingRows} ya existen y se omitirán.</p>{preview.invalidRows > 0 && <p className="text-amber-700"><AlertTriangle className="inline w-4 h-4 mr-1" />{preview.invalidRows} filas incompletas se excluirán.</p>}</div>}<div className="flex justify-end gap-2"><button onClick={() => setImportOpen(false)} disabled={importing} className="px-4 py-2 rounded-lg border">Cancelar</button>{preview ? <button onClick={importFile} disabled={importing} className="px-4 py-2 rounded-lg bg-teal-600 text-white font-bold">{importing ? 'Importando...' : 'Confirmar importación'}</button> : <button onClick={previewImport} disabled={!file || importing} className="px-4 py-2 rounded-lg bg-teal-600 text-white font-bold">{importing ? 'Validando...' : 'Ver vista previa'}</button>}</div></div></div>}
        </div>
    );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4"><p className="text-[10px] uppercase font-bold text-gray-500">{label}</p><p className={`mt-1 text-2xl font-black ${tone}`}>{value.toLocaleString()}</p></div>; }
