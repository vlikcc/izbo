import React from 'react';
import { useThemeStore } from '../../stores/themeStore';
import './ThemeToggle.css';

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
        <button className="theme-toggle" onClick={handleToggle} title={`Tema: ${getLabel()}`}>
            <span className="theme-icon">{getIcon()}</span>
            <span className="theme-label">{getLabel()}</span>
        </button>
    );
};

export const ThemeSelector: React.FC = () => {
    const { theme, setTheme } = useThemeStore();

    return (
        <div className="theme-selector">
            <label className="selector-label">Tema</label>
            <div className="theme-options">
                <button
                    className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                >
                    ☀️ Aydınlık
                </button>
                <button
                    className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                >
                    🌙 Karanlık
                </button>
                <button
                    className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                    onClick={() => setTheme('system')}
                >
                    💻 Sistem
                </button>
            </div>
        </div>
    );
};
