import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Flag to prevent multiple redirects
let isRedirecting = false;

// Response interceptor to handle authentication errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // Try to refresh the token first
            const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

            if (refreshToken && !isRedirecting) {
                try {
                    const response = await axios.post(
                        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/auth/refresh-token`,
                        { refreshToken }
                    );

                    const { token } = response.data;
                    localStorage.setItem('token', token);
                    originalRequest.headers.Authorization = `Bearer ${token}`;

                    return api(originalRequest);
                } catch (refreshError) {
                    // Refresh failed, redirect to login
                }
            }

            // No refresh token or refresh failed - redirect to login
            if (typeof window !== 'undefined' && !isRedirecting) {
                const isRegisterPage = window.location.pathname === '/register';
                if (!isRegisterPage) {
                    isRedirecting = true;
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    localStorage.removeItem('refreshToken');
                    window.location.href = '/login?expired=true';
                }
            }
        }

        return Promise.reject(error);
    }
);

export default api;
