import api from './api';
import type { ApiResponse, PagedResponse, Exam, ExamSession } from '../types';

export const examService = {
    async getExams(classroomId?: string, page = 1, pageSize = 20): Promise<PagedResponse<Exam>> {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (classroomId) params.append('classroomId', classroomId);

        const response = await api.get<ApiResponse<PagedResponse<Exam>>>(`/api/exams?${params}`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to fetch exams');
    },

    async getExam(id: string): Promise<Exam> {
        const response = await api.get<ApiResponse<Exam>>(`/api/exams/${id}`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Exam not found');
    },

    async getMyExamSessions(): Promise<ExamSession[]> {
        const response = await api.get<ApiResponse<ExamSession[]>>('/api/exam-sessions/my-sessions');
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return [];
    },

    async startExam(examId: string): Promise<{ sessionId: string; expiresAt: string }> {
        const response = await api.post<ApiResponse<{ sessionId: string; expiresAt: string }>>(`/api/exam-sessions/${examId}/start`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to start exam');
    },
};

export default examService;
