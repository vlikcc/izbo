import { create } from 'zustand';
import type { User } from '../types';
import authService from '../services/auth.service';
import { useSubscriptionStore } from './subscriptionStore';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (email: string, password: string) => Promise<void>;
    /** Resolves with the message to show; registration does not start a session. */
    register: (data: { email: string; password: string; firstName: string; lastName: string; role?: string }) => Promise<string>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: authService.isAuthenticated(),
    isLoading: false,
    error: null,

    login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await authService.login({ email, password });
            set({ user: response.user, isAuthenticated: true, isLoading: false });
            useSubscriptionStore.getState().load();
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Login failed',
                isLoading: false
            });
            throw error;
        }
    },

    register: async (data) => {
        set({ isLoading: true, error: null });
        try {
            const message = await authService.register(data);
            set({ isLoading: false });
            return message;
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Kayıt tamamlanamadı',
                isLoading: false
            });
            throw error;
        }
    },

    logout: async () => {
        set({ isLoading: true });
        try {
            await authService.logout();
        } finally {
            set({ user: null, isAuthenticated: false, isLoading: false });
            useSubscriptionStore.getState().reset();
        }
    },

    checkAuth: async () => {
        if (!authService.isAuthenticated()) {
            set({ isAuthenticated: false, user: null });
            return;
        }

        set({ isLoading: true });
        try {
            const user = await authService.getCurrentUser();
            set({ user, isAuthenticated: !!user, isLoading: false });
            if (user) useSubscriptionStore.getState().load();
        } catch {
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },

    clearError: () => set({ error: null }),
}));

export default useAuthStore;
