import { create } from 'zustand';
import type { RegisterRequest, User } from '../types';
import authService from '../services/auth.service';
import { useSubscriptionStore } from './subscriptionStore';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    /**
     * False until checkAuth has settled. isAuthenticated is seeded synchronously from the stored
     * token, but `user` — and therefore the role — only arrives once the profile is fetched. Route
     * guards must wait for this instead of reading a null user as "not permitted".
     */
    isInitialized: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    /** `identifier` is an e-mail address or, for child accounts, a user name. */
    login: (identifier: string, password: string) => Promise<void>;
    /** Resolves with the message to show; registration does not start a session. */
    register: (data: RegisterRequest) => Promise<string>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    /** Replace the in-memory profile after a successful directory update, without re-reading JWT claims. */
    applyUser: (user: User) => void;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: authService.isAuthenticated(),
    isInitialized: false,
    isLoading: false,
    error: null,

    login: async (identifier: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
            const trimmed = identifier.trim();
            // User names cannot contain '@', so the two never collide.
            const response = await authService.login(
                trimmed.includes('@') ? { email: trimmed, password } : { username: trimmed, password });
            // The token issuer does not keep school fields (grade, target exam); the directory does.
            const profile = await authService.getCurrentUser().catch(() => null);
            set({ user: { ...response.user, ...profile }, isAuthenticated: true, isInitialized: true, isLoading: false });
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
            set({ user: null, isAuthenticated: false, isInitialized: true, isLoading: false });
            useSubscriptionStore.getState().reset();
        }
    },

    checkAuth: async () => {
        // Every exit sets isInitialized, including this one: with no token there is nothing to resolve,
        // and leaving the flag false would hang the guards on a spinner forever.
        if (!authService.isAuthenticated()) {
            set({ isAuthenticated: false, user: null, isInitialized: true });
            return;
        }

        set({ isLoading: true });
        try {
            const user = await authService.getCurrentUser();
            set({ user, isAuthenticated: !!user, isInitialized: true, isLoading: false });
            if (user) useSubscriptionStore.getState().load();
        } catch {
            set({ user: null, isAuthenticated: false, isInitialized: true, isLoading: false });
        }
    },

    applyUser: (user) => set({ user, isAuthenticated: true }),

    clearError: () => set({ error: null }),
}));

export default useAuthStore;
