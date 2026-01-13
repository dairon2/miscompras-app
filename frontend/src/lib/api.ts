import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
console.log("[DEBUG] API Base URL:", baseURL);

const api = axios.create({
    baseURL,
    // Don't set Content-Type here - let it be set per-request or automatically for FormData
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Only set Content-Type to JSON if NOT sending FormData
    // FormData needs the browser to set 'multipart/form-data' with boundary automatically
    if (!(config.data instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
    }
    // For FormData, do NOT set Content-Type - browser will handle it

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
