import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light' | 'system';

interface ThemeState {
    theme: Theme;
    resolvedTheme: 'dark' | 'light';
    setTheme: (theme: Theme) => void;
}

const getSystemTheme = (): 'dark' | 'light' => {
    if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
};

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'dark',
            resolvedTheme: 'dark',
            setTheme: (theme: Theme) => {
                const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;
                set({ theme, resolvedTheme });
                
                // Apply to document
                if (typeof document !== 'undefined') {
                    document.documentElement.setAttribute('data-theme', resolvedTheme);
                }
            },
        }),
        {
            name: 'theme-storage',
            onRehydrateStorage: () => (state) => {
                if (state) {
                    const resolvedTheme = state.theme === 'system' ? getSystemTheme() : state.theme;
                    state.resolvedTheme = resolvedTheme;
                    if (typeof document !== 'undefined') {
                        document.documentElement.setAttribute('data-theme', resolvedTheme);
                    }
                }
            },
        }
    )
);

// Listen for system theme changes
if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const state = useThemeStore.getState();
        if (state.theme === 'system') {
            const newTheme = e.matches ? 'dark' : 'light';
            useThemeStore.setState({ resolvedTheme: newTheme });
            document.documentElement.setAttribute('data-theme', newTheme);
        }
    });
}
