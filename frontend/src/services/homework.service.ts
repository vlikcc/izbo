import api from './api';
import type { ApiResponse, PagedResponse, Homework, Submission } from '../types';

export const homeworkService = {
    async getHomeworks(classroomId?: string, page = 1, pageSize = 20): Promise<PagedResponse<Homework>> {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (classroomId) params.append('classroomId', classroomId);

        const response = await api.get<ApiResponse<PagedResponse<Homework>>>(`/api/homework?${params}`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to fetch homework');
    },

    async getHomework(id: string): Promise<Homework> {
        const response = await api.get<ApiResponse<Homework>>(`/api/homework/${id}`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Homework not found');
    },

    async getMySubmissions(): Promise<Submission[]> {
        const response = await api.get<ApiResponse<Submission[]>>('/api/homework/my-submissions');
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return [];
    },

    async submitHomework(homeworkId: string, data: { content?: string; fileUrl?: string }): Promise<Submission> {
        const response = await api.post<ApiResponse<Submission>>(`/api/homework/${homeworkId}/submit`, data);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to submit homework');
    },
};

export default homeworkService;
