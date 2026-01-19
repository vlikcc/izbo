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
};

export default userService;
