import axios from 'axios';
import type { ApiResponse, AuthResponse, Classroom, ClassSession, ClassroomStudent, Homework, Submission, Exam, Question, ExamSession, StartExamResponse, ExamResult, PagedResponse, Announcement, Message, Conversation, Quiz } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for adding auth token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor for handling token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

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
            } catch {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

// Auth API
export const authApi = {
    register: (data: { email: string; password: string; firstName: string; lastName: string; phoneNumber?: string; role?: string }) =>
        api.post<ApiResponse<AuthResponse>>('/api/auth/register', data),

    login: (data: { email: string; password: string }) =>
        api.post<ApiResponse<AuthResponse>>('/api/auth/login', data),

    logout: (refreshToken: string) =>
        api.post<ApiResponse<boolean>>('/api/auth/logout', { refreshToken }),

    me: () =>
        api.get<ApiResponse<{ userId: string; email: string; role: string; firstName: string; lastName: string }>>('/api/auth/me'),

    verifyEmail: (token: string) =>
        api.post<ApiResponse<boolean>>('/api/auth/verify-email', { token }),

    resendVerification: (email: string) =>
        api.post<ApiResponse<boolean>>('/api/auth/resend-verification', { email }),

    forgotPassword: (email: string) =>
        api.post<ApiResponse<boolean>>('/api/auth/forgot-password', { email }),

    resetPassword: (data: { token: string; newPassword: string }) =>
        api.post<ApiResponse<boolean>>('/api/auth/reset-password', data),
};

// Classroom API
export const classroomApi = {
    getAll: (page = 1, pageSize = 20) =>
        api.get<ApiResponse<PagedResponse<Classroom>>>(`/api/classrooms?page=${page}&pageSize=${pageSize}`),

    getMyClassrooms: (page = 1, pageSize = 20) =>
        api.get<ApiResponse<PagedResponse<Classroom>>>(`/api/classrooms/my-classrooms?page=${page}&pageSize=${pageSize}`),

    get: (id: string) =>
        api.get<ApiResponse<Classroom>>(`/api/classrooms/${id}`),

    create: (data: { name: string; description: string; coverImageUrl?: string }) =>
        api.post<ApiResponse<Classroom>>('/api/classrooms', data),

    update: (id: string, data: { name?: string; description?: string; coverImageUrl?: string }) =>
        api.put<ApiResponse<Classroom>>(`/api/classrooms/${id}`, data),

    delete: (id: string) =>
        api.delete<ApiResponse<boolean>>(`/api/classrooms/${id}`),

    getSessions: (classroomId: string) =>
        api.get<ApiResponse<ClassSession[]>>(`/api/classrooms/${classroomId}/sessions`),

    createSession: (classroomId: string, data: { title: string; description?: string; scheduledStartTime: string; scheduledEndTime: string }) =>
        api.post<ApiResponse<ClassSession>>(`/api/classrooms/${classroomId}/sessions`, data),

    startSession: (sessionId: string) =>
        api.post<ApiResponse<boolean>>(`/api/classrooms/sessions/${sessionId}/start`),

    endSession: (sessionId: string) =>
        api.post<ApiResponse<boolean>>(`/api/classrooms/sessions/${sessionId}/end`),

    getUpcomingSessions: () =>
        api.get<ApiResponse<ClassSession[]>>('/api/classrooms/sessions/upcoming'),

    getLiveSessions: () =>
        api.get<ApiResponse<ClassSession[]>>('/api/classrooms/sessions/live'),

    // Student management
    getStudents: (classroomId: string) =>
        api.get<ApiResponse<ClassroomStudent[]>>(`/api/classrooms/${classroomId}/students`),

    generateInviteCode: (classroomId: string) =>
        api.post<ApiResponse<{ inviteCode: string }>>(`/api/classrooms/${classroomId}/invite-code`),

    joinByCode: (inviteCode: string) =>
        api.post<ApiResponse<Classroom>>(`/api/classrooms/join/${inviteCode}`),

    removeStudent: (classroomId: string, studentId: string) =>
        api.delete<ApiResponse<boolean>>(`/api/classrooms/${classroomId}/students/${studentId}`),

    addStudentByEmail: (classroomId: string, email: string) =>
        api.post<ApiResponse<ClassroomStudent>>(`/api/classrooms/${classroomId}/students`, { email }),

    addStudentsBulk: (classroomId: string, emails: string[]) =>
        api.post<ApiResponse<{ added: number; failed: string[] }>>(`/api/classrooms/${classroomId}/students/bulk`, { emails }),
};

// Homework API
export const homeworkApi = {
    getAll: (classroomId?: string, page = 1, pageSize = 20) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (classroomId) params.append('classroomId', classroomId);
        return api.get<ApiResponse<PagedResponse<Homework>>>(`/api/homework?${params}`);
    },

    get: (id: string) =>
        api.get<ApiResponse<Homework>>(`/api/homework/${id}`),

    create: (data: { classroomId: string; title: string; description: string; attachmentUrl?: string; maxScore: number; dueDate: string; allowLateSubmission: boolean; latePenaltyPercent: number }) =>
        api.post<ApiResponse<Homework>>('/api/homework', data),

    update: (id: string, data: Partial<{ title: string; description: string; attachmentUrl: string; maxScore: number; dueDate: string; allowLateSubmission: boolean; latePenaltyPercent: number }>) =>
        api.put<ApiResponse<Homework>>(`/api/homework/${id}`, data),

    delete: (id: string) =>
        api.delete<ApiResponse<boolean>>(`/api/homework/${id}`),

    submit: (homeworkId: string, data: { content?: string; fileUrl?: string }) =>
        api.post<ApiResponse<Submission>>(`/api/homework/${homeworkId}/submit`, data),

    getMySubmission: (homeworkId: string) =>
        api.get<ApiResponse<Submission>>(`/api/homework/${homeworkId}/my-submission`),

    getSubmissions: (homeworkId: string) =>
        api.get<ApiResponse<Submission[]>>(`/api/homework/${homeworkId}/submissions`),

    grade: (submissionId: string, data: { score: number; feedback?: string }) =>
        api.post<ApiResponse<Submission>>(`/api/homework/submissions/${submissionId}/grade`, data),
};

