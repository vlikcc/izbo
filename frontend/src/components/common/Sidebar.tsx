import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import './Sidebar.css';

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

    // Close sidebar when route changes on mobile
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
                <header className="mobile-header">
                    <button className="hamburger-btn" onClick={toggleSidebar}>
                        <span className={`hamburger-line ${isOpen ? 'open' : ''}`}></span>
                        <span className={`hamburger-line ${isOpen ? 'open' : ''}`}></span>
                        <span className={`hamburger-line ${isOpen ? 'open' : ''}`}></span>
                    </button>
                    <h1 className="mobile-logo">📚 İzbo</h1>
                    <Link to="/notifications" className="mobile-notification">
                        🔔
                    </Link>
                </header>
            )}

            {/* Overlay */}
            {isMobile && isOpen && (
                <div className="sidebar-overlay" onClick={() => setIsOpen(false)}></div>
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${isOpen ? 'open' : ''} ${isMobile ? 'mobile' : ''}`}>
                <div className="sidebar-header">
                    <h1 className="sidebar-logo">📚 İzbo</h1>
                    {isMobile && (
                        <button className="close-btn" onClick={() => setIsOpen(false)}>
                            ✕
                        </button>
                    )}
                </div>

                <nav className="sidebar-nav">
                    {filteredItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`sidebar-link ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
                        >
                            <span className="sidebar-icon">{item.icon}</span>
                            <span className="sidebar-label">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    {user && (
                        <div className="user-info">
                            <div className="user-avatar">
                                {user.firstName[0]}{user.lastName[0]}
                            </div>
                            <div className="user-details">
                                <span className="user-name">{user.firstName} {user.lastName}</span>
                                <span className="user-role">{user.role}</span>
                            </div>
                        </div>
                    )}
                    <button className="logout-btn" onClick={logout}>
                        🚪 Çıkış Yap
                    </button>
                </div>
            </aside>
        </>
    );
};
