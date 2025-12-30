"use client";

import { motion } from "framer-motion";
import { Settings, Save, Loader2 } from "lucide-react";

interface SystemConfigTabProps {
    systemConfig: {
        appName: string;
        activeYear: number;
        isRegistrationEnabled: boolean;
        maintenanceMode: boolean;
    };
    setSystemConfig: (config: any) => void;
    savingConfig: boolean;
    onSave: () => void;
}

export default function SystemConfigTab({
    systemConfig,
    setSystemConfig,
    savingConfig,
    onSave
}: SystemConfigTabProps) {
    return (
        <section>
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-2xl">
                    <Settings size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-black">Configuración del Sistema</h3>
                    <p className="text-gray-500 text-sm">Ajustes globales de la aplicación</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <label className="text-xs font-black text-gray-600 uppercase tracking-widest">
                        Nombre de la Aplicación
                    </label>
                    <input
                        type="text"
                        value={systemConfig.appName}
                        onChange={(e) => setSystemConfig({ ...systemConfig, appName: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                        placeholder="MisCompras"
                    />
                </div>
                <div className="space-y-3">
                    <label className="text-xs font-black text-gray-600 uppercase tracking-widest">
                        Año Fiscal Activo
                    </label>
                    <input
                        type="number"
                        value={systemConfig.activeYear}
                        onChange={(e) => setSystemConfig({ ...systemConfig, activeYear: parseInt(e.target.value) })}
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl font-bold focus:ring-2 ring-primary-500 outline-none"
                        placeholder="2025"
                    />
                </div>

                {/* Toggle: Registration */}
                <div className="flex items-center justify-between p-6 bg-gray-50 dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-gray-700">
                    <div>
                        <h4 className="font-black text-sm">Habilitar Registro Público</h4>
                        <p className="text-xs text-gray-500 font-bold">Permitir que nuevos usuarios se registren</p>
                    </div>
                    <button
                        onClick={() => setSystemConfig({ ...systemConfig, isRegistrationEnabled: !systemConfig.isRegistrationEnabled })}
                        className={`w-14 h-8 rounded-full transition-all relative ${systemConfig.isRegistrationEnabled ? 'bg-primary-600' : 'bg-gray-300'}`}
                    >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${systemConfig.isRegistrationEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>

                {/* Toggle: Maintenance */}
                <div className="flex items-center justify-between p-6 bg-amber-50 dark:bg-amber-900/10 rounded-[2rem] border border-amber-200 dark:border-amber-900/30">
                    <div>
                        <h4 className="font-black text-sm text-amber-700 dark:text-amber-400">Modo Mantenimiento</h4>
                        <p className="text-xs text-amber-600 dark:text-amber-500 font-bold">Restringir acceso solo a administradores</p>
                    </div>
                    <button
                        onClick={() => setSystemConfig({ ...systemConfig, maintenanceMode: !systemConfig.maintenanceMode })}
                        className={`w-14 h-8 rounded-full transition-all relative ${systemConfig.maintenanceMode ? 'bg-amber-600' : 'bg-gray-300'}`}
                    >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${systemConfig.maintenanceMode ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>
            </div>

            <div className="mt-8 flex justify-end">
                <button
                    onClick={onSave}
                    disabled={savingConfig}
                    className="flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-primary-700 transition-all disabled:opacity-50"
                >
                    {savingConfig ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    Guardar Configuración
                </button>
            </div>
        </section>
    );
}