// Exam API
export const examApi = {
    getAll: (classroomId?: string, page = 1, pageSize = 20) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (classroomId) params.append('classroomId', classroomId);
        return api.get<ApiResponse<PagedResponse<Exam>>>(`/api/exams?${params}`);
    },

    get: (id: string) =>
        api.get<ApiResponse<Exam>>(`/api/exams/${id}`),

    create: (data: { classroomId: string; title: string; description?: string; durationMinutes: number; startTime: string; endTime: string; shuffleQuestions: boolean; shuffleOptions: boolean; showResults: boolean; passingScore?: number }) =>
        api.post<ApiResponse<Exam>>('/api/exams', data),

    update: (id: string, data: Partial<{ title: string; description: string; durationMinutes: number; startTime: string; endTime: string; shuffleQuestions: boolean; shuffleOptions: boolean; showResults: boolean; passingScore: number }>) =>
        api.put<ApiResponse<Exam>>(`/api/exams/${id}`, data),

    delete: (id: string) =>
        api.delete<ApiResponse<boolean>>(`/api/exams/${id}`),

    publish: (id: string) =>
        api.post<ApiResponse<boolean>>(`/api/exams/${id}/publish`),

    getQuestions: (examId: string) =>
        api.get<ApiResponse<Question[]>>(`/api/exams/${examId}/questions`),

    addQuestion: (examId: string, data: { orderIndex: number; type: string; content: string; imageUrl?: string; options?: string[]; correctAnswer?: string; points: number; explanation?: string }) =>
        api.post<ApiResponse<Question>>(`/api/exams/${examId}/questions`, data),

    // Exam session
    startExam: (examId: string) =>
        api.post<ApiResponse<StartExamResponse>>(`/api/exam-sessions/start/${examId}`),

    saveAnswer: (sessionId: string, data: { questionId: string; answer: string }) =>
        api.post<ApiResponse<boolean>>(`/api/exam-sessions/${sessionId}/answer`, data),

    submitExam: (sessionId: string) =>
        api.post<ApiResponse<ExamResult>>(`/api/exam-sessions/${sessionId}/submit`),

    getSession: (sessionId: string) =>
        api.get<ApiResponse<ExamSession>>(`/api/exam-sessions/${sessionId}`),

    getMySessions: () =>
        api.get<ApiResponse<ExamSession[]>>('/api/exam-sessions/my-sessions'),

    getResult: (sessionId: string) =>
        api.get<ApiResponse<ExamResult>>(`/api/exam-sessions/${sessionId}/result`),
};

