import { create } from 'zustand';
import type { User } from '../types';
import authService from '../services/auth.service';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (email: string, password: string) => Promise<void>;
    register: (data: { email: string; password: string; firstName: string; lastName: string; role?: string }) => Promise<void>;
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
            const response = await authService.register(data);
            set({ user: response.user, isAuthenticated: true, isLoading: false });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Registration failed',
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
        } catch {
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },

    clearError: () => set({ error: null }),
}));

export default useAuthStore;
