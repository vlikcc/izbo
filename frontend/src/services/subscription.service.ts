import api from './api';
import type {
    ApiResponse,
    Plan,
    Subscription,
    CheckoutRequest,
    CheckoutResult,
    Organization,
    OrgRole,
    AdminSubscription,
    AdminOrder,
    SubscriberType,
} from '../types';

export const subscriptionService = {
    async getPlans(): Promise<Plan[]> {
        const response = await api.get<ApiResponse<Plan[]>>('/api/plans');
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return [];
    },

    async getMySubscription(): Promise<Subscription> {
        const response = await api.get<ApiResponse<Subscription>>('/api/subscriptions/me');
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Abonelik bilgisi alınamadı');
    },

    async startTrial(): Promise<Subscription> {
        const response = await api.post<ApiResponse<Subscription>>('/api/subscriptions/me/trial');
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Deneme süresi başlatılamadı');
    },

    async checkout(data: CheckoutRequest): Promise<CheckoutResult> {
        const response = await api.post<ApiResponse<CheckoutResult>>('/api/subscriptions/me/checkout', data);
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Satın alma talebi oluşturulamadı');
    },

    async cancel(): Promise<Subscription> {
        const response = await api.post<ApiResponse<Subscription>>('/api/subscriptions/me/cancel');
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Abonelik iptal edilemedi');
    },

    // Organizations
    async createOrganization(name: string): Promise<Organization> {
        const response = await api.post<ApiResponse<Organization>>('/api/organizations', { name });
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Kurum oluşturulamadı');
    },

    async getMyOrganization(): Promise<Organization | null> {
        try {
            const response = await api.get<ApiResponse<Organization>>('/api/organizations/me');
            return response.data.data ?? null;
        } catch {
            return null;
        }
    },

    async addOrganizationMember(orgId: string, userId: string, orgRole: OrgRole = 'Member'): Promise<void> {
        const response = await api.post<ApiResponse<unknown>>(`/api/organizations/${orgId}/members`, { userId, orgRole });
        if (!response.data.success) {
            throw new Error(response.data.message || 'Üye eklenemedi');
        }
    },

    async removeOrganizationMember(orgId: string, userId: string): Promise<void> {
        const response = await api.delete<ApiResponse<boolean>>(`/api/organizations/${orgId}/members/${userId}`);
        if (!response.data.success) {
            throw new Error(response.data.message || 'Üye çıkarılamadı');
        }
    },

    // Admin
    async adminListSubscriptions(): Promise<AdminSubscription[]> {
        const response = await api.get<ApiResponse<AdminSubscription[]>>('/api/admin/subscriptions');
        return response.data.data ?? [];
    },

    async adminAssignPlan(type: SubscriberType, subscriberId: string, planCode: string, extendDays?: number): Promise<AdminSubscription> {
        const response = await api.put<ApiResponse<AdminSubscription>>(
            `/api/admin/subscriptions/${type}/${subscriberId}`,
            { planCode, extendDays }
        );
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Plan güncellenemedi');
    },

    async adminListOrders(): Promise<AdminOrder[]> {
        const response = await api.get<ApiResponse<AdminOrder[]>>('/api/admin/orders');
        return response.data.data ?? [];
    },

    async adminMarkOrderPaid(orderId: string): Promise<void> {
        const response = await api.post<ApiResponse<boolean>>(`/api/admin/orders/${orderId}/mark-paid`);
        if (!response.data.success) {
            throw new Error(response.data.message || 'Sipariş güncellenemedi');
        }
    },
};

export default subscriptionService;
