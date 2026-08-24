import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import './Layout.css';

export const MainLayout: React.FC = () => {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const isStaff = user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin';
    const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';

    const navItems = [
        { path: '/app/dashboard', icon: '🏠', label: t('nav.home') },
        { path: '/app/classrooms', icon: '📚', label: t('nav.classrooms') },
        { path: '/app/exams', icon: '📝', label: t('nav.exams') },
        { path: '/app/homework', icon: '📖', label: t('nav.homework') },
        { path: '/app/live', icon: '🎥', label: t('nav.live') },
        { path: '/app/calendar', icon: '📅', label: t('nav.calendar') },
        ...(isStaff ? [{ path: '/app/gradebook', icon: '📊', label: t('nav.gradebook') }] : []),
        ...(isAdmin ? [{ path: '/app/admin', icon: '🛡️', label: t('nav.admin') }] : []),
        { path: '/app/profile', icon: '👤', label: t('nav.profile') },
    ];

    return (
        <div className="layout">
            <button
                type="button"
                className="sidebar-toggle"
                aria-expanded={sidebarOpen}
                aria-controls="app-sidebar"
                onClick={() => setSidebarOpen((open) => !open)}
            >
                ☰ Menü
            </button>
            {sidebarOpen && (
                <button type="button" className="sidebar-backdrop" aria-label="Menüyü kapat" onClick={() => setSidebarOpen(false)} />
            )}

            <aside id="app-sidebar" className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <span className="sidebar-logo-icon" aria-hidden="true">📚</span>
                        <span className="sidebar-logo-text">{t('appName')}</span>
                    </div>
                </div>

                <nav className="sidebar-nav" aria-label="Ana menü">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                                `sidebar-nav-item ${isActive ? 'active' : ''}`
                            }
                        >
                            <span className="sidebar-nav-icon" aria-hidden="true">{item.icon}</span>
                            <span className="sidebar-nav-label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar" aria-hidden="true">
                            {user?.firstName?.charAt(0) || '?'}
                        </div>
                        <div className="sidebar-user-info">
                            <span className="sidebar-user-name">
                                {user?.firstName} {user?.lastName}
                            </span>
                            <span className="sidebar-user-role">{user?.role}</span>
                        </div>
                    </div>
                    <button className="sidebar-logout" onClick={() => void handleLogout()}>
                        Çıkış Yap
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
