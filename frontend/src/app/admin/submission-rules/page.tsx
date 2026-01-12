"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Clock,
    Calendar,
    Plus,
    Edit,
    Trash2,
    Save,
    X,
    RefreshCw,
    AlertCircle,
    CheckCircle
} from 'lucide-react';
import api from '@/lib/api';
import { useToastStore } from '@/store/toastStore';

interface SubmissionRule {
    id: string;
    name: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isHolidayRule: boolean;
    holidayShift?: number;
    isActive: boolean;
    priority: number;
}

interface Holiday {
    id: string;
    date: string;
    name: string;
    year: number;
}

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function SubmissionRulesPage() {
    const { user, token } = useAuthStore();
    const router = useRouter();
    const { addToast } = useToastStore();

    const [rules, setRules] = useState<SubmissionRule[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingRule, setEditingRule] = useState<SubmissionRule | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '16:00',
        isHolidayRule: false,
        holidayShift: 0,
        priority: 1,
        isActive: true
    });

    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);

    // Check permissions
    const canManage = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR'].includes(user?.role || '');

    useEffect(() => {
        if (!canManage) {
            router.push('/');
            return;
        }
        fetchRules();
        fetchHolidays(selectedYear);
    }, [canManage, selectedYear]);

    const fetchRules = async () => {
        try {
            const res = await api.get('/submission-rules');
            setRules(res.data);
        } catch (error) {
            console.error('Error fetching rules:', error);
            addToast('Error cargando reglas', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchHolidays = async (year: number) => {
        try {
            const res = await api.get(`/submission-rules/holidays/${year}`);
            setHolidays(res.data);
        } catch (error) {
            console.error('Error fetching holidays:', error);
        }
    };

    const handleSyncHolidays = async () => {
        setSyncing(true);
        try {
            const res = await api.post(`/submission-rules/holidays/sync/${selectedYear}`);
            addToast(res.data.message, 'success');
            fetchHolidays(selectedYear);
        } catch (error) {
            console.error('Error syncing holidays:', error);
            addToast('Error sincronizando festivos', 'error');
        } finally {
            setSyncing(false);
        }
    };

    const openCreateModal = () => {
        setEditingRule(null);
        setFormData({
            name: '',
            dayOfWeek: 1,
            startTime: '08:00',
            endTime: '16:00',
            isHolidayRule: false,
            holidayShift: 0,
            priority: 1,
            isActive: true
        });
        setShowModal(true);
    };

    const openEditModal = (rule: SubmissionRule) => {
        setEditingRule(rule);
        setFormData({
            name: rule.name,
            dayOfWeek: rule.dayOfWeek,
            startTime: rule.startTime,
            endTime: rule.endTime,
            isHolidayRule: rule.isHolidayRule,
            holidayShift: rule.holidayShift || 0,
            priority: rule.priority,
            isActive: rule.isActive
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        try {
            if (editingRule) {
                await api.put(`/submission-rules/${editingRule.id}`, formData);
                addToast('Regla actualizada', 'success');
            } else {
                await api.post('/submission-rules', formData);
                addToast('Regla creada', 'success');
            }
            setShowModal(false);
            fetchRules();
        } catch (error) {
            console.error('Error saving rule:', error);
            addToast('Error guardando regla', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta regla?')) return;
        try {
            await api.delete(`/submission-rules/${id}`);
            addToast('Regla eliminada', 'success');
            fetchRules();
        } catch (error) {
            console.error('Error deleting rule:', error);
            addToast('Error eliminando regla', 'error');
        }
    };

    const handleSeedDefaults = async () => {
        try {
            await api.post('/submission-rules/seed');
            addToast('Reglas por defecto creadas', 'success');
            fetchRules();
        } catch (error) {
            console.error('Error seeding rules:', error);
            addToast('Error creando reglas por defecto', 'error');
        }
    };

    if (loading) {
        return (
            <div className="p-12 flex justify-center items-center min-h-screen">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full"
                />
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
                >
                    <ArrowLeft size={18} />
                    Volver
                </button>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">Reglas de Envío</h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Configura los horarios permitidos para el envío de requerimientos
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {rules.length === 0 && (
                            <button
                                onClick={handleSeedDefaults}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors"
                            >
                                <RefreshCw size={16} />
                                Cargar Reglas por Defecto
                            </button>
                        )}
                        <button
                            onClick={openCreateModal}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors"
                        >
                            <Plus size={16} />
                            Nueva Regla
                        </button>
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Rules List */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
                >
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-900/50">
                        <h2 className="text-xl font-black flex items-center gap-2">
                            <Clock className="text-primary-600" size={20} />
                            Reglas de Horario
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            Solo aplican a usuarios con rol "Usuario"
                        </p>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {rules.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <AlertCircle className="mx-auto mb-2 opacity-20" size={40} />
                                <p>No hay reglas configuradas</p>
                                <p className="text-xs">Los usuarios podrán enviar en cualquier momento</p>
                            </div>
                        ) : (
                            rules.map((rule) => (
                                <div
                                    key={rule.id}
                                    className={`p-4 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${!rule.isActive ? 'opacity-50' : ''}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold">{rule.name}</h3>
                                                {rule.isHolidayRule && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-700 border border-amber-200">
                                                        Festivo
                                                    </span>
                                                )}
                                                {!rule.isActive && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-gray-100 text-gray-500 border border-gray-200">
                                                        Inactiva
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500">
                                                <span className="font-bold text-primary-600">{dayNames[rule.dayOfWeek]}</span>
                                                {' '}de {rule.startTime} a {rule.endTime}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => openEditModal(rule)}
                                                className="p-2 text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(rule.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>

                {/* Holidays List */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
                >
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black flex items-center gap-2">
                                <Calendar className="text-red-500" size={20} />
                                Festivos Colombianos
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">
                                Sincronizados automáticamente
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 text-sm font-bold"
                            >
                                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleSyncHolidays}
                                disabled={syncing}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                                Sincronizar
                            </button>
                        </div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                        {holidays.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Calendar className="mx-auto mb-2 opacity-20" size={40} />
                                <p>No hay festivos cargados</p>
                                <p className="text-xs">Haz clic en "Sincronizar" para cargarlos</p>
                            </div>
                        ) : (
                            holidays.map((holiday) => (
                                <div key={holiday.id} className="p-4 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 font-black text-sm">
                                        {new Date(holiday.date).getDate()}
                                    </div>
                                    <div>
                                        <p className="font-bold">{holiday.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(holiday.date).toLocaleDateString('es-CO', {
                                                weekday: 'long',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                <h3 className="text-xl font-black">
                                    {editingRule ? 'Editar Regla' : 'Nueva Regla'}
                                </h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                        Nombre de la Regla
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 font-bold"
                                        placeholder="Ej: Lunes regular"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                            Día de la Semana
                                        </label>
                                        <select
                                            value={formData.dayOfWeek}
                                            onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 font-bold"
                                        >
                                            {dayNames.map((day, idx) => (
                                                <option key={idx} value={idx}>{day}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                            Prioridad
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.priority}
                                            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 font-bold"
                                            min={0}
                                            max={10}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                            Hora Inicio
                                        </label>
                                        <input
                                            type="time"
                                            value={formData.startTime}
                                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                            Hora Fin
                                        </label>
                                        <input
                                            type="time"
                                            value={formData.endTime}
                                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 font-bold"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                                    <input
                                        type="checkbox"
                                        id="isHolidayRule"
                                        checked={formData.isHolidayRule}
                                        onChange={(e) => setFormData({ ...formData, isHolidayRule: e.target.checked })}
                                        className="w-5 h-5 rounded"
                                    />
                                    <label htmlFor="isHolidayRule" className="flex-1">
                                        <p className="font-bold text-amber-800 dark:text-amber-200">Regla de Festivo</p>
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                            Se activa cuando el día anterior es festivo
                                        </p>
                                    </label>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        className="w-5 h-5 rounded"
                                    />
                                    <label htmlFor="isActive" className="font-bold">
                                        Regla Activa
                                    </label>
                                </div>
                            </div>
                            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-4">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors"
                                >
                                    <Save size={16} />
                                    Guardar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
