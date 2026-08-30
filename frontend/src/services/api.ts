import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { useUpgradeStore } from '../stores/upgradeStore';
import type { QuotaExceededInfo } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - add auth token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - handle errors and token refresh
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Plan/quota limit hit — surface the upgrade modal instead of a generic error toast.
        if (error.response?.status === 402) {
            const body = error.response.data as Partial<QuotaExceededInfo> | undefined;
            useUpgradeStore.getState().open({
                message: body?.message || 'Planınızın kotasını doldurdunuz.',
                errorCode: 'QUOTA_EXCEEDED',
                metric: body?.metric,
                featureCode: body?.featureCode,
                limit: body?.limit,
                current: body?.current,
                upgradeUrl: body?.upgradeUrl || '/app/billing',
            });
            return Promise.reject(error);
        }

        // If 401 and not already retrying, try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (refreshToken) {
                    const response = await axios.post(`${API_URL}/api/auth/refresh`, {
                        refreshToken,
                    });

                    const { accessToken, refreshToken: newRefreshToken } = response.data.data;
                    localStorage.setItem('accessToken', accessToken);
                    localStorage.setItem('refreshToken', newRefreshToken);

                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                // Refresh failed, clear tokens and redirect to login
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