// Announcement API
export const announcementApi = {
    getAll: (classroomId?: string, page = 1, pageSize = 20) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (classroomId) params.append('classroomId', classroomId);
        return api.get<ApiResponse<PagedResponse<Announcement>>>(`/api/announcements?${params}`);
    },

    get: (id: string) =>
        api.get<ApiResponse<Announcement>>(`/api/announcements/${id}`),

    create: (data: { classroomId: string; title: string; content: string; isPinned?: boolean }) =>
        api.post<ApiResponse<Announcement>>('/api/announcements', data),

    update: (id: string, data: { title?: string; content?: string; isPinned?: boolean }) =>
        api.put<ApiResponse<Announcement>>(`/api/announcements/${id}`, data),

    delete: (id: string) =>
        api.delete<ApiResponse<boolean>>(`/api/announcements/${id}`),

    togglePin: (id: string) =>
        api.post<ApiResponse<boolean>>(`/api/announcements/${id}/toggle-pin`),
};

// Message API
export const messageApi = {
    getConversations: () =>
        api.get<ApiResponse<Conversation[]>>('/api/messages/conversations'),

    getMessages: (conversationId: string, page = 1, pageSize = 50) =>
        api.get<ApiResponse<PagedResponse<Message>>>(`/api/messages/conversations/${conversationId}?page=${page}&pageSize=${pageSize}`),

    sendMessage: (conversationId: string, content: string) =>
        api.post<ApiResponse<Message>>(`/api/messages/conversations/${conversationId}`, { content }),

    createConversation: (data: { type: 'Direct' | 'Group'; participantIds: string[]; name?: string }) =>
        api.post<ApiResponse<Conversation>>('/api/messages/conversations', data),

    markAsRead: (conversationId: string) =>
        api.post<ApiResponse<boolean>>(`/api/messages/conversations/${conversationId}/read`),

    sendDirect: (userId: string, content: string) =>
        api.post<ApiResponse<Message>>(`/api/messages/direct/${userId}`, { content }),
};

// Quiz API
export const quizApi = {
    getAll: (classroomId: string) =>
        api.get<ApiResponse<Quiz[]>>(`/api/quizzes?classroomId=${classroomId}`),

    get: (id: string) =>
        api.get<ApiResponse<Quiz>>(`/api/quizzes/${id}`),

    create: (data: { classroomId: string; title: string; type: 'Poll' | 'Attendance' | 'Quiz'; options?: string[]; expiresInMinutes?: number }) =>
        api.post<ApiResponse<Quiz>>('/api/quizzes', data),

    respond: (quizId: string, optionIndex: number) =>
        api.post<ApiResponse<boolean>>(`/api/quizzes/${quizId}/respond`, { optionIndex }),

    close: (id: string) =>
        api.post<ApiResponse<boolean>>(`/api/quizzes/${id}/close`),

    delete: (id: string) =>
        api.delete<ApiResponse<boolean>>(`/api/quizzes/${id}`),
};

// File API
export const fileApi = {
    upload: (file: File, onProgress?: (progress: number) => void) => {
        const formData = new FormData();
        formData.append('file', file);

        return api.post<ApiResponse<{ fileId: string; url: string; fileName: string; fileSize: number }>>('/api/files/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(progress);
                }
            },
        });
    },

    uploadMultiple: (files: File[], onProgress?: (progress: number) => void) => {
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));

        return api.post<ApiResponse<{ files: { fileId: string; url: string; fileName: string; fileSize: number }[] }>>('/api/files/upload-multiple', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(progress);
                }
            },
        });
    },

    delete: (fileId: string) =>
        api.delete<ApiResponse<boolean>>(`/api/files/${fileId}`),

    get: (fileId: string) =>
        api.get<ApiResponse<{ fileId: string; url: string; fileName: string; fileSize: number; contentType: string }>>(`/api/files/${fileId}`),
};

export default api;
