import api from './api';
import type { ApiResponse, AuthResponse, LoginRequest, RegisterRequest, User } from '../types';

export const authService = {
    async login(data: LoginRequest): Promise<AuthResponse> {
        const response = await api.post<ApiResponse<AuthResponse>>('/api/auth/login', data);
        if (response.data.success && response.data.data) {
            const authData = response.data.data;
            localStorage.setItem('accessToken', authData.accessToken);
            localStorage.setItem('refreshToken', authData.refreshToken);
            return authData;
        }
        throw new Error(response.data.message || 'Login failed');
    },

    async register(data: RegisterRequest): Promise<AuthResponse> {
        const response = await api.post<ApiResponse<AuthResponse>>('/api/auth/register', data);
        if (response.data.success && response.data.data) {
            const authData = response.data.data;
            localStorage.setItem('accessToken', authData.accessToken);
            localStorage.setItem('refreshToken', authData.refreshToken);
            return authData;
        }
        throw new Error(response.data.message || 'Registration failed');
    },

    async logout(): Promise<void> {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                await api.post('/api/auth/logout', { refreshToken });
            }
        } finally {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
        }
    },

    async getCurrentUser(): Promise<User | null> {
        try {
            const response = await api.get<ApiResponse<{ userId: string; email: string; role: string; firstName: string; lastName: string }>>('/api/auth/me');
            if (response.data.success && response.data.data) {
                const userData = response.data.data;
                return {
                    id: userData.userId,
                    email: userData.email,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    role: userData.role as User['role'],
                    isActive: true,
                    createdAt: new Date().toISOString(),
                };
            }
            return null;
        } catch {
            return null;
        }
    },

    isAuthenticated(): boolean {
        return !!localStorage.getItem('accessToken');
    },
};

export default authService;
