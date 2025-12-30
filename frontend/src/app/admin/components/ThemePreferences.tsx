"use client";

import { Sun, Moon, Monitor } from "lucide-react";

interface ThemePreferencesProps {
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export default function ThemePreferences({ theme, setTheme }: ThemePreferencesProps) {
    const options = [
        { id: 'light', label: 'Modo Claro', icon: Sun },
        { id: 'dark', label: 'Modo Oscuro', icon: Moon },
        { id: 'system', label: 'Sistema', icon: Monitor }
    ] as const;

    return (
        <section>
            <div className="max-w-2xl">
                <h3 className="text-xl font-black mb-2">Preferencia de Tema</h3>
                <p className="text-gray-500 text-sm mb-8">Personaliza la apariencia de la aplicación.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {options.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => setTheme(option.id)}
                            className={`flex flex-col items-center gap-4 p-8 rounded-[2.5rem] border-4 transition-all ${theme === option.id
                                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/10'
                                    : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
                                }`}
                        >
                            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${theme === option.id
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-400'
                                }`}>
                                <option.icon size={32} />
                            </div>
                            <span className="font-black uppercase text-[10px] tracking-widest">{option.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
}
