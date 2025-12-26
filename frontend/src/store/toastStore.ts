import { create } from 'zustand';

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
}

interface ToastStore {
    toasts: Toast[];
    addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
    removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
    toasts: [],
    addToast: (message, type, duration) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        const newToast = { id, message, type, duration };

        set((state) => ({
            toasts: [...state.toasts, newToast]
        }));

        // Auto-dismiss after duration (default 3s)
        const dismissDuration = duration || 3000;
        setTimeout(() => {
            set((state) => ({
                toasts: state.toasts.filter((t) => t.id !== id)
            }));
        }, dismissDuration);
    },
    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id)
        }));
    },
}));
