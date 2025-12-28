import { create } from 'zustand';
import api from '@/lib/api';

interface User {
    id: string;
    email: string;
    name?: string;
    role: string;
    areaId?: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    rememberMe: boolean;
    setAuth: (user: User, token: string) => void;
    setUser: (user: User | null) => void;
    logout: () => void;
    setRememberMe: (value: boolean) => void;
    refreshAccessToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null,
    token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
    isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('token') : false,
    rememberMe: typeof window !== 'undefined' ? localStorage.getItem('rememberMe') === 'true' : false,

    setAuth: (user, token) => {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('token', token);
        set({ user, token, isAuthenticated: true });
    },

    setUser: (user) => {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        }
        set({ user });
    },

    logout: () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('rememberedEmail');
        set({ user: null, token: null, isAuthenticated: false, rememberMe: false });
    },

    setRememberMe: (value: boolean) => {
        localStorage.setItem('rememberMe', value.toString());
        set({ rememberMe: value });
    },

    refreshAccessToken: async () => {
        const refreshToken = localStorage.getItem('refreshToken');

        if (!refreshToken) {
            return false;
        }

        try {
            const response = await api.post('/auth/refresh-token', { refreshToken });
            const { token, user } = response.data;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            set({ token, user, isAuthenticated: true });

            return true;
        } catch (error) {
            // Refresh token expired or invalid
            get().logout();
            return false;
        }
    },
}));
