"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn, Mail, Lock, Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import api from "@/lib/api";
import Link from "next/link";

// Validation helpers
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPassword = (password: string) => password.length >= 8;

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // New UX states
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [touched, setTouched] = useState({ email: false, password: false });

    const router = useRouter();
    const setAuth = useAuthStore((state) => state.setAuth);
    const addToast = useToastStore((state) => state.addToast);

    // Check for registration success message and load remember me preference
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('registered') === 'true') {
            addToast("¡Registro exitoso! Por favor, inicia sesión.", "success");
            window.history.replaceState({}, '', '/login');
        }

        // Load saved email if remember me was checked
        const savedEmail = localStorage.getItem('rememberedEmail');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
    }, [addToast]);

    // Caps Lock detection
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        setCapsLockOn(e.getModifierState('CapsLock'));
    }, []);

    const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
        setCapsLockOn(e.getModifierState('CapsLock'));
    }, []);

    // Validation messages
    const emailError = touched.email && email && !isValidEmail(email) ? "Email inválido" : "";
    const passwordError = touched.password && password && !isValidPassword(password) ? "Mínimo 8 caracteres" : "";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Mark all fields as touched
        setTouched({ email: true, password: true });

        // Validate before submitting
        if (!isValidEmail(email) || !isValidPassword(password)) {
            setError("Por favor, corrige los errores en el formulario");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await api.post("/auth/login", { email, password, rememberMe });
            const { user, token, refreshToken } = response.data;

            // Save or clear remembered email
            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email);
                if (refreshToken) {
                    localStorage.setItem('refreshToken', refreshToken);
                }
            } else {
                localStorage.removeItem('rememberedEmail');
                localStorage.removeItem('refreshToken');
            }

            setAuth(user, token);
            addToast(`¡Bienvenido, ${user.name || user.email}!`, "success");
            router.push("/");
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || "Error al iniciar sesión";
            setError(errorMessage);
            addToast(errorMessage, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#fcfcfc] dark:bg-[#0f172a]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-premium-gradient rounded-2xl mx-auto flex items-center justify-center shadow-xl mb-4">
                        <LogIn className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight">Bienvenido</h1>
                    <p className="text-gray-500 text-sm mt-2 font-medium">Accede al sistema de Compras del Museo</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-2xl shadow-primary-500/5 border border-gray-100 dark:border-gray-700">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email Field */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Correo Electrónico</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onBlur={() => setTouched(t => ({ ...t, email: true }))}
                                    className={`w-full bg-gray-50 dark:bg-slate-900 border rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium ${emailError ? 'border-red-400 dark:border-red-500' : 'border-gray-100 dark:border-gray-700'
                                        }`}
                                    placeholder="usuario@museodeantioquia.co"
                                    required
                                />
                            </div>
                            {emailError && (
                                <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{emailError}</p>
                            )}
                        </div>

                        {/* Password Field */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onBlur={() => setTouched(t => ({ ...t, password: true }))}
                                    onKeyDown={handleKeyDown}
                                    onKeyUp={handleKeyUp}
                                    className={`w-full bg-gray-50 dark:bg-slate-900 border rounded-2xl py-4 pl-12 pr-12 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium ${passwordError ? 'border-red-400 dark:border-red-500' : 'border-gray-100 dark:border-gray-700'
                                        }`}
                                    placeholder="••••••••"
                                    required
                                />
                                {/* Show/Hide Password Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {passwordError && (
                                <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{passwordError}</p>
                            )}
                            {/* Caps Lock Warning */}
                            {capsLockOn && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-2 text-amber-600 text-xs mt-2 ml-1"
                                >
                                    <AlertTriangle className="w-4 h-4" />
                                    <span className="font-medium">Caps Lock está activado</span>
                                </motion.div>
                            )}
                        </div>

                        {/* Remember Me & Forgot Password Row */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Recordar sesión</span>
                            </label>
                            <Link
                                href="/forgot-password"
                                className="text-sm text-primary-600 hover:text-primary-700 font-medium hover:underline"
                            >
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </div>

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
                            disabled={loading}
                            className="w-full bg-premium-gradient text-white py-4 rounded-2xl font-bold shadow-lg hover:shadow-primary-500/20 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Iniciar Sesión"}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-gray-50 dark:border-gray-700 text-center">
                        <p className="text-sm text-gray-500">¿No tienes cuenta? <Link href="/register" className="text-primary-600 font-bold hover:underline">Solicita acceso</Link></p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
