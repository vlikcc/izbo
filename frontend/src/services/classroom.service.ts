import api from './api';
import type { ApiResponse, PagedResponse, Classroom, ClassSession, Enrollment } from '../types';

export interface Announcement {
    id: string;
    classroomId: string;
    authorId: string;
    title: string;
    body: string;
    createdAt: string;
}

export interface ClassroomComment {
    id: string;
    classroomId: string;
    targetType: string;
    targetId: string;
    authorId: string;
    body: string;
    createdAt: string;
}

export interface AttendanceRecord {
    id: string;
    sessionId: string;
    userId: string;
    joinedAt: string;
    leftAt?: string;
}

export const classroomService = {
    async getClassrooms(page = 1, pageSize = 20): Promise<PagedResponse<Classroom>> {
        const response = await api.get<ApiResponse<PagedResponse<Classroom>>>(`/api/classrooms?page=${page}&pageSize=${pageSize}`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to fetch classrooms');
    },

    async getMyClassrooms(page = 1, pageSize = 20): Promise<PagedResponse<Classroom>> {
        const response = await api.get<ApiResponse<PagedResponse<Classroom>>>(`/api/classrooms/my-classrooms?page=${page}&pageSize=${pageSize}`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to fetch classrooms');
    },

    async getClassroom(id: string): Promise<Classroom> {
        const response = await api.get<ApiResponse<Classroom>>(`/api/classrooms/${id}`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Classroom not found');
    },

    async createClassroom(data: { name: string; description: string; coverImageUrl?: string }): Promise<Classroom> {
        const response = await api.post<ApiResponse<Classroom>>('/api/classrooms', data);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to create classroom');
    },

    async updateClassroom(id: string, data: { name?: string; description?: string; coverImageUrl?: string }): Promise<Classroom> {
        const response = await api.put<ApiResponse<Classroom>>(`/api/classrooms/${id}`, data);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to update classroom');
    },

    async deleteClassroom(id: string): Promise<void> {
        const response = await api.delete<ApiResponse<boolean>>(`/api/classrooms/${id}`);
        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to delete classroom');
        }
    },

    async getEnrollments(classroomId: string): Promise<Enrollment[]> {
        const response = await api.get<ApiResponse<Enrollment[]>>(`/api/classrooms/${classroomId}/enrollments`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to fetch enrollments');
    },

    async getSessions(classroomId: string): Promise<ClassSession[]> {
        const response = await api.get<ApiResponse<ClassSession[]>>(`/api/classrooms/${classroomId}/sessions`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to fetch sessions');
    },

    async getUpcomingSessions(): Promise<ClassSession[]> {
        const response = await api.get<ApiResponse<ClassSession[]>>('/api/classrooms/sessions/upcoming');
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to fetch sessions');
    },

    async getSession(sessionId: string): Promise<ClassSession> {
        const response = await api.get<ApiResponse<ClassSession>>(`/api/classrooms/sessions/${sessionId}`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Session not found');
    },

    async enrollStudent(classroomId: string, studentId: string): Promise<void> {
        const response = await api.post<ApiResponse<boolean>>(`/api/classrooms/${classroomId}/enroll`, { studentId });
        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to enroll student');
        }
    },

    async getSessionToken(sessionId: string): Promise<string> {
        const response = await api.get<ApiResponse<string>>(`/api/classrooms/sessions/${sessionId}/token`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return '';
    },

    async getAnnouncements(classroomId: string): Promise<Announcement[]> {
        const response = await api.get<ApiResponse<Announcement[]>>(`/api/classrooms/${classroomId}/announcements`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return [];
    },

    async createAnnouncement(classroomId: string, data: { title: string; body: string }): Promise<Announcement> {
        const response = await api.post<ApiResponse<Announcement>>(`/api/classrooms/${classroomId}/announcements`, data);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Duyuru oluşturulamadı');
    },

    async deleteAnnouncement(classroomId: string, announcementId: string): Promise<void> {
        const response = await api.delete<ApiResponse<boolean>>(`/api/classrooms/${classroomId}/announcements/${announcementId}`);
        if (!response.data.success) {
            throw new Error(response.data.message || 'Duyuru silinemedi');
        }
    },

    async getComments(classroomId: string, targetType: string, targetId: string): Promise<ClassroomComment[]> {
        const params = new URLSearchParams({ targetType, targetId });
        const response = await api.get<ApiResponse<ClassroomComment[]>>(`/api/classrooms/${classroomId}/comments?${params}`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return [];
    },

    async addComment(classroomId: string, data: { targetType: string; targetId: string; body: string }): Promise<ClassroomComment> {
        const response = await api.post<ApiResponse<ClassroomComment>>(`/api/classrooms/${classroomId}/comments`, data);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Yorum eklenemedi');
    },

    async getAttendance(sessionId: string): Promise<AttendanceRecord[]> {
        const response = await api.get<ApiResponse<AttendanceRecord[]>>(`/api/classrooms/sessions/${sessionId}/attendance`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return [];
    },
};

export default classroomService;
