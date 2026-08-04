"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Paperclip, Plus, Save, Search, Trash2, WalletCards } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';

type Supplier = { id: string; name: string; nit?: string | null; taxId?: string | null };
type Option = { id: string; name?: string; title?: string; code?: string };

export default function NewAdvancePage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { addToast } = useToastStore();
    const [saving, setSaving] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [projects, setProjects] = useState<Option[]>([]);
    const [areas, setAreas] = useState<Option[]>([]);
    const [budgets, setBudgets] = useState<Option[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [beneficiarySearch, setBeneficiarySearch] = useState('');
    const [form, setForm] = useState({ beneficiaryType: 'SUPPLIER', supplierId: '', beneficiaryDocument: '', beneficiaryName: '', amount: '', purpose: '', costCenter: '', costCenterCode: '', requestDate: new Date().toISOString().slice(0, 10), requirementId: '', budgetId: '', projectId: '', areaId: '' });
    const canManage = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'].includes(user?.role || '');

    const loadCatalogs = useCallback(async () => {
        try {
            const [projectResult, areaResult, budgetResult] = await Promise.allSettled([api.get('/projects'), api.get('/admin/areas'), api.get('/budgets')]);
            if (projectResult.status === 'fulfilled') setProjects(projectResult.value.data);
            if (areaResult.status === 'fulfilled') setAreas(areaResult.value.data);
            if (budgetResult.status === 'fulfilled') setBudgets((budgetResult.value.data.data || budgetResult.value.data).filter((budget: any) => budget.status === 'APPROVED'));
        } catch (error) { console.error(error); }
    }, []);

    useEffect(() => { loadCatalogs(); }, [loadCatalogs]);
    useEffect(() => {
        if (form.beneficiaryType !== 'SUPPLIER' || beneficiarySearch.trim().length < 2) { setSuppliers([]); return; }
        const timer = setTimeout(async () => {
            try { const result = await api.get<Supplier[]>('/advances/beneficiaries', { params: { search: beneficiarySearch } }); setSuppliers(result.data); }
            catch (error) { console.error(error); }
        }, 250);
        return () => clearTimeout(timer);
    }, [beneficiarySearch, form.beneficiaryType]);

    const chooseSupplier = (supplier: Supplier) => {
        setForm(current => ({ ...current, supplierId: supplier.id, beneficiaryDocument: supplier.nit || supplier.taxId || '', beneficiaryName: supplier.name }));
        setBeneficiarySearch(''); setSuppliers([]);
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!form.beneficiaryDocument.trim() || !form.beneficiaryName.trim() || !form.purpose.trim() || Number(form.amount) <= 0) {
            addToast('Completa beneficiario, valor y objeto del anticipo', 'error'); return;
        }
        setSaving(true);
        try {
            const data = new FormData();
            Object.entries(form).forEach(([key, value]) => { if (value) data.append(key, value); });
            files.forEach(file => data.append('attachments', file));
            const result = await api.post('/advances', data);
            addToast(`Anticipo ${result.data.year}-${result.data.consecutive} registrado correctamente`, 'success');
            router.push(`/advances/${result.data.id}`);
        } catch (error: any) {
            addToast(error.response?.data?.error || 'No se pudo registrar el anticipo', 'error');
        } finally { setSaving(false); }
    };

    if (!canManage) return <div className="p-10 text-center text-gray-500">No tienes permiso para registrar anticipos.</div>;

    return <div className="p-6 lg:p-10 max-w-5xl mx-auto">
        <button onClick={() => router.push('/advances')} className="text-gray-500 hover:text-teal-700 flex items-center gap-1 text-sm mb-6"><ArrowLeft className="w-4 h-4" />Volver a Anticipos</button>
        <form onSubmit={submit} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
            <header className="p-7 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-b"><div className="flex items-center gap-3"><div className="p-3 bg-teal-600 text-white rounded-xl"><WalletCards className="w-6 h-6" /></div><div><h1 className="text-2xl font-bold">Nuevo anticipo</h1><p className="text-sm text-gray-500">El número consecutivo anual se asigna al guardar.</p></div></div></header>
            <div className="p-7 space-y-8">
                <section><h2 className="section-title">Beneficiario</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-5"><Field label="Tipo de beneficiario"><select value={form.beneficiaryType} onChange={event => setForm(current => ({ ...current, beneficiaryType: event.target.value, supplierId: '' }))} className="input"><option value="SUPPLIER">Proveedor o contratista</option><option value="EMPLOYEE">Empleado</option></select></Field><Field label="Fecha del anticipo"><input required type="date" value={form.requestDate} onChange={event => setForm(current => ({ ...current, requestDate: event.target.value }))} className="input" /></Field>{form.beneficiaryType === 'SUPPLIER' && <div className="relative md:col-span-2"><label className="label">Buscar proveedor por NIT o nombre</label><div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" /><input value={beneficiarySearch} onChange={event => setBeneficiarySearch(event.target.value)} className="input pl-9" placeholder="Escribe al menos dos caracteres" /></div>{suppliers.length > 0 && <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border bg-white shadow-lg">{suppliers.map(supplier => <button type="button" key={supplier.id} onClick={() => chooseSupplier(supplier)} className="block w-full text-left px-4 py-3 hover:bg-teal-50"><b>{supplier.name}</b><span className="ml-2 text-xs text-gray-500">{supplier.nit || supplier.taxId || 'Sin NIT'}</span></button>)}</div>}</div>}<Field label="Cédula o NIT"><input required value={form.beneficiaryDocument} onChange={event => setForm(current => ({ ...current, beneficiaryDocument: event.target.value }))} className="input" /></Field><Field label="Nombre o razón social"><input required value={form.beneficiaryName} onChange={event => setForm(current => ({ ...current, beneficiaryName: event.target.value }))} className="input" /></Field></div></section>
                <section><h2 className="section-title">Solicitud y control financiero</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-5"><Field label="Valor del anticipo"><input required min="1" type="number" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} className="input" placeholder="0" /></Field><Field label="Centro de costos"><input value={form.costCenter} onChange={event => setForm(current => ({ ...current, costCenter: event.target.value }))} className="input" placeholder="Ej.: PRODUCCIÓN Y LOGÍSTICA" /></Field><div className="md:col-span-2"><Field label="Objeto o concepto"><textarea required value={form.purpose} onChange={event => setForm(current => ({ ...current, purpose: event.target.value }))} className="input min-h-24" placeholder="Describe el motivo del anticipo" /></Field></div><Field label="Código de centro de costos"><input value={form.costCenterCode} onChange={event => setForm(current => ({ ...current, costCenterCode: event.target.value }))} className="input" /></Field><Field label="ID de requerimiento (opcional)"><input value={form.requirementId} onChange={event => setForm(current => ({ ...current, requirementId: event.target.value }))} className="input" placeholder="Pega el identificador si aplica" /></Field><Field label="Proyecto (opcional)"><select value={form.projectId} onChange={event => setForm(current => ({ ...current, projectId: event.target.value }))} className="input"><option value="">Sin proyecto</option>{projects.map(project => <option key={project.id} value={project.id}>{project.code ? `${project.code} · ` : ''}{project.name}</option>)}</select></Field><Field label="Área (opcional)"><select value={form.areaId} onChange={event => setForm(current => ({ ...current, areaId: event.target.value }))} className="input"><option value="">Sin área</option>{areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></Field><Field label="Presupuesto (opcional)"><select value={form.budgetId} onChange={event => setForm(current => ({ ...current, budgetId: event.target.value }))} className="input"><option value="">Sin presupuesto</option>{budgets.map(budget => <option key={budget.id} value={budget.id}>{budget.code ? `${budget.code} · ` : ''}{budget.title}</option>)}</select></Field></div></section>
                <section><h2 className="section-title">Soportes</h2><div className="rounded-xl border border-dashed p-4"><label className="flex items-center gap-2 cursor-pointer text-teal-700 font-semibold"><Paperclip className="w-4 h-4" />Adjuntar solicitud o soportes<input type="file" multiple className="hidden" onChange={event => setFiles(current => [...current, ...Array.from(event.target.files || [])])} /></label>{files.length > 0 && <div className="mt-3 space-y-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex justify-between bg-gray-50 p-2 rounded text-sm"><span className="truncate">{file.name}</span><button type="button" onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} className="text-red-600"><Trash2 className="w-4 h-4" /></button></div>)}</div>}</div></section>
                <div className="flex justify-end gap-3 border-t pt-6"><button type="button" onClick={() => router.push('/advances')} className="px-5 py-3 rounded-xl border font-semibold">Cancelar</button><button disabled={saving} className="px-5 py-3 rounded-xl bg-teal-600 text-white font-bold disabled:opacity-50"><Save className="inline w-4 h-4 mr-2" />{saving ? 'Guardando...' : 'Registrar anticipo'}</button></div>
            </div>
        </form>
    </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="label">{label}</span>{children}</label>; }
