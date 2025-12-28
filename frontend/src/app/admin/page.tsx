"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Settings,
    Building2,
    Briefcase,
    Tag,
    Users,
    Plus,
    Edit,
    Trash2,
    X,
    Save,
    Loader2,
    Search,
    AlertTriangle,
    Hash,
    Mail,
    Phone,
    MapPin
} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { Sun, Moon, Monitor } from "lucide-react";

type TabType = 'areas' | 'projects' | 'categories' | 'suppliers' | 'users' | 'account' | 'general';

export default function AdminPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [stats, setStats] = useState({ areas: 0, projects: 0, categories: 0, suppliers: 0, users: 0 });
    const [loading, setLoading] = useState(false);
    const { theme, setTheme } = useThemeStore();

    // Data states
    const [areas, setAreas] = useState([]);
    const [projects, setProjects] = useState([]);
    const [categories, setCategories] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [usersList, setUsersList] = useState([]); // Renamed to avoid collision with 'user' from auth

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingItem, setEditingItem] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    // Delete modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<any>(null);

    // Form data
    const [formData, setFormData] = useState<any>({});

    // Search
    const [searchTerm, setSearchTerm] = useState('');

    // ADMIN and DIRECTOR can access catalog management
    const isAdmin = user?.role === 'ADMIN';
    const isDirector = user?.role === 'DIRECTOR';
    const canManageCatalogs = isAdmin || isDirector;

    useEffect(() => {
        if (canManageCatalogs) {
            fetchStats();
            if (activeTab !== 'general') {
                fetchData(activeTab as TabType);
            }
        }
    }, [canManageCatalogs, activeTab]);

    const fetchStats = async () => {
        try {
            const res = await api.get('/admin/stats');
            setStats(res.data);
        } catch (err) {
            console.error("Error fetching stats", err);
        }
    };

    const fetchData = async (tab: TabType) => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/${tab}`);
            switch (tab) {
                case 'areas': setAreas(res.data); break;
                case 'projects': setProjects(res.data); break;
                case 'categories': setCategories(res.data); break;
                case 'suppliers': setSuppliers(res.data); break;
                case 'users' as any: setUsersList(res.data); break;
            }
        } catch (err) {
            console.error(`Error fetching ${tab}`, err);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setModalMode('create');
        setEditingItem(null);
        setFormData(getEmptyForm());
        setShowModal(true);
    };

    const openEditModal = (item: any) => {
        setModalMode('edit');
        setEditingItem(item);
        setFormData({ ...item });
        setShowModal(true);
    };

    const getEmptyForm = () => {
        switch (activeTab) {
            case 'areas': return { name: '' };
            case 'projects': return { name: '', code: '', description: '' };
            case 'categories': return { name: '', code: '', description: '' };
            case 'suppliers': return { name: '', nit: '', contactName: '', email: '', phone: '', address: '' };
            default: return {};
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (modalMode === 'create') {
                await api.post(`/admin/${activeTab}`, formData);
            } else {
                await api.put(`/admin/${activeTab}/${editingItem.id}`, formData);
            }
            setShowModal(false);
            if (activeTab !== 'general') {
                fetchData(activeTab as TabType);
            }
            fetchStats();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = (item: any) => {
        setItemToDelete(item);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await api.delete(`/admin/${activeTab}/${itemToDelete.id}`);
            setShowDeleteModal(false);
            setItemToDelete(null);
            if (activeTab !== 'general') {
                fetchData(activeTab as TabType);
            }
            fetchStats();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Error al eliminar');
        }
    };

    const getCurrentData = () => {
        let data: any[] = [];
        switch (activeTab) {
            case 'areas': data = areas; break;
            case 'projects': data = projects; break;
            case 'categories': data = categories; break;
            case 'suppliers': data = suppliers; break;
            case 'users': data = usersList; break;
        }
        if (searchTerm) {
            return data.filter((item: any) =>
                item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.nit?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        return data;
    };

    const getTabLabel = () => {
        switch (activeTab) {
            case 'areas': return 'Área';
            case 'projects': return 'Proyecto';
            case 'categories': return 'Categoría';
            case 'suppliers': return 'Proveedor';
            case 'users': return 'Usuario';
            case 'account': return 'Cuenta';
            case 'general': return 'Configuración';
            default: return 'General';
        }
    };

    const tabs = [
        { id: 'areas', label: 'Áreas', icon: Building2, count: stats.areas },
        { id: 'projects', label: 'Proyectos', icon: Briefcase, count: stats.projects },
        { id: 'categories', label: 'Categorías', icon: Tag, count: stats.categories },
        { id: 'suppliers', label: 'Proveedores', icon: Users, count: stats.suppliers },
        ...(isAdmin ? [{ id: 'users', label: 'Usuarios', icon: Users, count: stats.users }] : []),
        { id: 'account', label: 'Mi Cuenta', icon: User, count: null },
        { id: 'general', label: 'Configuración', icon: Monitor, count: null }
    ];

    // Simplified check - anyone can enter but content is restricted

    return (
        <div className="p-6 lg:p-12 max-w-7xl mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
            >
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center text-white shadow-lg">
                        <Settings size={28} />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black tracking-tight">Configuración</h2>
                        <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.2em]">Panel de Administración</p>
                    </div>
                </div>

                {canManageCatalogs && (
                    <button
                        onClick={() => activeTab === 'users' ? router.push('/users/new') : openCreateModal()}
                        className={`flex items-center gap-2 bg-primary-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg hover:bg-primary-700 hover:-translate-y-1 transition-all whitespace-nowrap uppercase text-[10px] tracking-widest ${['general', 'account'].includes(activeTab) ? 'opacity-0 pointer-events-none' : ''}`}
                    >
                        <Plus size={18} />
                        <span>Nueva {getTabLabel()}</span>
                    </button>
                )}
            </motion.div>

            {/* Tabs */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-wrap gap-3 mb-8"
            >
                <button
                    onClick={() => { setActiveTab('general'); setSearchTerm(''); }}
                    className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black transition-all ${activeTab === 'general'
                        ? 'bg-primary-600 text-white shadow-lg'
                        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-100 dark:border-gray-700'
                        }`}
                >
                    <Monitor size={18} />
                    <span className="uppercase text-[10px] tracking-widest">General</span>
                </button>

                {canManageCatalogs && tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id as TabType); setSearchTerm(''); }}
                        className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black transition-all ${activeTab === tab.id
                            ? 'bg-primary-600 text-white shadow-lg'
                            : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-100 dark:border-gray-700'
                            }`}
                    >
                        <tab.icon size={18} />
                        <span className="uppercase text-[10px] tracking-widest">{tab.label}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === tab.id
                            ? 'bg-white/20 text-white'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
                            }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </motion.div>

            {/* Content */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
                {activeTab === 'general' ? (
                    <div className="p-8 lg:p-12">
                        <div className="max-w-2xl">
                            <h3 className="text-xl font-black mb-2">Preferencia de Tema</h3>
                            <p className="text-gray-500 text-sm mb-8">Personaliza la apariencia de la aplicación para mayor comodidad visual.</p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`flex flex-col items-center gap-4 p-8 rounded-[2.5rem] border-4 transition-all ${theme === 'light' ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'}`}
                                >
                                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${theme === 'light' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>
                                        <Sun size={32} />
                                    </div>
                                    <span className="font-black uppercase text-[10px] tracking-widest">Modo Claro</span>
                                </button>

                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`flex flex-col items-center gap-4 p-8 rounded-[2.5rem] border-4 transition-all ${theme === 'dark' ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'}`}
                                >
                                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${theme === 'dark' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>
                                        <Moon size={32} />
                                    </div>
                                    <span className="font-black uppercase text-[10px] tracking-widest">Modo Oscuro</span>
                                </button>

                                <button
                                    onClick={() => setTheme('system')}
                                    className={`flex flex-col items-center gap-4 p-8 rounded-[2.5rem] border-4 transition-all ${theme === 'system' ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'}`}
                                >
                                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${theme === 'system' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>
                                        <Monitor size={32} />
                                    </div>
                                    <span className="font-black uppercase text-[10px] tracking-widest">Sistema</span>
                                </button>
                            </div>

                            <div className="mt-12 p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-4">
                                <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={20} />
                                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                                    El modo oscuro ayuda a reducir la fatiga visual en entornos de poca luz y puede ahorrar batería en pantallas OLED. Esta preferencia se guardará en tu navegador.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'account' ? (
                    <div className="p-8 lg:p-12">
                        <div className="max-w-4xl">
                            <h3 className="text-2xl font-black mb-2">Detalles de la Cuenta</h3>
                            <p className="text-gray-500 text-sm mb-8">Información de tu perfil institucional y accesos en el sistema.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="p-6 bg-gray-50 dark:bg-slate-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Nombre Completo</p>
                                        <p className="font-bold text-lg">{user?.name || 'No definido'}</p>
                                    </div>
                                    <div className="p-6 bg-gray-50 dark:bg-slate-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Correo Electrónico</p>
                                        <p className="font-bold text-lg">{user?.email || 'No definido'}</p>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="p-6 bg-primary-50 dark:bg-primary-900/10 rounded-3xl border border-primary-100 dark:border-primary-900/30">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary-600 mb-1">Rol del Sistema</p>
                                        <span className="inline-block px-3 py-1 bg-primary-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest mt-1">
                                            {user?.role || 'No definido'}
                                        </span>
                                    </div>
                                    <div className="p-6 bg-gray-50 dark:bg-slate-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">ID de Usuario</p>
                                        <p className="font-mono text-sm text-gray-500">{user?.id}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    onClick={() => router.push('/profile')}
                                    className="px-8 py-4 bg-primary-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-primary-700 hover:-translate-y-1 transition-all"
                                >
                                    Editar Perfil Completo
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="p-6 border-b border-gray-50 dark:border-gray-700">
                            <div className="relative max-w-md">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder={`Buscar ${activeTab}...`}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-900 border-none rounded-xl font-bold outline-none focus:ring-2 ring-primary-500"
                                />
                            </div>
                        </div>

                        {/* Table */}
                        {loading ? (
                            <div className="p-12 text-center">
                                <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-gray-400 font-bold">Cargando...</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-gray-700">
                                        <tr>
                                            {activeTab === 'areas' && (
                                                <>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Nombre</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Usuarios</th>
                                                </>
                                            )}
                                            {activeTab === 'users' && (
                                                <>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Usuario</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Rol</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Área</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Estado</th>
                                                </>
                                            )}
                                            {activeTab === 'projects' && (
                                                <>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Código</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Nombre</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Requerimientos</th>
                                                </>
                                            )}
                                            {activeTab === 'categories' && (
                                                <>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Código</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Nombre</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Presupuestos</th>
                                                </>
                                            )}
                                            {activeTab === 'suppliers' && (
                                                <>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">NIT</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Nombre</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Contacto</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Requerimientos</th>
                                                </>
                                            )}
                                            <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getCurrentData().length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="px-6 py-12 text-center">
                                                    <p className="text-gray-400 font-bold">No hay {activeTab}</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            getCurrentData().map((item: any) => (
                                                <tr key={item.id} className="border-b border-gray-50 dark:border-gray-700 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors">
                                                    {activeTab === 'areas' && (
                                                        <>
                                                            <td className="px-6 py-4 font-bold">{item.name}</td>
                                                            <td className="px-6 py-4">
                                                                <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded-full text-[10px] font-black">
                                                                    {item._count?.users || 0}
                                                                </span>
                                                            </td>
                                                        </>
                                                    )}
                                                    {activeTab === 'users' && (
                                                        <>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-black text-xs">
                                                                        {item.name?.charAt(0)?.toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-sm tracking-tight">{item.name}</p>
                                                                        <p className="text-[10px] text-gray-500 font-medium">{item.email}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                                                    {item.role}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-sm font-bold text-gray-500">
                                                                {item.area?.name || '-'}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${item.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {item.isActive !== false ? 'Activo' : 'Inactivo'}
                                                                </span>
                                                            </td>
                                                        </>
                                                    )}
                                                    {activeTab === 'projects' && (
                                                        <>
                                                            <td className="px-6 py-4">
                                                                <span className="px-2 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-lg text-[10px] font-black">
                                                                    {item.code || '-'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 font-bold">{item.name}</td>
                                                            <td className="px-6 py-4">
                                                                <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded-full text-[10px] font-black">
                                                                    {item._count?.requirements || 0}
                                                                </span>
                                                            </td>
                                                        </>
                                                    )}
                                                    {activeTab === 'categories' && (
                                                        <>
                                                            <td className="px-6 py-4">
                                                                <span className="px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-lg text-[10px] font-black">
                                                                    {item.code}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 font-bold">{item.name}</td>
                                                            <td className="px-6 py-4">
                                                                <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded-full text-[10px] font-black">
                                                                    {item._count?.budgets || 0}
                                                                </span>
                                                            </td>
                                                        </>
                                                    )}
                                                    {activeTab === 'suppliers' && (
                                                        <>
                                                            <td className="px-6 py-4">
                                                                <span className="text-[11px] font-bold text-gray-500">{item.nit || '-'}</span>
                                                            </td>
                                                            <td className="px-6 py-4 font-bold">{item.name}</td>
                                                            <td className="px-6 py-4 text-sm text-gray-500">{item.contactName || '-'}</td>
                                                            <td className="px-6 py-4">
                                                                <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded-full text-[10px] font-black">
                                                                    {item._count?.requirements || 0}
                                                                </span>
                                                            </td>
                                                        </>
                                                    )}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => activeTab === 'users' ? router.push(`/users/${item.id}`) : openEditModal(item)}
                                                                className="p-2 bg-white dark:bg-slate-800 hover:bg-primary-600 hover:text-white rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all text-primary-600"
                                                                title="Editar"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                            {activeTab === 'users' && (
                                                                <button
                                                                    onClick={async () => {
                                                                        try {
                                                                            await api.patch(`/admin/users/toggle/${item.id}`);
                                                                            fetchData('users' as any);
                                                                        } catch (err) {
                                                                            alert('Error al cambiar estado');
                                                                        }
                                                                    }}
                                                                    className={`p-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all ${item.isActive !== false ? 'text-amber-600 hover:bg-amber-600' : 'text-green-600 hover:bg-green-600'} hover:text-white bg-white dark:bg-slate-800`}
                                                                    title={item.isActive !== false ? 'Desactivar' : 'Activar'}
                                                                >
                                                                    <Hash size={14} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDeleteClick(item)}
                                                                className="p-2 bg-white dark:bg-slate-800 hover:bg-red-600 hover:text-white rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all text-red-600"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </motion.div>

            {/* Create/Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black">
                                    {modalMode === 'create' ? 'Nueva' : 'Editar'} {getTabLabel()}
                                </h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Areas form */}
                                {activeTab === 'areas' && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-600">Nombre del Área *</label>
                                        <input
                                            type="text"
                                            value={formData.name || ''}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                            placeholder="Ej: Curaduría"
                                        />
                                    </div>
                                )}

                                {/* Projects form */}
                                {activeTab === 'projects' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-gray-600">Código</label>
                                                <input
                                                    type="text"
                                                    value={formData.code || ''}
                                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                                    placeholder="PRJ-001"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-gray-600">Nombre *</label>
                                                <input
                                                    type="text"
                                                    value={formData.name || ''}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                                    placeholder="Nombre del proyecto"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-600">Descripción</label>
                                            <textarea
                                                value={formData.description || ''}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none resize-none"
                                                rows={3}
                                                placeholder="Descripción opcional"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Categories form */}
                                {activeTab === 'categories' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-gray-600">Código *</label>
                                                <input
                                                    type="text"
                                                    value={formData.code || ''}
                                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                                    placeholder="CAT-001"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-gray-600">Nombre *</label>
                                                <input
                                                    type="text"
                                                    value={formData.name || ''}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                                    placeholder="Nombre de categoría"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-600">Descripción</label>
                                            <textarea
                                                value={formData.description || ''}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none resize-none"
                                                rows={3}
                                                placeholder="Descripción opcional"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Suppliers form */}
                                {activeTab === 'suppliers' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-gray-600">NIT</label>
                                                <div className="relative">
                                                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                    <input
                                                        type="text"
                                                        value={formData.nit || ''}
                                                        onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 pl-10 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                                        placeholder="900123456-7"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-gray-600">Nombre *</label>
                                                <input
                                                    type="text"
                                                    value={formData.name || ''}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                                    placeholder="Razón social"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-gray-600">Contacto</label>
                                                <input
                                                    type="text"
                                                    value={formData.contactName || ''}
                                                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                                    placeholder="Nombre del contacto"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-gray-600">Email</label>
                                                <div className="relative">
                                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                    <input
                                                        type="email"
                                                        value={formData.email || ''}
                                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 pl-10 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                                        placeholder="correo@proveedor.com"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-gray-600">Teléfono</label>
                                                <div className="relative">
                                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                    <input
                                                        type="tel"
                                                        value={formData.phone || ''}
                                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 pl-10 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                                        placeholder="(604) 123-4567"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-gray-600">Dirección</label>
                                                <div className="relative">
                                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                    <input
                                                        type="text"
                                                        value={formData.address || ''}
                                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 pl-10 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                                        placeholder="Calle 00 # 00-00"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex gap-4 mt-8">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 px-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 py-3 px-6 rounded-2xl bg-primary-600 text-white font-bold hover:bg-primary-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Save size={18} />
                                    )}
                                    {modalMode === 'create' ? 'Crear' : 'Guardar'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setShowDeleteModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="w-8 h-8 text-red-600" />
                                </div>
                                <h3 className="text-xl font-black mb-2">¿Eliminar {getTabLabel()}?</h3>
                                <p className="text-gray-500 text-sm">
                                    Esta acción no se puede deshacer.
                                </p>
                                <p className="font-bold text-primary-600 mt-2">
                                    {itemToDelete?.name}
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 py-3 px-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    className="flex-1 py-3 px-6 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
