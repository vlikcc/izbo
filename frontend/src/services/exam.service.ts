import api from './api';
import type { ApiResponse, PagedResponse, Exam, ExamSession, CreateExamRequest, Question, CreateQuestionRequest, UpdateQuestionRequest } from '../types';
import type { ExamResult, StartExamResponse } from '../types/examSession';

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

    async createExam(data: CreateExamRequest): Promise<Exam> {
        const response = await api.post<ApiResponse<Exam>>('/api/exams', data);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to create exam');
    },

    async getExam(id: string): Promise<Exam> {
        const response = await api.get<ApiResponse<Exam>>(`/api/exams/${id}`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Exam not found');
    },

    async deleteExam(id: string): Promise<void> {
        const response = await api.delete<ApiResponse<boolean>>(`/api/exams/${id}`);
        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to delete exam');
        }
    },

    async publishExam(id: string): Promise<void> {
        const response = await api.post<ApiResponse<boolean>>(`/api/exams/${id}/publish`);
        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to publish exam');
        }
    },

    // Question methods
    async getQuestions(examId: string): Promise<Question[]> {
        const response = await api.get<ApiResponse<Question[]>>(`/api/exams/${examId}/questions`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return [];
    },

    async addQuestion(examId: string, data: CreateQuestionRequest): Promise<Question> {
        const response = await api.post<ApiResponse<Question>>(`/api/exams/${examId}/questions`, data);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to add question');
    },

    async updateQuestion(questionId: string, data: UpdateQuestionRequest): Promise<void> {
        const response = await api.put<ApiResponse<boolean>>(`/api/exams/questions/${questionId}`, data);
        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to update question');
        }
    },

    async deleteQuestion(questionId: string): Promise<void> {
        const response = await api.delete<ApiResponse<boolean>>(`/api/exams/questions/${questionId}`);
        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to delete question');
        }
    },

    // Exam session methods
    async getMyExamSessions(): Promise<ExamSession[]> {
        const response = await api.get<ApiResponse<ExamSession[]>>('/api/exam-sessions/my-sessions');
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return [];
    },

    async startExam(examId: string): Promise<StartExamResponse> {
        const response = await api.post<ApiResponse<StartExamResponse>>(`/api/exam-sessions/${examId}/start`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Sınav başlatılamadı');
    },

    async saveAnswer(sessionId: string, questionId: string, answer: string): Promise<void> {
        const response = await api.post<ApiResponse<boolean>>(`/api/exam-sessions/${sessionId}/answer`, {
            questionId,
            answer,
        });
        if (!response.data.success) {
            throw new Error(response.data.message || 'Cevap kaydedilemedi');
        }
    },

    async submitExam(sessionId: string): Promise<ExamResult> {
        const response = await api.post<ApiResponse<ExamResult>>(`/api/exam-sessions/${sessionId}/submit`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Sınav teslim edilemedi');
    },

    async getExamSessions(examId: string): Promise<ExamSession[]> {
        const response = await api.get<ApiResponse<ExamSession[]>>(`/api/exam-sessions/exam/${examId}`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return [];
    },

    async getResult(sessionId: string): Promise<ExamResult> {
        const response = await api.get<ApiResponse<ExamResult>>(`/api/exam-sessions/${sessionId}/result`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Sonuç bulunamadı');
    },
};

export default examService;
