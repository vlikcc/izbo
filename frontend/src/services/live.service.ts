import api from './api';
import type { ApiResponse, LiveSession } from '../types';

export const liveService = {
    async getLiveSessions(): Promise<LiveSession[]> {
        const response = await api.get<ApiResponse<LiveSession[]>>('/api/live/sessions');
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return [];
    },

    async getUpcomingSessions(): Promise<LiveSession[]> {
        const response = await api.get<ApiResponse<LiveSession[]>>('/api/classrooms/sessions/upcoming');
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return [];
    },

    async joinSession(sessionId: string): Promise<{ meetingUrl: string }> {
        const response = await api.post<ApiResponse<{ meetingUrl: string }>>(`/api/live/sessions/${sessionId}/join`);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to join session');
    },

    async createSession(data: {
        classroomId: string;
        title: string;
        description?: string;
        scheduledStartTime: string;
        scheduledEndTime: string;
        meetingUrl?: string;
    }): Promise<void> {
        const { classroomId, meetingUrl, ...rest } = data;
        // Backend DTO only accepts: title, description, scheduledStartTime, scheduledEndTime
        // Convert datetime-local format to ISO string for proper backend parsing
        const sessionData = {
            title: rest.title,
            description: rest.description || null,
            scheduledStartTime: new Date(rest.scheduledStartTime).toISOString(),
            scheduledEndTime: new Date(rest.scheduledEndTime).toISOString(),
        };
        const response = await api.post<ApiResponse<unknown>>(`/api/classrooms/${classroomId}/sessions`, sessionData);
        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to create session');
        }
    },
};

export default liveService;
