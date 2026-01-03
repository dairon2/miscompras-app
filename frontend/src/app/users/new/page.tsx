"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    Save,
    User,
    Mail,
    Shield,
    Building,
    Phone,
    Briefcase,
    Key,
    RefreshCw,
    Loader2,
    Eye,
    EyeOff
} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function NewUserPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [areas, setAreas] = useState([]);
    const [showPassword, setShowPassword] = useState(false);

    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'USER',
        areaId: '',
        phone: '',
        position: ''
    });

    // roles that can manage users
    const canManage = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER'].includes(user?.role || '');

    useEffect(() => {
        if (!canManage) {
            router.push('/users');
            return;
        }
        fetchAreas();
    }, [canManage]);

    const fetchAreas = async () => {
        try {
            const response = await api.get('/areas');
            setAreas(response.data);
        } catch (err) {
            console.error("Error fetching areas", err);
        }
    };

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const generatePassword = async () => {
        try {
            const response = await api.get('/admin/users/generate-password');
            setForm(prev => ({ ...prev, password: response.data.password }));
            setShowPassword(true);
        } catch (err) {
            console.error("Error generating password", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.name || !form.email || !form.password) {
            alert('Por favor completa los campos obligatorios: Nombre, Email y Contraseña');
            return;
        }

        if (form.password.length < 8) {
            alert('La contraseña debe tener al menos 8 caracteres');
            return;
        }

        setLoading(true);
        try {
            await api.post('/admin/users', form);
            router.push('/users');
        } catch (err: any) {
            console.error("Error creating user", err);
            alert(err.response?.data?.error || 'Error al crear el usuario');
        } finally {
            setLoading(false);
        }
    };

    if (!canManage) {
        return null;
    }

    return (
        <div className="p-6 lg:p-12 max-w-3xl mx-auto">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-8"
            >
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-400 hover:text-primary-600 font-black uppercase text-[10px] tracking-widest transition-colors"
                >
                    <ArrowLeft size={16} /> Volver a Usuarios
                </button>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
                <div className="p-10 border-b border-gray-50 dark:border-gray-700 bg-gradient-to-r from-primary-50/50 to-indigo-50/50 dark:from-primary-900/10 dark:to-indigo-900/10">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center text-white shadow-lg">
                            <User size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">Nuevo Usuario</h1>
                            <p className="text-gray-500 font-bold text-xs mt-1">Crear cuenta de acceso al sistema</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-8">
                    {/* Basic Information */}
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                            <User size={14} /> Información Personal
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-black text-gray-600">Nombre Completo *</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        name="name"
                                        value={form.name}
                                        onChange={handleChange}
                                        placeholder="Nombre del usuario"
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 pl-12 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Email *</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="email"
                                        name="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        placeholder="correo@ejemplo.com"
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 pl-12 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Teléfono</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={form.phone}
                                        onChange={handleChange}
                                        placeholder="(604) 123-4567"
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 pl-12 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Cargo</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        name="position"
                                        value={form.position}
                                        onChange={handleChange}
                                        placeholder="Ej: Coordinador de Compras"
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 pl-12 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Role and Area */}
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                            <Shield size={14} /> Rol y Área
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Rol del Sistema *</label>
                                <select
                                    name="role"
                                    value={form.role}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none appearance-none"
                                >
                                    <option value="USER">Usuario</option>
                                    <option value="LEADER">Líder / Auxiliar de Compra</option>
                                    <option value="COORDINATOR">Coordinador</option>
                                    <option value="DIRECTOR">Director</option>
                                    <option value="ADMIN">Administrador</option>
                                    <option value="AUDITOR">Auditor</option>
                                    <option value="DEVELOPER">Desarrollador</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Área</label>
                                <select
                                    name="areaId"
                                    value={form.areaId}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none appearance-none"
                                >
                                    <option value="">Seleccionar área</option>
                                    {areas.map((a: any) => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                            <Key size={14} /> Contraseña de Acceso
                        </h3>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Contraseña * (mínimo 8 caracteres)</label>
                                <div className="flex gap-3">
                                    <div className="relative flex-1">
                                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={form.password}
                                            onChange={handleChange}
                                            placeholder="Contraseña segura"
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 pl-12 pr-12 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                            required
                                            minLength={8}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={generatePassword}
                                        className="flex items-center gap-2 bg-gray-100 dark:bg-slate-700 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-gray-600 dark:text-gray-300 hover:text-primary-600 px-4 rounded-2xl font-bold transition-all"
                                        title="Generar contraseña segura"
                                    >
                                        <RefreshCw size={18} />
                                        <span className="hidden md:inline text-xs">Generar</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end gap-4 pt-6 border-t border-gray-50 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-8 py-4 rounded-2xl font-black text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase text-xs tracking-widest"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Crear Usuario
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
