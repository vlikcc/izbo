import api from './api';
import type {
    ApiResponse,
    Child,
    Classroom,
    ClassSession,
    CreateChildRequest,
    ExamSession,
    GuardianCode,
    Homework,
    PagedResponse,
    PublicUser,
    Submission,
} from '../types';

export interface StudentHomework {
    homework: Homework;
    submission: Submission | null;
}

function unwrap<T>(response: { data: ApiResponse<T> }, fallback: string): T {
    if (response.data.success && response.data.data !== null && response.data.data !== undefined) {
        return response.data.data;
    }
    throw new Error(response.data.message || fallback);
}

/** Parent (veli) ↔ student links, and a parent's read-only view of a linked student's progress. */
export const guardianService = {
    async getChildren(): Promise<Child[]> {
        return unwrap(await api.get<ApiResponse<Child[]>>('/api/users/me/children'), 'Çocuk hesapları yüklenemedi');
    },

    async createChild(data: CreateChildRequest): Promise<Child> {
        return unwrap(await api.post<ApiResponse<Child>>('/api/users/me/children', data), 'Çocuk hesabı oluşturulamadı');
    },

    async linkChild(code: string): Promise<Child> {
        return unwrap(await api.post<ApiResponse<Child>>('/api/users/me/children/link', { code }), 'Kod geçersiz');
    },

    async resetChildPassword(childId: string, password: string): Promise<void> {
        unwrap(await api.post<ApiResponse<boolean>>(`/api/users/me/children/${childId}/password`, { password }), 'Şifre değiştirilemedi');
    },

    async unlinkChild(childId: string): Promise<void> {
        unwrap(await api.delete<ApiResponse<boolean>>(`/api/users/me/children/${childId}`), 'Bağlantı kaldırılamadı');
    },

    /** Students only: a one-time code a parent types to link to this account. */
    async issueGuardianCode(): Promise<GuardianCode> {
        return unwrap(await api.post<ApiResponse<GuardianCode>>('/api/users/me/guardian-code'), 'Kod oluşturulamadı');
    },

    /** Students only: the parents linked to this account. */
    async getGuardians(): Promise<PublicUser[]> {
        return unwrap(await api.get<ApiResponse<PublicUser[]>>('/api/users/me/guardians'), 'Veliler yüklenemedi');
    },

    async getChildClassrooms(childId: string): Promise<Classroom[]> {
        const page = unwrap(
            await api.get<ApiResponse<PagedResponse<Classroom>>>(`/api/classrooms/student/${childId}?pageSize=50`),
            'Sınıflar yüklenemedi');
        return page.items;
    },

    async getChildUpcomingSessions(childId: string): Promise<ClassSession[]> {
        return unwrap(
            await api.get<ApiResponse<ClassSession[]>>(`/api/classrooms/student/${childId}/sessions/upcoming`),
            'Dersler yüklenemedi');
    },

    async getChildHomework(childId: string): Promise<StudentHomework[]> {
        return unwrap(await api.get<ApiResponse<StudentHomework[]>>(`/api/homework/student/${childId}`), 'Ödevler yüklenemedi');
    },

    async getChildExamSessions(childId: string): Promise<ExamSession[]> {
        return unwrap(await api.get<ApiResponse<ExamSession[]>>(`/api/exam-sessions/student/${childId}`), 'Sınav sonuçları yüklenemedi');
    },
};

export default guardianService;
