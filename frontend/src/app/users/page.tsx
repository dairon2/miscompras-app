"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Plus,
    Users,
    Mail,
    Shield,
    Building,
    Eye,
    Edit,
    Trash2,
    Power,
    Phone,
    Briefcase,
    Filter
} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function UsersPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [users, setUsers] = useState([]);
    const [areas, setAreas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<any>(null);
    const [filters, setFilters] = useState({
        role: '',
        areaId: '',
        isActive: ''
    });

    // Role-based permissions
    const userRole = user?.role || 'USER';
    const canManage = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER'].includes(userRole);
    const canDelete = ['ADMIN', 'DIRECTOR', 'DEVELOPER'].includes(userRole);

    useEffect(() => {
        fetchUsers();
        fetchAreas();
    }, [filters]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await api.get('/users', {
                params: {
                    ...(filters.role && { role: filters.role }),
                    ...(filters.areaId && { areaId: filters.areaId }),
                    ...(filters.isActive && { isActive: filters.isActive }),
                    ...(searchTerm && { search: searchTerm })
                }
            });
            setUsers(response.data);
        } catch (err) {
            console.error("Error fetching users", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAreas = async () => {
        try {
            const response = await api.get('/areas');
            setAreas(response.data);
        } catch (err) {
            console.error("Error fetching areas", err);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchUsers();
    };

    const handleToggleStatus = async (userId: string) => {
        try {
            await api.patch(`/users/${userId}/toggle-status`);
            fetchUsers();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Error al cambiar estado');
        }
    };

    const handleDeleteClick = (u: any) => {
        setUserToDelete(u);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!userToDelete) return;
        try {
            await api.delete(`/users/${userToDelete.id}`);
            fetchUsers();
            setDeleteModalOpen(false);
            setUserToDelete(null);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Error al eliminar usuario');
        }
    };

    const getRoleBadge = (role: string) => {
        const colors: any = {
            'ADMIN': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            'DIRECTOR': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
            'LEADER': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            'COORDINATOR': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            'AUDITOR': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
            'DEVELOPER': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
            'USER': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
        };
        return colors[role] || colors['USER'];
    };

    if (loading && users.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 font-bold">Cargando usuarios...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-12 max-w-7xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
            >
                <div>
                    <h2 className="text-4xl font-black tracking-tight mb-2">Gestión de Usuarios</h2>
                    <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.2em]">Administración de Personal del Sistema</p>
                </div>

                <div className="flex items-center gap-4">
                    {canManage && (
                        <button
                            onClick={() => router.push('/users/new')}
                            className="flex items-center gap-2 bg-primary-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg hover:bg-primary-700 hover:-translate-y-1 transition-all active:scale-95 whitespace-nowrap uppercase text-[10px] tracking-widest"
                        >
                            <Plus size={18} />
                            <span>Nuevo Usuario</span>
                        </button>
                    )}
                </div>
            </motion.div>

            {/* Filters and Search */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden mb-8"
            >
                <div className="p-6 flex flex-wrap gap-4 border-b border-gray-50 dark:border-gray-700">
                    <form onSubmit={handleSearch} className="flex-1 min-w-[250px] relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-slate-900 border-none rounded-2xl font-bold outline-none focus:ring-2 ring-primary-500"
                        />
                    </form>

                    <div className="relative">
                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select
                            value={filters.role}
                            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                            className="bg-gray-50 dark:bg-slate-900 border-none p-4 pl-12 rounded-2xl font-bold min-w-[170px] appearance-none outline-none focus:ring-2 ring-primary-500"
                        >
                            <option value="">Todos los roles</option>
                            <option value="ADMIN">Administrador</option>
                            <option value="DIRECTOR">Director</option>
                            <option value="LEADER">Líder</option>
                            <option value="COORDINATOR">Coordinador</option>
                            <option value="AUDITOR">Auditor</option>
                            <option value="DEVELOPER">Desarrollador</option>
                            <option value="USER">Usuario</option>
                        </select>
                    </div>

                    <div className="relative">
                        <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select
                            value={filters.areaId}
                            onChange={(e) => setFilters({ ...filters, areaId: e.target.value })}
                            className="bg-gray-50 dark:bg-slate-900 border-none p-4 pl-12 rounded-2xl font-bold min-w-[170px] appearance-none outline-none focus:ring-2 ring-primary-500"
                        >
                            <option value="">Todas las áreas</option>
                            {areas.map((a: any) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select
                            value={filters.isActive}
                            onChange={(e) => setFilters({ ...filters, isActive: e.target.value })}
                            className="bg-gray-50 dark:bg-slate-900 border-none p-4 pl-12 rounded-2xl font-bold min-w-[140px] appearance-none outline-none focus:ring-2 ring-primary-500"
                        >
                            <option value="">Todos</option>
                            <option value="true">Activos</option>
                            <option value="false">Inactivos</option>
                        </select>
                    </div>
                </div>

                {/* Users Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Usuario</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Rol</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Área</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Estado</th>
                                {canManage && (
                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Acciones</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <Users className="mx-auto mb-4 text-gray-300" size={48} />
                                        <p className="text-gray-400 font-bold">No hay usuarios</p>
                                    </td>
                                </tr>
                            ) : (
                                users.map((u: any) => (
                                    <tr
                                        key={u.id}
                                        className="border-b border-gray-50 dark:border-gray-700 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors"
                                    >
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-black text-lg">
                                                    {u.name?.charAt(0)?.toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <p className="font-black text-sm">{u.name || 'Sin nombre'}</p>
                                                    <div className="flex items-center gap-1 text-gray-400">
                                                        <Mail size={12} />
                                                        <span className="text-[11px] font-bold">{u.email}</span>
                                                    </div>
                                                    {u.position && (
                                                        <div className="flex items-center gap-1 text-gray-400 mt-0.5">
                                                            <Briefcase size={10} />
                                                            <span className="text-[10px] font-medium">{u.position}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${getRoleBadge(u.role)}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <Building size={14} className="text-gray-400" />
                                                <span className="text-sm font-bold">{u.area?.name || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            {u.isActive !== false ? (
                                                <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                    Activo
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                    Inactivo
                                                </span>
                                            )}
                                        </td>
                                        {canManage && (
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => router.push(`/users/${u.id}`)}
                                                        className="p-3 bg-white dark:bg-slate-800 hover:bg-primary-600 hover:text-white rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all text-primary-600"
                                                        title="Ver/Editar"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleStatus(u.id)}
                                                        className={`p-3 rounded-xl shadow-sm border transition-all ${u.isActive !== false
                                                            ? 'bg-white dark:bg-slate-800 hover:bg-amber-500 hover:text-white border-gray-100 dark:border-gray-700 text-amber-500'
                                                            : 'bg-green-50 dark:bg-green-900/20 hover:bg-green-500 hover:text-white border-green-200 dark:border-green-800 text-green-600'
                                                            }`}
                                                        title={u.isActive !== false ? 'Desactivar' : 'Activar'}
                                                    >
                                                        <Power size={16} />
                                                    </button>
                                                    {canDelete && u.id !== user?.id && (
                                                        <button
                                                            onClick={() => handleDeleteClick(u)}
                                                            className="p-3 bg-white dark:bg-slate-800 hover:bg-red-600 hover:text-white rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all text-red-500"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setDeleteModalOpen(false)}
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
                                    <Trash2 className="w-8 h-8 text-red-600" />
                                </div>
                                <h3 className="text-xl font-black mb-2">¿Eliminar usuario?</h3>
                                <p className="text-gray-500 text-sm">
                                    Esta acción no se puede deshacer. Se eliminará permanentemente:
                                </p>
                                <p className="font-bold text-primary-600 mt-2">
                                    {userToDelete?.name} ({userToDelete?.email})
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setDeleteModalOpen(false)}
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
