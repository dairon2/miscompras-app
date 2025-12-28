"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useToastStore } from "@/store/toastStore";
import api from "@/lib/api";
import Link from "next/link";

function ResetPasswordForm() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [tokenError, setTokenError] = useState(false);

    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const addToast = useToastStore((state) => state.addToast);

    useEffect(() => {
        if (!token) {
            setTokenError(true);
        }
    }, [token]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        setCapsLockOn(e.getModifierState('CapsLock'));
    };

    // Password validation
    const passwordErrors = {
        length: password.length < 8,
        match: password !== confirmPassword && confirmPassword.length > 0
    };
    const isValid = password.length >= 8 && password === confirmPassword;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isValid) {
            setError("Por favor, corrige los errores en el formulario");
            return;
        }

        setLoading(true);
        setError("");

        try {
            await api.post("/auth/reset-password", { token, password });
            setSuccess(true);
            addToast("Contraseña actualizada correctamente", "success");

            // Redirect to login after 3 seconds
            setTimeout(() => {
                router.push("/login");
            }, 3000);
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || "Error al restablecer la contraseña";
            setError(errorMessage);
            addToast(errorMessage, "error");
        } finally {
            setLoading(false);
        }
    };

    // Token error state
    if (tokenError) {
        return (
            <div className="text-center py-6">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mx-auto flex items-center justify-center mb-4">
                    <XCircle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-bold mb-2">Enlace Inválido</h2>
                <p className="text-gray-500 text-sm mb-6">
                    El enlace de recuperación es inválido o ha expirado. Por favor, solicita uno nuevo.
                </p>
                <Link
                    href="/forgot-password"
                    className="inline-block bg-premium-gradient text-white py-3 px-6 rounded-xl font-bold shadow-lg hover:shadow-primary-500/20 hover:-translate-y-0.5 transition-all"
                >
                    Solicitar Nuevo Enlace
                </Link>
            </div>
        );
    }

    // Success state
    if (success) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6"
            >
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mx-auto flex items-center justify-center mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold mb-2">¡Contraseña Actualizada!</h2>
                <p className="text-gray-500 text-sm mb-6">
                    Tu contraseña ha sido cambiada exitosamente. Serás redirigido al inicio de sesión...
                </p>
                <div className="flex items-center justify-center gap-2 text-primary-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Redirigiendo...</span>
                </div>
            </motion.div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* New Password */}
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">
                    Nueva Contraseña
                </label>
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={`w-full bg-gray-50 dark:bg-slate-900 border rounded-2xl py-4 pl-12 pr-12 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium ${passwordErrors.length && password ? 'border-red-400' : 'border-gray-100 dark:border-gray-700'
                            }`}
                        placeholder="Mínimo 8 caracteres"
                        required
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        tabIndex={-1}
                    >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>
                {passwordErrors.length && password && (
                    <p className="text-red-500 text-xs mt-1 ml-1 font-medium">Mínimo 8 caracteres</p>
                )}
            </div>

            {/* Confirm Password */}
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">
                    Confirmar Contraseña
                </label>
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={`w-full bg-gray-50 dark:bg-slate-900 border rounded-2xl py-4 pl-12 pr-12 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium ${passwordErrors.match ? 'border-red-400' : 'border-gray-100 dark:border-gray-700'
                            }`}
                        placeholder="Repite tu contraseña"
                        required
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        tabIndex={-1}
                    >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>
                {passwordErrors.match && (
                    <p className="text-red-500 text-xs mt-1 ml-1 font-medium">Las contraseñas no coinciden</p>
                )}
            </div>

            {/* Caps Lock Warning */}
            {capsLockOn && (
                <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-amber-600 text-xs"
                >
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Caps Lock está activado</span>
                </motion.div>
            )}

            {/* Error Message */}
            {error && (
                <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-500 text-xs font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/50"
                >
                    {error}
                </motion.p>
            )}

            {/* Submit Button */}
            <button
                type="submit"
                disabled={loading || !isValid}
                className="w-full bg-premium-gradient text-white py-4 rounded-2xl font-bold shadow-lg hover:shadow-primary-500/20 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Restablecer Contraseña"}
            </button>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#fcfcfc] dark:bg-[#0f172a]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-premium-gradient rounded-2xl mx-auto flex items-center justify-center shadow-xl mb-4">
                        <Lock className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight">Nueva Contraseña</h1>
                    <p className="text-gray-500 text-sm mt-2 font-medium">Ingresa tu nueva contraseña</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-2xl shadow-primary-500/5 border border-gray-100 dark:border-gray-700">
                    <Suspense fallback={
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                        </div>
                    }>
                        <ResetPasswordForm />
                    </Suspense>
                </div>
            </motion.div>
        </div>
    );
}
