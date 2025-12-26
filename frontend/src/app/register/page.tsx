"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserPlus, Mail, Lock, User, Building2, Loader2, Check, X, Eye, EyeOff } from "lucide-react";
import api from "@/lib/api";

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        areaId: ""
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [areas, setAreas] = useState([]);
    const [passwordStrength, setPasswordStrength] = useState(0);
    const router = useRouter();

    useEffect(() => {
        fetchAreas();
    }, []);

    useEffect(() => {
        calculatePasswordStrength(formData.password);
    }, [formData.password]);

    const fetchAreas = async () => {
        try {
            const response = await api.get("/areas");
            setAreas(response.data);
        } catch (err) {
            console.error("Error fetching areas", err);
        }
    };

    const calculatePasswordStrength = (password: string) => {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;
        setPasswordStrength(strength);
    };

    const getPasswordStrengthText = () => {
        switch (passwordStrength) {
            case 0:
            case 1:
                return { text: "Débil", color: "text-red-500", bg: "bg-red-500" };
            case 2:
            case 3:
                return { text: "Media", color: "text-yellow-500", bg: "bg-yellow-500" };
            case 4:
            case 5:
                return { text: "Fuerte", color: "text-green-500", bg: "bg-green-500" };
            default:
                return { text: "", color: "", bg: "" };
        }
    };

    const validateForm = () => {
        if (!formData.name.trim()) {
            setError("El nombre es requerido");
            return false;
        }
        if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            setError("Email inválido");
            return false;
        }
        if (formData.password.length < 8) {
            setError("La contraseña debe tener al menos 8 caracteres");
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            setError("Las contraseñas no coinciden");
            return false;
        }
        if (!formData.areaId) {
            setError("Debes seleccionar un área");
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            await api.post("/auth/register", {
                name: formData.name,
                email: formData.email,
                password: formData.password,
                areaId: formData.areaId
            });

            // Redirigir a login con mensaje de éxito
            router.push("/login?registered=true");
        } catch (err: any) {
            setError(err.response?.data?.error || "Error al registrar usuario");
        } finally {
            setLoading(false);
        }
    };

    const strengthInfo = getPasswordStrengthText();

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#fcfcfc] dark:bg-[#0f172a]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-premium-gradient rounded-2xl mx-auto flex items-center justify-center shadow-xl mb-4">
                        <UserPlus className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight">Crear Cuenta</h1>
                    <p className="text-gray-500 text-sm mt-2 font-medium">
                        Solicita acceso al sistema de Compras del Museo
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-2xl shadow-primary-500/5 border border-gray-100 dark:border-gray-700">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Nombre Completo */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">
                                Nombre Completo
                            </label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium"
                                    placeholder="Juan Pérez"
                                    required
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">
                                Correo Electrónico
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium"
                                    placeholder="usuario@museodeantioquia.co"
                                    required
                                />
                            </div>
                        </div>

                        {/* Área */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">
                                Área de Trabajo
                            </label>
                            <div className="relative">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <select
                                    value={formData.areaId}
                                    onChange={(e) => setFormData({ ...formData, areaId: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium appearance-none"
                                    required
                                >
                                    <option value="">Seleccionar área</option>
                                    {areas.map((area: any) => (
                                        <option key={area.id} value={area.id}>
                                            {area.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Contraseña */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-2xl py-4 pl-12 pr-12 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>

                            {/* Password Strength Indicator */}
                            {formData.password && (
                                <div className="mt-3">
                                    <div className="flex gap-1 mb-2">
                                        {[1, 2, 3, 4, 5].map((level) => (
                                            <div
                                                key={level}
                                                className={`h-1 flex-1 rounded-full transition-all ${level <= passwordStrength ? strengthInfo.bg : "bg-gray-200 dark:bg-gray-700"
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <p className={`text-xs font-bold ${strengthInfo.color}`}>
                                        Seguridad: {strengthInfo.text}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Confirmar Contraseña */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">
                                Confirmar Contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-2xl py-4 pl-12 pr-12 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>

                            {/* Password Match Indicator */}
                            {formData.confirmPassword && (
                                <div className="mt-2 flex items-center gap-2">
                                    {formData.password === formData.confirmPassword ? (
                                        <>
                                            <Check size={16} className="text-green-500" />
                                            <span className="text-xs font-bold text-green-500">Las contraseñas coinciden</span>
                                        </>
                                    ) : (
                                        <>
                                            <X size={16} className="text-red-500" />
                                            <span className="text-xs font-bold text-red-500">Las contraseñas no coinciden</span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-xl p-4">
                                <p className="text-red-600 dark:text-red-400 text-sm font-bold">{error}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-premium-gradient text-white py-4 rounded-2xl font-bold shadow-lg hover:shadow-primary-500/20 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <UserPlus className="w-5 h-5" />
                                    Crear Cuenta
                                </>
                            )}
                        </button>
                    </form>

                    {/* Login Link */}
                    <div className="mt-8 pt-6 border-t border-gray-50 dark:border-gray-700 text-center">
                        <p className="text-sm text-gray-500">
                            ¿Ya tienes cuenta?{" "}
                            <a href="/login" className="text-primary-600 font-bold hover:underline">
                                Inicia sesión
                            </a>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
