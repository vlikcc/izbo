import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface MenuItem {
    path: string;
    label: string;
    icon: string;
    roles?: string[];
}

const menuItems: MenuItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/classrooms', label: 'Sınıflar', icon: '🏫' },
    { path: '/homework', label: 'Ödevler', icon: '📝' },
    { path: '/exams', label: 'Sınavlar', icon: '📋' },
    { path: '/live', label: 'Canlı Dersler', icon: '🎥' },
    { path: '/calendar', label: 'Takvim', icon: '📅' },
    { path: '/announcements', label: 'Duyurular', icon: '📢' },
    { path: '/messages', label: 'Mesajlar', icon: '💬' },
    { path: '/quiz', label: 'Anketler', icon: '📊' },
    { path: '/analytics', label: 'Analizler', icon: '📈' },
    { path: '/gamification', label: 'Başarılar', icon: '🏆' },
    { path: '/notifications', label: 'Bildirimler', icon: '🔔' },
    { path: '/profile', label: 'Profilim', icon: '👤' },
    { path: '/admin', label: 'Admin Paneli', icon: '⚙️', roles: ['Admin', 'SuperAdmin'] },
];

export const Sidebar: React.FC = () => {
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
            if (window.innerWidth > 768) {
                setIsOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isMobile) {
            setIsOpen(false);
        }
    }, [location.pathname, isMobile]);

    const filteredItems = menuItems.filter(
        (item) => !item.roles || (user && item.roles.includes(user.role))
    );

    const toggleSidebar = () => setIsOpen(!isOpen);

    return (
        <>
            {/* Mobile Header */}
            {isMobile && (
                <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-lg border-b border-rose-100 px-4 py-3 flex items-center justify-between">
                    <button 
                        className="w-10 h-10 flex flex-col items-center justify-center gap-1.5 rounded-xl hover:bg-rose-50 transition-colors"
                        onClick={toggleSidebar}
                        aria-label="Menüyü aç/kapat"
                    >
                        <span className={`w-5 h-0.5 bg-rose-500 rounded-full transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                        <span className={`w-5 h-0.5 bg-rose-500 rounded-full transition-all duration-300 ${isOpen ? 'opacity-0' : ''}`}></span>
                        <span className={`w-5 h-0.5 bg-rose-500 rounded-full transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
                    </button>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-rose-500 to-rose-400 bg-clip-text text-transparent flex items-center gap-2">
                        <span>🎓</span> İzbo
                    </h1>
                    <Link 
                        to="/notifications" 
                        className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-rose-50 transition-colors text-xl"
                    >
                        🔔
                    </Link>
                </header>
            )}

            {/* Overlay */}
            {isMobile && isOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-0 left-0 z-50 h-full w-64
                bg-white border-r border-rose-100
                flex flex-col
                transition-transform duration-300 ease-out
                ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
                ${isMobile ? 'shadow-2xl' : ''}
            `}>
                {/* Sidebar Header */}
                <div className="px-6 py-5 border-b border-rose-100 flex items-center justify-between">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-rose-400 bg-clip-text text-transparent flex items-center gap-2">
                        <span>🎓</span> İzbo
                    </h1>
                    {isMobile && (
                        <button 
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-rose-400 hover:text-rose-500 transition-colors"
                            onClick={() => setIsOpen(false)}
                            aria-label="Menüyü kapat"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-3">
                    <div className="space-y-1">
                        {filteredItems.map((item) => {
                            const isActive = location.pathname.startsWith(item.path);
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`
                                        flex items-center gap-3 px-4 py-3 rounded-xl
                                        transition-all duration-200
                                        ${isActive 
                                            ? 'bg-gradient-to-r from-rose-500 to-rose-400 text-white shadow-lg shadow-rose-200' 
                                            : 'text-gray-600 hover:bg-rose-50 hover:text-rose-600'
                                        }
                                    `}
                                >
                                    <span className="text-xl" role="img" aria-label={item.label}>
                                        {item.icon}
                                    </span>
                                    <span className="font-medium">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </nav>

                {/* Sidebar Footer */}
                <div className="p-4 border-t border-rose-100 bg-gradient-to-r from-rose-50 to-cream-50">
                    {user && (
                        <div className="flex items-center gap-3 mb-4 p-3 bg-white rounded-xl border border-rose-100">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-rose-500 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                                {(user.firstName || 'U')[0]}{(user.lastName || 'U')[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800 truncate">
                                    {user.firstName} {user.lastName}
                                </p>
                                <p className="text-xs text-rose-500 font-medium">
                                    {user.role}
                                </p>
                            </div>
                        </div>
                    )}
                    <button 
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white border border-rose-200 text-rose-600 font-medium hover:bg-rose-50 hover:border-rose-300 transition-all duration-200"
                        onClick={logout}
                        aria-label="Çıkış Yap"
                    >
                        <span role="img" aria-hidden="true">🚪</span>
                        Çıkış Yap
                    </button>
                </div>
            </aside>
        </>
    );
};
