import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import './Layout.css';

const PLAN_BADGE_LABELS: Record<string, string> = {
    free: 'Ücretsiz',
    pro: 'Pro',
    institution: 'Kurumsal',
};

// A same-day-precision countdown doesn't need to be exact to the render tick, so this reads
// trialEndsAt (a fixed timestamp from the server) rather than depending on the render clock.
function daysUntil(isoDate: string): number {
    return Math.max(0, Math.ceil((new Date(isoDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000));
}

export const MainLayout: React.FC = () => {
    const { user, logout } = useAuthStore();
    const { subscription } = useSubscriptionStore();
    const navigate = useNavigate();

    const trialDaysLeft = subscription?.status === 'Trialing' && subscription.trialEndsAt
        ? daysUntil(subscription.trialEndsAt)
        : null;

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';

    const navItems = [
        { path: '/app/dashboard', icon: '🏠', label: 'Ana Sayfa' },
        { path: '/app/classrooms', icon: '📚', label: 'Sınıflar' },
        { path: '/app/exams', icon: '📝', label: 'Sınavlar' },
        { path: '/app/homework', icon: '📖', label: 'Ödevler' },
        { path: '/app/live', icon: '🎥', label: 'Canlı Ders' },
        { path: '/app/billing', icon: '💳', label: 'Planım' },
        ...(isAdmin ? [{ path: '/app/admin/subscriptions', icon: '⚙️', label: 'Abonelikler' }] : []),
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
                            {subscription && (
                                <span className="sidebar-plan-badge">
                                    {PLAN_BADGE_LABELS[subscription.plan.code] ?? subscription.plan.name}
                                    {trialDaysLeft !== null && (
                                        <span className="sidebar-plan-trial">{' '}· {trialDaysLeft} gün</span>
                                    )}
                                </span>
                            )}
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
