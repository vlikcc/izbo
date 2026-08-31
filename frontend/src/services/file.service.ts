import api from './api';
import type { ApiResponse } from '../types';

export interface UploadedFile {
    id: string;
    fileName: string;
    size: number;
}

export const fileService = {
    async upload(file: File, type = 'Document', entityId?: string): Promise<UploadedFile> {
        const form = new FormData();
        form.append('file', file);
        const params = new URLSearchParams({ type });
        if (entityId) params.append('entityId', entityId);

        const response = await api.post<ApiResponse<UploadedFile>>(`/api/files/upload?${params}`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Dosya yüklenemedi');
    },
};

export default fileService;
