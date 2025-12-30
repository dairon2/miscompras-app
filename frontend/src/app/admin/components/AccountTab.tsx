"use client";

import { useRouter } from "next/navigation";
import { User, Shield } from "lucide-react";

interface AccountTabProps {
    user: {
        id?: string;
        name?: string;
        email?: string;
        role?: string;
        area?: { name: string };
    } | null;
}

export default function AccountTab({ user }: AccountTabProps) {
    const router = useRouter();

    return (
        <div className="p-8 lg:p-12">
            <div className="max-w-4xl">
                <h3 className="text-2xl font-black mb-2">Detalles de la Cuenta</h3>
                <p className="text-gray-500 text-sm mb-8">
                    Información de tu perfil institucional y accesos en el sistema.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* User Info Card */}
                    <div className="space-y-6">
                        <div className="p-8 bg-white dark:bg-slate-900/50 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm border-b-4 border-b-primary-500">
                            <div className="flex items-center gap-5 mb-8">
                                <div className="w-20 h-20 rounded-3xl bg-premium-gradient flex items-center justify-center text-white shadow-2xl rotate-3 transition-transform hover:rotate-0">
                                    <User size={36} className="-rotate-3 group-hover:rotate-0 transition-transform" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black tracking-tight leading-none mb-2">
                                        {user?.name || 'Usuario'}
                                    </h3>
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                                        {user?.email}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-4 pt-6 border-t border-gray-50 dark:border-gray-800">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400 font-bold uppercase tracking-tighter text-[9px]">
                                        Área Institucional
                                    </span>
                                    <span className="font-black text-gray-800 dark:text-gray-200">
                                        {user?.area?.name || 'No asignada'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400 font-bold uppercase tracking-tighter text-[9px]">
                                        Estado de Cuenta
                                    </span>
                                    <span className="px-2 py-0.5 bg-green-500 text-white rounded-full font-black text-[8px] uppercase tracking-widest">
                                        Activo
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Access Level Card */}
                    <div className="space-y-6">
                        <div className="p-8 bg-primary-50 dark:bg-primary-900/10 rounded-[2.5rem] border border-primary-100 dark:border-primary-900/30">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-primary-600 flex items-center justify-center text-white shadow-lg">
                                    <Shield size={24} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-primary-400 uppercase tracking-widest leading-none mb-1">
                                        Nivel de Acceso
                                    </p>
                                    <p className="text-xl font-black text-primary-700 dark:text-primary-400 leading-none">
                                        {user?.role || 'No definido'}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white/50 dark:bg-black/20 p-5 rounded-2xl border border-primary-200/40">
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary-400 mb-2">
                                    Firma Digital del Sistema
                                </p>
                                <p className="font-mono text-[10px] text-primary-800 dark:text-primary-300 break-all leading-relaxed">
                                    {user?.id}
                                </p>
                            </div>
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
    );
}
