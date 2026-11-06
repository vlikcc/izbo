import api from './api';
import type { ApiResponse, PagedResponse } from '../types';
import type {
    AssessmentDetail,
    AssessmentSummary,
    Attempt,
    AttemptReport,
    AttemptSummary,
    BankQuestion,
    Mastery,
    QuestionAsset,
    QuestionDifficulty,
    QuestionImportResult,
    QuestionListQuery,
    SaveAssessmentRequest,
    SaveBankQuestionRequest,
    SectionInput,
} from '../types/assessment';
import { API_URL } from '../config';

const API_BASE = API_URL;

function unwrap<T>(response: { data: ApiResponse<T> }, fallback: string): T {
    if (response.data.success && response.data.data !== null && response.data.data !== undefined) {
        return response.data.data;
    }
    throw new Error(response.data.message || fallback);
}

function queryString(params: Record<string, string | number | boolean | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '' && value !== false) search.set(key, String(value));
    }
    const text = search.toString();
    return text ? `?${text}` : '';
}

/** Question bank (authoring), tests and results, and mock exams — ContentService under /api/content. */
export const assessmentService = {
    // ---- Question bank ----
    async listQuestions(query: QuestionListQuery): Promise<PagedResponse<BankQuestion>> {
        return unwrap(await api.get<ApiResponse<PagedResponse<BankQuestion>>>(
            `/api/content/questions${queryString({ ...query })}`), 'Sorular yüklenemedi');
    },

    async getQuestion(id: string): Promise<BankQuestion> {
        return unwrap(await api.get<ApiResponse<BankQuestion>>(`/api/content/questions/${id}`), 'Soru yüklenemedi');
    },

    async createQuestion(data: SaveBankQuestionRequest): Promise<BankQuestion> {
        return unwrap(await api.post<ApiResponse<BankQuestion>>('/api/content/questions', data), 'Soru kaydedilemedi');
    },

    async updateQuestion(id: string, data: SaveBankQuestionRequest): Promise<BankQuestion> {
        return unwrap(await api.put<ApiResponse<BankQuestion>>(`/api/content/questions/${id}`, data), 'Soru kaydedilemedi');
    },

    async deleteQuestion(id: string): Promise<void> {
        unwrap(await api.delete<ApiResponse<boolean>>(`/api/content/questions/${id}`), 'Soru silinemedi');
    },

    async submitQuestion(id: string): Promise<BankQuestion> {
        return unwrap(await api.post<ApiResponse<BankQuestion>>(`/api/content/questions/${id}/submit`), 'Onaya gönderilemedi');
    },

    async reviewQuestion(id: string, approve: boolean, note?: string): Promise<BankQuestion> {
        return unwrap(await api.post<ApiResponse<BankQuestion>>(`/api/content/questions/${id}/review`, { approve, note }), 'Karar kaydedilemedi');
    },

    async publishQuestion(id: string): Promise<BankQuestion> {
        return unwrap(await api.post<ApiResponse<BankQuestion>>(`/api/content/questions/${id}/publish`), 'Yayınlanamadı');
    },

    async unpublishQuestion(id: string): Promise<BankQuestion> {
        return unwrap(await api.post<ApiResponse<BankQuestion>>(`/api/content/questions/${id}/unpublish`), 'Yayından kaldırılamadı');
    },

    async getQuestionReviewQueue(page = 1, pageSize = 50): Promise<PagedResponse<BankQuestion>> {
        return unwrap(await api.get<ApiResponse<PagedResponse<BankQuestion>>>(
            `/api/content/questions/review-queue?page=${page}&pageSize=${pageSize}`), 'Onay kuyruğu yüklenemedi');
    },

    async uploadQuestionImage(file: File): Promise<QuestionAsset> {
        const form = new FormData();
        form.append('file', file, file.name);
        return unwrap(await api.post<ApiResponse<QuestionAsset>>('/api/content/questions/assets', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }), 'Görsel yüklenemedi');
    },

    /** Question images are public by their random id, so a plain <img> can show them. */
    assetUrl(id: string): string {
        return `${API_BASE}/api/content/public/question-assets/${id}`;
    },

    /** Like the curriculum import: an invalid file comes back as 400 with its row errors, returned rather than thrown. */
    async importQuestions(file: File, dryRun: boolean): Promise<QuestionImportResult> {
        const form = new FormData();
        form.append('file', file, file.name);
        try {
            return unwrap(await api.post<ApiResponse<QuestionImportResult>>(
                `/api/content/questions/import?dryRun=${dryRun}`, form,
                { headers: { 'Content-Type': 'multipart/form-data' } }), 'İçe aktarma başarısız');
        } catch (error) {
            const body = (error as { response?: { data?: ApiResponse<QuestionImportResult> } }).response?.data;
            if (body?.data) return body.data;
            throw error;
        }
    },

    // ---- Taking tests ----
    async startPractice(target: { topicId?: string; unitId?: string }, count?: number): Promise<Attempt> {
        return unwrap(await api.post<ApiResponse<Attempt>>('/api/content/practice', {
            topicId: target.topicId ?? null,
            unitId: target.unitId ?? null,
            count: count ?? null,
        }), 'Test başlatılamadı');
    },

    async startAssessment(id: string): Promise<Attempt> {
        return unwrap(await api.post<ApiResponse<Attempt>>(`/api/content/assessments/${id}/start`), 'Sınav başlatılamadı');
    },

    async getAttempt(id: string): Promise<Attempt> {
        return unwrap(await api.get<ApiResponse<Attempt>>(`/api/content/attempts/${id}`), 'Test yüklenemedi');
    },

    async saveAnswer(id: string, order: number, selectedKey: string | null): Promise<void> {
        unwrap(await api.put<ApiResponse<boolean>>(`/api/content/attempts/${id}/answers/${order}`, { selectedKey }), 'Cevap kaydedilemedi');
    },

    async submitAttempt(id: string): Promise<AttemptSummary> {
        return unwrap(await api.post<ApiResponse<AttemptSummary>>(`/api/content/attempts/${id}/submit`), 'Test bitirilemedi');
    },

    async getReport(id: string): Promise<AttemptReport> {
        return unwrap(await api.get<ApiResponse<AttemptReport>>(`/api/content/attempts/${id}/report`), 'Sonuç yüklenemedi');
    },

    async getMyAttempts(take = 20): Promise<AttemptSummary[]> {
        return unwrap(await api.get<ApiResponse<AttemptSummary[]>>(`/api/content/attempts/me?take=${take}`), 'Testler yüklenemedi');
    },

    async getStudentAttempts(studentId: string, take = 10): Promise<AttemptSummary[]> {
        return unwrap(await api.get<ApiResponse<AttemptSummary[]>>(`/api/content/attempts/student/${studentId}?take=${take}`), 'Testler yüklenemedi');
    },

    async getMyMastery(subjectId?: string, days = 90): Promise<Mastery> {
        return unwrap(await api.get<ApiResponse<Mastery>>(
            `/api/content/mastery/me${queryString({ subjectId, days })}`), 'Başarı özeti yüklenemedi');
    },

    async getStudentMastery(studentId: string, days = 90): Promise<Mastery> {
        return unwrap(await api.get<ApiResponse<Mastery>>(`/api/content/mastery/student/${studentId}?days=${days}`), 'Başarı özeti yüklenemedi');
    },

    // ---- Mock exams and placement tests ----
    async listAssessments(levelSlugs: string[]): Promise<AssessmentSummary[]> {
        return unwrap(await api.get<ApiResponse<AssessmentSummary[]>>(
            `/api/content/assessments${queryString({ levels: levelSlugs.join(',') })}`), 'Denemeler yüklenemedi');
    },

    async listAllAssessments(page = 1, pageSize = 50): Promise<PagedResponse<AssessmentSummary>> {
        return unwrap(await api.get<ApiResponse<PagedResponse<AssessmentSummary>>>(
            `/api/content/assessments/admin?page=${page}&pageSize=${pageSize}`), 'Denemeler yüklenemedi');
    },

    async getAssessmentDetail(id: string): Promise<AssessmentDetail> {
        return unwrap(await api.get<ApiResponse<AssessmentDetail>>(`/api/content/assessments/${id}/admin`), 'Sınav yüklenemedi');
    },

    async createAssessment(data: SaveAssessmentRequest): Promise<AssessmentDetail> {
        return unwrap(await api.post<ApiResponse<AssessmentDetail>>('/api/content/assessments', data), 'Sınav oluşturulamadı');
    },

    async updateAssessment(id: string, data: SaveAssessmentRequest): Promise<AssessmentDetail> {
        return unwrap(await api.put<ApiResponse<AssessmentDetail>>(`/api/content/assessments/${id}`, data), 'Sınav kaydedilemedi');
    },

    async saveSections(id: string, sections: SectionInput[]): Promise<AssessmentDetail> {
        return unwrap(await api.put<ApiResponse<AssessmentDetail>>(`/api/content/assessments/${id}/sections`, { sections }), 'Sorular kaydedilemedi');
    },

    async publishAssessment(id: string): Promise<AssessmentDetail> {
        return unwrap(await api.post<ApiResponse<AssessmentDetail>>(`/api/content/assessments/${id}/publish`), 'Yayınlanamadı');
    },

    async unpublishAssessment(id: string): Promise<AssessmentDetail> {
        return unwrap(await api.post<ApiResponse<AssessmentDetail>>(`/api/content/assessments/${id}/unpublish`), 'Yayından kaldırılamadı');
    },

    async deleteAssessment(id: string): Promise<void> {
        unwrap(await api.delete<ApiResponse<boolean>>(`/api/content/assessments/${id}`), 'Sınav silinemedi');
    },

    async suggestQuestions(topicIds: string[], count: number, exclude: string[], difficulty?: QuestionDifficulty): Promise<string[]> {
        return unwrap(await api.post<ApiResponse<string[]>>('/api/content/assessments/suggest-questions', {
            topicIds, count, exclude, difficulty: difficulty ?? null,
        }), 'Soru önerilemedi');
    },
};

export default assessmentService;
