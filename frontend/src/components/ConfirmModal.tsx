"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Trash2, CheckCircle } from "lucide-react";

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'success';
    isLoading?: boolean;
}

/**
 * Reusable confirmation modal for destructive or important actions
 */
export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirmar Acción",
    message,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    type = 'danger',
    isLoading = false
}: ConfirmModalProps) {
    const iconConfig = {
        danger: { icon: Trash2, bg: 'bg-red-100 dark:bg-red-900/20', color: 'text-red-600' },
        warning: { icon: AlertTriangle, bg: 'bg-amber-100 dark:bg-amber-900/20', color: 'text-amber-600' },
        success: { icon: CheckCircle, bg: 'bg-green-100 dark:bg-green-900/20', color: 'text-green-600' }
    };

    const buttonConfig = {
        danger: 'bg-red-600 hover:bg-red-700 text-white',
        warning: 'bg-amber-600 hover:bg-amber-700 text-white',
        success: 'bg-green-600 hover:bg-green-700 text-white'
    };

    const Icon = iconConfig[type].icon;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Icon */}
                        <div className={`w-16 h-16 ${iconConfig[type].bg} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
                            <Icon size={32} className={iconConfig[type].color} />
                        </div>

                        {/* Title */}
                        <h3 className="text-xl font-black text-center mb-2">{title}</h3>

                        {/* Message */}
                        <p className="text-gray-500 text-center mb-8">{message}</p>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={isLoading}
                                className="flex-1 py-4 px-6 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-2xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={isLoading}
                                className={`flex-1 py-4 px-6 ${buttonConfig[type]} rounded-2xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    confirmText
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
