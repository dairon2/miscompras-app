"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
}

export default function AlertModal({ isOpen, onClose, title, message, type = 'info' }: AlertModalProps) {
    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle className="w-12 h-12 text-green-500" />;
            case 'error': return <AlertCircle className="w-12 h-12 text-red-500" />;
            default: return <Info className="w-12 h-12 text-blue-500" />;
        }
    };

    const getBgColor = () => {
        switch (type) {
            case 'success': return 'bg-green-50 dark:bg-green-900/20';
            case 'error': return 'bg-red-50 dark:bg-red-900/20';
            default: return 'bg-blue-50 dark:bg-blue-900/20';
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl relative overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center text-center">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${getBgColor()}`}>
                                {getIcon()}
                            </div>

                            <h3 className="text-xl font-black mb-2 text-gray-800 dark:text-white">
                                {title}
                            </h3>

                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 leading-relaxed">
                                {message}
                            </p>

                            <button
                                onClick={onClose}
                                className="w-full py-3 px-6 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                Entendido
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
