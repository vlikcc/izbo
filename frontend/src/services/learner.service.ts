import api from './api';
import type { ApiResponse, PagedResponse } from '../types';
import type {
    LearnerAccess,
    LearnerOrder,
    LearnerOrderStatus,
    LearnerPackage,
    LearnerPass,
    LearnerPrice,
    LearnerTerm,
    PracticeUsage,
    UpdateLearnerPackageRequest,
} from '../types/learner';

function unwrap<T>(response: { data: ApiResponse<T> }, fallback: string): T {
    if (response.data.success && response.data.data !== null && response.data.data !== undefined) {
        return response.data.data;
    }
    throw new Error(response.data.message || fallback);
}

/** Student packages: catalogue, access, trial, bank-transfer orders, and their administration. */
export const learnerService = {
    async getPackages(): Promise<LearnerPackage[]> {
        return unwrap(await api.get<ApiResponse<LearnerPackage[]>>('/api/learner/packages'), 'Paketler alınamadı');
    },

    async getMyAccess(): Promise<LearnerAccess> {
        return unwrap(await api.get<ApiResponse<LearnerAccess>>('/api/learner/access/me'), 'Paket bilgisi alınamadı');
    },

    async getAccess(studentId: string): Promise<LearnerAccess> {
        return unwrap(await api.get<ApiResponse<LearnerAccess>>(`/api/learner/access/${studentId}`), 'Paket bilgisi alınamadı');
    },

    async getPasses(studentId: string): Promise<LearnerPass[]> {
        return unwrap(await api.get<ApiResponse<LearnerPass[]>>(`/api/learner/passes/${studentId}`), 'Paket geçmişi alınamadı');
    },

    async startTrial(studentId: string): Promise<LearnerAccess> {
        return unwrap(await api.post<ApiResponse<LearnerAccess>>('/api/learner/trial', { studentId }), 'Deneme başlatılamadı');
    },

    async createOrder(studentId: string, packageCode: string, term: LearnerTerm): Promise<LearnerOrder> {
        return unwrap(await api.post<ApiResponse<LearnerOrder>>('/api/learner/orders', { studentId, packageCode, term }), 'Sipariş oluşturulamadı');
    },

    async notifyPaid(orderId: string, note?: string): Promise<LearnerOrder> {
        return unwrap(await api.post<ApiResponse<LearnerOrder>>(`/api/learner/orders/${orderId}/paid-notice`, { note: note || null }), 'Bildirim gönderilemedi');
    },

    async cancelOrder(orderId: string): Promise<LearnerOrder> {
        return unwrap(await api.post<ApiResponse<LearnerOrder>>(`/api/learner/orders/${orderId}/cancel`), 'Sipariş iptal edilemedi');
    },

    async getMyOrders(): Promise<LearnerOrder[]> {
        return unwrap(await api.get<ApiResponse<LearnerOrder[]>>('/api/learner/orders/mine'), 'Siparişler alınamadı');
    },

    async getPracticeUsage(): Promise<PracticeUsage> {
        return unwrap(await api.get<ApiResponse<PracticeUsage>>('/api/content/practice/usage'), 'Test hakkı alınamadı');
    },

    // ---- Administration ----

    async adminListOrders(status?: LearnerOrderStatus, page = 1): Promise<PagedResponse<LearnerOrder>> {
        const query = new URLSearchParams({ page: String(page), pageSize: '50' });
        if (status) query.set('status', status);
        return unwrap(await api.get<ApiResponse<PagedResponse<LearnerOrder>>>(`/api/learner/admin/orders?${query}`), 'Siparişler alınamadı');
    },

    async adminApprove(orderId: string): Promise<LearnerOrder> {
        return unwrap(await api.post<ApiResponse<LearnerOrder>>(`/api/learner/admin/orders/${orderId}/approve`), 'Onaylanamadı');
    },

    async adminReject(orderId: string, reason: string): Promise<LearnerOrder> {
        return unwrap(await api.post<ApiResponse<LearnerOrder>>(`/api/learner/admin/orders/${orderId}/reject`, { reason }), 'Reddedilemedi');
    },

    async adminGrant(studentId: string, packageCode: string, days: number): Promise<LearnerPass> {
        return unwrap(await api.post<ApiResponse<LearnerPass>>('/api/learner/admin/passes', { studentId, packageCode, days }), 'Paket tanımlanamadı');
    },

    async adminListPackages(): Promise<LearnerPackage[]> {
        return unwrap(await api.get<ApiResponse<LearnerPackage[]>>('/api/learner/admin/packages'), 'Paketler alınamadı');
    },

    async adminUpdatePackage(code: string, request: UpdateLearnerPackageRequest): Promise<LearnerPackage> {
        return unwrap(await api.put<ApiResponse<LearnerPackage>>(`/api/learner/admin/packages/${code}`, request), 'Paket kaydedilemedi');
    },

    async adminSetPrices(code: string, prices: LearnerPrice[]): Promise<LearnerPackage> {
        return unwrap(await api.put<ApiResponse<LearnerPackage>>(`/api/learner/admin/packages/${code}/prices`, { prices }), 'Fiyatlar kaydedilemedi');
    },
};

export default learnerService;
