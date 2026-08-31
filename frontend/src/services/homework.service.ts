import axios from 'axios';
import api from './api';
import type { ApiResponse, PagedResponse, Homework, Submission, CreateHomeworkRequest } from '../types';

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

    async createHomework(data: CreateHomeworkRequest): Promise<Homework> {
        const response = await api.post<ApiResponse<Homework>>('/api/homework', data);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Ödev oluşturulamadı');
    },

    async getHomework(id: string): Promise<Homework> {
        const response = await api.get<ApiResponse<Homework>>(`/api/homework/${id}`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Homework not found');
    },

    async submitHomework(homeworkId: string, data: { content?: string; fileUrl?: string }): Promise<Submission> {
        const response = await api.post<ApiResponse<Submission>>(`/api/homework/${homeworkId}/submit`, data);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Ödev teslim edilemedi');
    },

    async getMySubmission(homeworkId: string): Promise<Submission | null> {
        try {
            const response = await api.get<ApiResponse<Submission>>(`/api/homework/${homeworkId}/my-submission`);
            if (response.data.success) {
                return response.data.data;
            }
            return null;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    },

    async getSubmissions(homeworkId: string): Promise<Submission[]> {
        const response = await api.get<ApiResponse<Submission[]>>(`/api/homework/${homeworkId}/submissions`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return [];
    },

    async gradeSubmission(submissionId: string, score: number, feedback?: string): Promise<Submission> {
        const response = await api.post<ApiResponse<Submission>>(`/api/homework/submissions/${submissionId}/grade`, {
            score,
            feedback,
        });
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Notlandırılamadı');
    },
};

export default homeworkService;
