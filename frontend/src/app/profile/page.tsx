"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    User,
    Mail,
    Shield,
    Building,
    Phone,
    Briefcase,
    Key,
    Loader2,
    Eye,
    EyeOff,
    Save,
    Check,
    Calendar
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function ProfilePage() {
    const { user, setUser } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [profileSuccess, setProfileSuccess] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    const [profile, setProfile] = useState({
        name: '',
        email: '',
        phone: '',
        position: '',
        role: '',
        area: ''
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const response = await api.get('/users/me');
            const data = response.data;
            setProfile({
                name: data.name || '',
                email: data.email || '',
                phone: data.phone || '',
                position: data.position || '',
                role: data.role || '',
                area: data.area?.name || ''
            });
        } catch (err) {
            console.error("Error fetching profile", err);
        } finally {
            setLoading(false);
        }
    };

    const handleProfileChange = (e: any) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const handlePasswordChange = (e: any) => {
        const { name, value } = e.target;
        setPasswordForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        setProfileSuccess(false);

        try {
            const response = await api.patch('/users/me/profile', {
                name: profile.name,
                phone: profile.phone,
                position: profile.position
            });

            // Update the global user state
            if (setUser && user) {
                setUser({ ...user, name: response.data.name });
            }

            setProfileSuccess(true);
            setTimeout(() => setProfileSuccess(false), 3000);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Error al guardar el perfil');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            alert('Las contraseñas no coinciden');
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            alert('La nueva contraseña debe tener al menos 8 caracteres');
            return;
        }

        setChangingPassword(true);
        setPasswordSuccess(false);

        try {
            await api.patch('/users/me/password', {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });

            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setPasswordSuccess(true);
            setTimeout(() => setPasswordSuccess(false), 3000);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Error al cambiar la contraseña');
        } finally {
            setChangingPassword(false);
        }
    };

    const getRoleBadge = (role: string) => {
        const labels: any = {
            'ADMIN': 'Administrador',
            'DIRECTOR': 'Director',
            'LEADER': 'Líder / Aux. Compras',
            'USER': 'Usuario'
        };
        return labels[role] || role;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 font-bold">Cargando perfil...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-12 max-w-4xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12"
            >
                <h2 className="text-4xl font-black tracking-tight mb-2">Mi Perfil</h2>
                <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.2em]">Configuración de Cuenta Personal</p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Card */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-1"
                >
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 p-8 text-center">
                        <div className="w-24 h-24 rounded-[2rem] bg-primary-600 flex items-center justify-center text-white text-4xl font-black mx-auto mb-6 shadow-xl">
                            {profile.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <h3 className="text-2xl font-black mb-1">{profile.name || 'Usuario'}</h3>
                        <p className="text-gray-400 text-sm font-bold mb-4">{profile.email}</p>

                        <div className="inline-block px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 text-xs font-black uppercase tracking-widest mb-6">
                            {getRoleBadge(profile.role)}
                        </div>

                        <div className="space-y-3 text-left">
                            {profile.area && (
                                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-2xl">
                                    <Building size={16} className="text-gray-400" />
                                    <span className="text-sm font-bold">{profile.area}</span>
                                </div>
                            )}
                            {profile.position && (
                                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-2xl">
                                    <Briefcase size={16} className="text-gray-400" />
                                    <span className="text-sm font-bold">{profile.position}</span>
                                </div>
                            )}
                            {profile.phone && (
                                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-2xl">
                                    <Phone size={16} className="text-gray-400" />
                                    <span className="text-sm font-bold">{profile.phone}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Forms */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-2 space-y-8"
                >
                    {/* Edit Profile Form */}
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <User size={20} className="text-primary-600" />
                                Editar Información
                            </h3>
                        </div>
                        <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-xs font-black text-gray-600">Nombre Completo</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={profile.name}
                                        onChange={handleProfileChange}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-600">Teléfono</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={profile.phone}
                                        onChange={handleProfileChange}
                                        placeholder="(604) 123-4567"
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-600">Cargo</label>
                                    <input
                                        type="text"
                                        name="position"
                                        value={profile.position}
                                        onChange={handleProfileChange}
                                        placeholder="Ej: Coordinador"
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={savingProfile}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all ${profileSuccess
                                        ? 'bg-green-500 text-white'
                                        : 'bg-primary-600 text-white hover:bg-primary-700'
                                        } disabled:opacity-50`}
                                >
                                    {savingProfile ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : profileSuccess ? (
                                        <Check size={18} />
                                    ) : (
                                        <Save size={18} />
                                    )}
                                    {profileSuccess ? 'Guardado' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Change Password Form */}
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <Key size={20} className="text-primary-600" />
                                Cambiar Contraseña
                            </h3>
                        </div>
                        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-600">Contraseña Actual</label>
                                <div className="relative">
                                    <input
                                        type={showCurrentPassword ? 'text' : 'password'}
                                        name="currentPassword"
                                        value={passwordForm.currentPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Tu contraseña actual"
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 pr-12 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600"
                                    >
                                        {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-600">Nueva Contraseña</label>
                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            name="newPassword"
                                            value={passwordForm.newPassword}
                                            onChange={handlePasswordChange}
                                            placeholder="Mínimo 8 caracteres"
                                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 pr-12 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                            required
                                            minLength={8}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600"
                                        >
                                            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-600">Confirmar Contraseña</label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={passwordForm.confirmPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Repite la nueva contraseña"
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={changingPassword}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all ${passwordSuccess
                                        ? 'bg-green-500 text-white'
                                        : 'bg-amber-500 text-white hover:bg-amber-600'
                                        } disabled:opacity-50`}
                                >
                                    {changingPassword ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : passwordSuccess ? (
                                        <Check size={18} />
                                    ) : (
                                        <Key size={18} />
                                    )}
                                    {passwordSuccess ? 'Contraseña Actualizada' : 'Cambiar Contraseña'}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
