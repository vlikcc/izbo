import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import './Layout.css';

export const MainLayout: React.FC = () => {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/app/dashboard', icon: '🏠', label: 'Ana Sayfa' },
        { path: '/app/classrooms', icon: '📚', label: 'Sınıflar' },
        { path: '/app/exams', icon: '📝', label: 'Sınavlar' },
        { path: '/app/homework', icon: '📖', label: 'Ödevler' },
        { path: '/app/live', icon: '🎥', label: 'Canlı Ders' },
        { path: '/app/profile', icon: '👤', label: 'Profil' },
    ];

    return (
        <div className="layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <span className="sidebar-logo-icon">📚</span>
                        <span className="sidebar-logo-text">EduPlatform</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `sidebar-nav-item ${isActive ? 'active' : ''}`
                            }
                        >
                            <span className="sidebar-nav-icon">{item.icon}</span>
                            <span className="sidebar-nav-label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">
                            {user?.firstName?.charAt(0) || '?'}
                        </div>
                        <div className="sidebar-user-info">
                            <span className="sidebar-user-name">
                                {user?.firstName} {user?.lastName}
                            </span>
                            <span className="sidebar-user-role">{user?.role}</span>
                        </div>
                    </div>
                    <button className="sidebar-logout" onClick={handleLogout}>
                        🚪 Çıkış Yap
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
