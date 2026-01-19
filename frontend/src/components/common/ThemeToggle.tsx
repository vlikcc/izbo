import React from 'react';
import { useThemeStore } from '../../stores/themeStore';

export const ThemeToggle: React.FC = () => {
    const { theme, setTheme } = useThemeStore();

    const handleToggle = () => {
        if (theme === 'dark') {
            setTheme('light');
        } else if (theme === 'light') {
            setTheme('system');
        } else {
            setTheme('dark');
        }
    };

    const getIcon = () => {
        switch (theme) {
            case 'dark':
                return '🌙';
            case 'light':
                return '☀️';
            case 'system':
                return '💻';
            default:
                return '🌙';
        }
    };

    const getLabel = () => {
        switch (theme) {
            case 'dark':
                return 'Karanlık';
            case 'light':
                return 'Aydınlık';
            case 'system':
                return 'Sistem';
            default:
                return 'Karanlık';
        }
    };

    return (
        <button 
            className="flex items-center gap-2 px-3 py-2 bg-rose-50 text-gray-700 rounded-xl hover:bg-rose-100 transition-colors"
            onClick={handleToggle} 
            title={`Tema: ${getLabel()}`}
        >
            <span className="text-lg">{getIcon()}</span>
            <span className="text-sm font-medium">{getLabel()}</span>
        </button>
    );
};

export const ThemeSelector: React.FC = () => {
    const { theme, setTheme } = useThemeStore();

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Tema</label>
            <div className="flex gap-2">
                <button
                    className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all ${
                        theme === 'light' 
                            ? 'bg-rose-500 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-rose-50'
                    }`}
                    onClick={() => setTheme('light')}
                >
                    ☀️ Aydınlık
                </button>
                <button
                    className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all ${
                        theme === 'dark' 
                            ? 'bg-rose-500 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-rose-50'
                    }`}
                    onClick={() => setTheme('dark')}
                >
                    🌙 Karanlık
                </button>
                <button
                    className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all ${
                        theme === 'system' 
                            ? 'bg-rose-500 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-rose-50'
                    }`}
                    onClick={() => setTheme('system')}
                >
                    💻 Sistem
                </button>
            </div>
        </div>
    );
};
