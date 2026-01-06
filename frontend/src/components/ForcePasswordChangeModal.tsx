
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { X, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ForcePasswordChangeModal() {
    const { user, setUser } = useAuthStore();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 8) {
            setError('La contraseña nueva debe tener al menos 8 caracteres');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setLoading(true);

        try {
            await api.post('/auth/change-password', {
                currentPassword,
                newPassword
            });

            setSuccess(true);

            // Update local user state to remove the flag
            if (user) {
                setUser({ ...user, mustChangePassword: false });
            }

            // Optional: Logout or just close?
            // Since we updated the store, layouts should re-render and hide this modal.

        } catch (err: any) {
            setError(err.response?.data?.error || 'Error al cambiar la contraseña');
        } finally {
            setLoading(false);
        }
    };

    if (!user?.mustChangePassword) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl overflow-hidden border border-white/10"
            >
                <div className="p-8">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Lock className="w-8 h-8 text-amber-600 dark:text-amber-500" />
                    </div>

                    <h2 className="text-2xl font-black text-center text-slate-900 dark:text-white mb-2">Cambio de Contraseña Requerido</h2>
                    <p className="text-center text-slate-500 dark:text-slate-400 text-sm mb-8">
                        Por seguridad, debes actualizar tu contraseña antes de continuar utilizando la plataforma.
                    </p>

                    {success ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold text-green-600 mb-2">¡Contraseña Actualizada!</h3>
                            <p className="text-slate-500 text-sm">Ya puedes continuar navegando.</p>
                            <button
                                onClick={() => window.location.reload()} // Force reload to ensure clean state or just rely on state update
                                className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold"
                            >
                                Continuar
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
                                    <AlertCircle size={14} />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Contraseña Actual</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Nueva Contraseña</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="Mínimo 8 caracteres"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Confirmar Nueva Contraseña</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-black shadow-lg shadow-primary-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                            >
                                {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                            </button>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
