import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './GlobalSearch.css';

interface SearchResult {
    id: string;
    title: string;
    subtitle?: string;
    type: 'classroom' | 'homework' | 'exam' | 'session' | 'user' | 'announcement';
    link: string;
    icon: string;
}

export const GlobalSearch: React.FC = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Keyboard shortcut to open search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Search when query changes
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        setLoading(true);
        const timer = setTimeout(() => {
            // Mock search - in real app, call API
            const mockResults: SearchResult[] = [
                { id: '1', title: 'Matematik 101', subtitle: '25 öğrenci', type: 'classroom' as const, link: '/classrooms/1', icon: '🏫' },
                { id: '2', title: 'Fizik 102', subtitle: '20 öğrenci', type: 'classroom' as const, link: '/classrooms/2', icon: '🏫' },
                { id: '3', title: 'Türev Ödevi', subtitle: 'Matematik 101', type: 'homework' as const, link: '/homework/1', icon: '📝' },
                { id: '4', title: 'Ara Sınav', subtitle: 'Fizik 102', type: 'exam' as const, link: '/exams/1', icon: '📋' },
                { id: '5', title: 'Canlı Ders - Integral', subtitle: 'Matematik 101', type: 'session' as const, link: '/live/1', icon: '🎥' },
                { id: '6', title: 'Sınav Tarihi Değişikliği', subtitle: 'Duyuru', type: 'announcement' as const, link: '/announcements', icon: '📢' },
            ].filter(r => 
                r.title.toLowerCase().includes(query.toLowerCase()) ||
                r.subtitle?.toLowerCase().includes(query.toLowerCase())
            );

            setResults(mockResults);
            setLoading(false);
            setSelectedIndex(0);
        }, 200);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = (result: SearchResult) => {
        navigate(result.link);
        setIsOpen(false);
        setQuery('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                if (results[selectedIndex]) {
                    handleSelect(results[selectedIndex]);
                }
                break;
        }
    };

    const getTypeLabel = (type: SearchResult['type']) => {
        switch (type) {
            case 'classroom': return 'Sınıf';
            case 'homework': return 'Ödev';
            case 'exam': return 'Sınav';
            case 'session': return 'Ders';
            case 'user': return 'Kullanıcı';
            case 'announcement': return 'Duyuru';
            default: return '';
        }
    };

    if (!isOpen) {
        return (
            <button className="search-trigger" onClick={() => setIsOpen(true)}>
                <span className="search-icon">🔍</span>
                <span className="search-placeholder">Ara...</span>
                <kbd className="search-shortcut">⌘K</kbd>
            </button>
        );
    }

    return (
        <div className="search-overlay" onClick={() => setIsOpen(false)}>
            <div 
                className="search-modal" 
                ref={containerRef}
                onClick={e => e.stopPropagation()}
            >
                <div className="search-input-wrapper">
                    <span className="search-icon-large">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="search-input"
                        placeholder="Ara... (sınıf, ödev, sınav)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button className="search-close" onClick={() => setIsOpen(false)}>
                        ESC
                    </button>
                </div>

                {loading && (
                    <div className="search-loading">
                        <div className="spinner-small"></div>
                        <span>Aranıyor...</span>
                    </div>
                )}

                {!loading && results.length > 0 && (
                    <div className="search-results">
                        {results.map((result, index) => (
                            <button
                                key={result.id}
                                className={`search-result ${index === selectedIndex ? 'selected' : ''}`}
                                onClick={() => handleSelect(result)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <span className="result-icon">{result.icon}</span>
                                <div className="result-content">
                                    <span className="result-title">{result.title}</span>
                                    {result.subtitle && (
                                        <span className="result-subtitle">{result.subtitle}</span>
                                    )}
                                </div>
                                <span className="result-type">{getTypeLabel(result.type)}</span>
                            </button>
                        ))}
                    </div>
                )}

                {!loading && query && results.length === 0 && (
                    <div className="search-empty">
                        <span>🔍</span>
                        <p>"{query}" için sonuç bulunamadı</p>
                    </div>
                )}

                {!query && (
                    <div className="search-hints">
                        <p className="hints-title">Hızlı Erişim</p>
                        <div className="hints-list">
                            <button onClick={() => { navigate('/dashboard'); setIsOpen(false); }}>
                                📊 Dashboard
                            </button>
                            <button onClick={() => { navigate('/classrooms'); setIsOpen(false); }}>
                                🏫 Sınıflar
                            </button>
                            <button onClick={() => { navigate('/homework'); setIsOpen(false); }}>
                                📝 Ödevler
                            </button>
                            <button onClick={() => { navigate('/exams'); setIsOpen(false); }}>
                                📋 Sınavlar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
