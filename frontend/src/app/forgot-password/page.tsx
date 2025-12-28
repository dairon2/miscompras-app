"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { useToastStore } from "@/store/toastStore";
import api from "@/lib/api";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");
    const addToast = useToastStore((state) => state.addToast);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await api.post("/auth/forgot-password", { email });
            setSubmitted(true);
            addToast("Se ha enviado un enlace de recuperación a tu correo", "success");
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || "Error al procesar la solicitud";
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
                        <Mail className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight">Recuperar Contraseña</h1>
                    <p className="text-gray-500 text-sm mt-2 font-medium">
                        {submitted
                            ? "Revisa tu bandeja de entrada"
                            : "Te enviaremos un enlace para restablecer tu contraseña"}
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-2xl shadow-primary-500/5 border border-gray-100 dark:border-gray-700">
                    {submitted ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-6"
                        >
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mx-auto flex items-center justify-center mb-4">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <h2 className="text-xl font-bold mb-2">¡Correo Enviado!</h2>
                            <p className="text-gray-500 text-sm mb-6">
                                Si existe una cuenta con el correo <strong>{email}</strong>, recibirás un enlace para restablecer tu contraseña.
                            </p>
                            <p className="text-gray-400 text-xs mb-6">
                                El enlace expirará en 1 hora. Si no recibes el correo, revisa tu carpeta de spam.
                            </p>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 text-primary-600 font-bold hover:underline"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Volver al inicio de sesión
                            </Link>
                        </motion.div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">
                                    Correo Electrónico
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium"
                                        placeholder="usuario@museodeantioquia.co"
                                        required
                                    />
                                </div>
                            </div>

                            {error && (
                                <motion.p
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-red-500 text-xs font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/50"
                                >
                                    {error}
                                </motion.p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-premium-gradient text-white py-4 rounded-2xl font-bold shadow-lg hover:shadow-primary-500/20 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enviar Enlace de Recuperación"}
                            </button>
                        </form>
                    )}

                    {!submitted && (
                        <div className="mt-8 pt-6 border-t border-gray-50 dark:border-gray-700 text-center">
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 font-medium"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Volver al inicio de sesión
                            </Link>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
