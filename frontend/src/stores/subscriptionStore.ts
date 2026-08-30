import { create } from 'zustand';
import type { Subscription, QuotaMetric } from '../types';
import subscriptionService from '../services/subscription.service';

interface SubscriptionState {
    subscription: Subscription | null;
    isLoading: boolean;
    error: string | null;

    load: () => Promise<void>;
    reset: () => void;
    hasFeature: (featureCode: string) => boolean;
    limitOf: (metric: QuotaMetric) => number; // -1 = unlimited
    usageOf: (metric: QuotaMetric) => number;
    remainingOf: (metric: QuotaMetric) => number; // -1 = unlimited
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
    subscription: null,
    isLoading: false,
    error: null,

    load: async () => {
        set({ isLoading: true, error: null });
        try {
            const subscription = await subscriptionService.getMySubscription();
            set({ subscription, isLoading: false });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Abonelik bilgisi alınamadı',
                isLoading: false,
            });
        }
    },

    reset: () => set({ subscription: null, isLoading: false, error: null }),

    hasFeature: (featureCode: string) => {
        const { subscription } = get();
        return subscription?.plan.features.some(f => f.featureCode === featureCode && f.isEnabled) ?? false;
    },

    limitOf: (metric: QuotaMetric) => {
        const { subscription } = get();
        return subscription?.plan.limits.find(l => l.metric === metric)?.value ?? 0;
    },

    usageOf: (metric: QuotaMetric) => {
        const { subscription } = get();
        return subscription?.usage.find(u => u.metric === metric)?.used ?? 0;
    },

    remainingOf: (metric: QuotaMetric) => {
        const limit = get().limitOf(metric);
        if (limit < 0) return -1;
        return Math.max(0, limit - get().usageOf(metric));
    },
}));

export default useSubscriptionStore;
