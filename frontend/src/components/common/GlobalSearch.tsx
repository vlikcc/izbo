import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

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
            <button 
                className="flex items-center gap-3 px-4 py-2.5 bg-white border border-rose-100 rounded-xl text-gray-400 hover:border-rose-200 hover:text-gray-500 transition-all shadow-sm"
                onClick={() => setIsOpen(true)}
            >
                <span className="text-lg">🔍</span>
                <span className="text-sm">Ara...</span>
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-500 text-xs font-medium rounded-md border border-rose-100">
                    ⌘K
                </kbd>
            </button>
        );
    }

    return (
        <div 
            className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/30 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsOpen(false)}
        >
            <div 
                className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-rose-100 overflow-hidden animate-scale-in"
                ref={containerRef}
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-rose-100">
                    <span className="text-2xl text-rose-400">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 text-lg text-gray-700 placeholder-gray-400 outline-none bg-transparent"
                        placeholder="Ara... (sınıf, ödev, sınav)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button 
                        className="px-2 py-1 text-xs font-medium text-rose-500 bg-rose-50 rounded-md hover:bg-rose-100 transition-colors"
                        onClick={() => setIsOpen(false)}
                    >
                        ESC
                    </button>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center gap-3 py-8 text-gray-500">
                        <div className="w-5 h-5 border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
                        <span>Aranıyor...</span>
                    </div>
                )}

                {/* Results */}
                {!loading && results.length > 0 && (
                    <div className="max-h-80 overflow-y-auto py-2">
                        {results.map((result, index) => (
                            <button
                                key={result.id}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                                    index === selectedIndex 
                                        ? 'bg-rose-50' 
                                        : 'hover:bg-gray-50'
                                }`}
                                onClick={() => handleSelect(result)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <span className="text-xl w-8 h-8 flex items-center justify-center bg-rose-100 rounded-lg">
                                    {result.icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-800 truncate">{result.title}</p>
                                    {result.subtitle && (
                                        <p className="text-sm text-gray-500 truncate">{result.subtitle}</p>
                                    )}
                                </div>
                                <span className="px-2 py-1 text-xs font-medium text-rose-600 bg-rose-100 rounded-full">
                                    {getTypeLabel(result.type)}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {/* No Results */}
                {!loading && query && results.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <span className="text-4xl mb-3 opacity-50">🔍</span>
                        <p>"{query}" için sonuç bulunamadı</p>
                    </div>
                )}

                {/* Quick Access */}
                {!query && (
                    <div className="p-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                            Hızlı Erişim
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 rounded-xl text-gray-700 hover:bg-rose-100 transition-colors"
                                onClick={() => { navigate('/dashboard'); setIsOpen(false); }}
                            >
                                <span>📊</span> Dashboard
                            </button>
                            <button 
                                className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 rounded-xl text-gray-700 hover:bg-rose-100 transition-colors"
                                onClick={() => { navigate('/classrooms'); setIsOpen(false); }}
                            >
                                <span>🏫</span> Sınıflar
                            </button>
                            <button 
                                className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 rounded-xl text-gray-700 hover:bg-rose-100 transition-colors"
                                onClick={() => { navigate('/homework'); setIsOpen(false); }}
                            >
                                <span>📝</span> Ödevler
                            </button>
                            <button 
                                className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 rounded-xl text-gray-700 hover:bg-rose-100 transition-colors"
                                onClick={() => { navigate('/exams'); setIsOpen(false); }}
                            >
                                <span>📋</span> Sınavlar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
