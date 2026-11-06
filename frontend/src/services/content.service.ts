import api from './api';
import type { ApiResponse, PagedResponse } from '../types';
import type {
    ContentItem,
    ContentItemSummary,
    ContentProgress,
    ContinueWatching,
    CreateContentItemRequest,
    CurriculumImportResult,
    LearningOutcome,
    Level,
    StudentContentActivity,
    Subject,
    SubjectTree,
    TopicDetail,
} from '../types/content';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:5050';

function unwrap<T>(response: { data: ApiResponse<T> }, fallback: string): T {
    if (response.data.success && response.data.data !== null && response.data.data !== undefined) {
        return response.data.data;
    }
    throw new Error(response.data.message || fallback);
}

/** Curriculum catalog, content items, playback and progress (ContentService, /api/content). */
export const contentService = {
    // ---- Catalog ----
    async getLevels(): Promise<Level[]> {
        return unwrap(await api.get<ApiResponse<Level[]>>('/api/content/levels'), 'Seviyeler yüklenemedi');
    },

    async getSubjects(levelSlug: string): Promise<Subject[]> {
        return unwrap(await api.get<ApiResponse<Subject[]>>(`/api/content/levels/${encodeURIComponent(levelSlug)}/subjects`), 'Dersler yüklenemedi');
    },

    async getSubjectTree(subjectId: string): Promise<SubjectTree> {
        return unwrap(await api.get<ApiResponse<SubjectTree>>(`/api/content/subjects/${subjectId}/tree`), 'Ders yüklenemedi');
    },

    async getTopic(topicId: string): Promise<TopicDetail> {
        return unwrap(await api.get<ApiResponse<TopicDetail>>(`/api/content/topics/${topicId}`), 'Konu yüklenemedi');
    },

    // ---- Items ----
    async getItem(id: string): Promise<ContentItem> {
        return unwrap(await api.get<ApiResponse<ContentItem>>(`/api/content/items/${id}`), 'İçerik yüklenemedi');
    },

    async getMine(page = 1, pageSize = 50): Promise<PagedResponse<ContentItemSummary>> {
        return unwrap(await api.get<ApiResponse<PagedResponse<ContentItemSummary>>>(`/api/content/items/mine?page=${page}&pageSize=${pageSize}`), 'İçerikler yüklenemedi');
    },

    async createItem(data: CreateContentItemRequest): Promise<ContentItem> {
        return unwrap(await api.post<ApiResponse<ContentItem>>('/api/content/items', data), 'İçerik oluşturulamadı');
    },

    async deleteItem(id: string): Promise<void> {
        unwrap(await api.delete<ApiResponse<boolean>>(`/api/content/items/${id}`), 'İçerik silinemedi');
    },

    /** Streams the file to object storage; videos are then queued for HLS conversion. */
    async upload(id: string, file: File, onProgress?: (percent: number) => void): Promise<ContentItem> {
        const form = new FormData();
        form.append('file', file, file.name);
        return unwrap(await api.post<ApiResponse<ContentItem>>(`/api/content/items/${id}/upload`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            // Large videos: no client-side timeout; the server enforces its own size limit.
            timeout: 0,
            onUploadProgress: e => {
                if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
            },
        }), 'Dosya yüklenemedi');
    },

    async retryProcessing(id: string): Promise<ContentItem> {
        return unwrap(await api.post<ApiResponse<ContentItem>>(`/api/content/items/${id}/retry-processing`), 'İşlem yeniden başlatılamadı');
    },

    async submit(id: string): Promise<ContentItem> {
        return unwrap(await api.post<ApiResponse<ContentItem>>(`/api/content/items/${id}/submit`), 'Onaya gönderilemedi');
    },

    async publish(id: string): Promise<ContentItem> {
        return unwrap(await api.post<ApiResponse<ContentItem>>(`/api/content/items/${id}/publish`), 'Yayınlanamadı');
    },

    async unpublish(id: string): Promise<ContentItem> {
        return unwrap(await api.post<ApiResponse<ContentItem>>(`/api/content/items/${id}/unpublish`), 'Yayından kaldırılamadı');
    },

    async review(id: string, approve: boolean, note?: string): Promise<ContentItem> {
        return unwrap(await api.post<ApiResponse<ContentItem>>(`/api/content/items/${id}/review`, { approve, note }), 'Karar kaydedilemedi');
    },

    async getReviewQueue(page = 1, pageSize = 50): Promise<PagedResponse<ContentItem>> {
        return unwrap(await api.get<ApiResponse<PagedResponse<ContentItem>>>(`/api/content/review-queue?page=${page}&pageSize=${pageSize}`), 'Onay kuyruğu yüklenemedi');
    },

    // ---- Playback ----
    /** Absolute URL of an item's HLS playlist; segments are fetched relative to it with the same bearer token. */
    hlsUrl(id: string): string {
        return `${API_BASE}/api/content/items/${id}/hls/master.m3u8`;
    },

    /** The document bytes (PDF), fetched with the caller's token because a plain link cannot carry it. */
    async getFile(id: string): Promise<ArrayBuffer> {
        const response = await api.get<ArrayBuffer>(`/api/content/items/${id}/file`, { responseType: 'arraybuffer', timeout: 0 });
        return response.data;
    },

    /** Thumbnails of published items are public, so a plain <img> can show them. */
    publicThumbnailUrl(id: string): string {
        return `${API_BASE}/api/content/public/items/${id}/thumbnail`;
    },

    // ---- Progress ----
    async saveProgress(id: string, positionSeconds: number, completed = false): Promise<ContentProgress> {
        return unwrap(await api.put<ApiResponse<ContentProgress>>(`/api/content/items/${id}/progress`, { positionSeconds: Math.floor(positionSeconds), completed }), 'İlerleme kaydedilemedi');
    },

    async getContinue(): Promise<ContinueWatching[]> {
        return unwrap(await api.get<ApiResponse<ContinueWatching[]>>('/api/content/progress/continue'), 'Devam listesi yüklenemedi');
    },

    async getStudentActivity(studentId: string, days = 7): Promise<StudentContentActivity> {
        return unwrap(await api.get<ApiResponse<StudentContentActivity>>(`/api/content/progress/student/${studentId}?days=${days}`), 'Çalışma özeti yüklenemedi');
    },

    // ---- Curriculum administration ----
    async createSubject(levelId: string, name: string, color?: string): Promise<Subject> {
        return unwrap(await api.post<ApiResponse<Subject>>('/api/content/curriculum/subjects', { levelId, name, color }), 'Ders eklenemedi');
    },

    async createUnit(subjectId: string, name: string): Promise<{ id: string; subjectId: string; name: string; order: number }> {
        return unwrap(await api.post<ApiResponse<{ id: string; subjectId: string; name: string; order: number }>>('/api/content/curriculum/units', { subjectId, name }), 'Ünite eklenemedi');
    },

    async createTopic(unitId: string, name: string): Promise<{ id: string; unitId: string; slug: string; name: string; order: number }> {
        return unwrap(await api.post<ApiResponse<{ id: string; unitId: string; slug: string; name: string; order: number }>>('/api/content/curriculum/topics', { unitId, name }), 'Konu eklenemedi');
    },

    async createOutcome(topicId: string, code: string, description: string): Promise<LearningOutcome> {
        return unwrap(await api.post<ApiResponse<LearningOutcome>>('/api/content/curriculum/outcomes', { topicId, code, description }), 'Kazanım eklenemedi');
    },

    async deleteCurriculumNode(kind: 'subjects' | 'units' | 'topics' | 'outcomes', id: string): Promise<void> {
        unwrap(await api.delete<ApiResponse<boolean>>(`/api/content/curriculum/${kind}/${id}`), 'Silinemedi');
    },

    /**
     * Imports an .xlsx/.csv curriculum. With dryRun the server only reports what would change. An invalid
     * file comes back as 400 with the row errors in the body, which is returned rather than thrown.
     */
    async importCurriculum(file: File, dryRun: boolean): Promise<CurriculumImportResult> {
        const form = new FormData();
        form.append('file', file, file.name);
        try {
            return unwrap(await api.post<ApiResponse<CurriculumImportResult>>(
                `/api/content/curriculum/import?dryRun=${dryRun}`, form,
                { headers: { 'Content-Type': 'multipart/form-data' } }), 'İçe aktarma başarısız');
        } catch (error) {
            const body = (error as { response?: { data?: ApiResponse<CurriculumImportResult> } }).response?.data;
            if (body?.data) return body.data;
            throw error;
        }
    },
};

export default contentService;
