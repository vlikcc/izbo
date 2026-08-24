import api from './api';
import type { ApiResponse, User } from '../types';

export const userService = {
    async updateProfile(data: { firstName?: string; lastName?: string; phoneNumber?: string }): Promise<User> {
        const response = await api.put<ApiResponse<User>>('/api/users/me', data);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to update profile');
    },

    async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
        const response = await api.post<ApiResponse<boolean>>('/api/users/change-password', data);
        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to change password');
        }
    },

    async getUsers(page = 1, pageSize = 20, role?: string): Promise<{ items: User[]; totalPages: number; totalCount: number; page: number; pageSize: number }> {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (role) params.append('role', role);
        const response = await api.get<ApiResponse<{ items: User[]; totalPages: number; totalCount: number; page: number; pageSize: number }>>(`/api/users?${params}`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Kullanıcılar yüklenemedi');
    },

    async getStats(): Promise<Record<string, number>> {
        const response = await api.get<ApiResponse<Record<string, number>>>('/api/users/stats');
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return {};
    },

    async setActive(id: string, active: boolean): Promise<void> {
        const path = active ? 'activate' : 'deactivate';
        const response = await api.post<ApiResponse<boolean>>(`/api/users/${id}/${path}`);
        if (!response.data.success) {
            throw new Error(response.data.message || 'Durum güncellenemedi');
        }
    },

    async updateRole(id: string, role: string): Promise<void> {
        const response = await api.put<ApiResponse<boolean>>(`/api/users/${id}/role`, { role });
        if (!response.data.success) {
            throw new Error(response.data.message || 'Rol güncellenemedi');
        }
    },

    async searchUsers(query: string): Promise<User[]> {
        const response = await api.get<ApiResponse<User[]>>(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return [];
    },

    async exportMyData(): Promise<Blob> {
        const response = await api.get('/api/users/me/export', { responseType: 'blob' });
        return response.data as Blob;
    },

    async deleteMyAccount(): Promise<void> {
        const userResponse = await api.delete<ApiResponse<boolean>>('/api/users/me');
        if (!userResponse.data.success) {
            throw new Error(userResponse.data.message || 'Hesap silinemedi');
        }
        await api.delete<ApiResponse<boolean>>('/api/auth/me');
    },
};

export default userService;
