import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Admin.css';

// Mock data
const mockStats = {
    totalUsers: 1247,
    activeUsers: 892,
    totalClassrooms: 156,
    totalExams: 423,
    totalHomework: 1892,
    liveSessions: 12,
};

const mockUsers = [
    { id: '1', firstName: 'Ahmet', lastName: 'Yılmaz', email: 'ahmet@email.com', role: 'Student', isActive: true, createdAt: '2024-01-15' },
    { id: '2', firstName: 'Fatma', lastName: 'Demir', email: 'fatma@email.com', role: 'Instructor', isActive: true, createdAt: '2024-01-10' },
    { id: '3', firstName: 'Mehmet', lastName: 'Kaya', email: 'mehmet@email.com', role: 'Student', isActive: false, createdAt: '2024-02-01' },
    { id: '4', firstName: 'Ayşe', lastName: 'Çelik', email: 'ayse@email.com', role: 'Admin', isActive: true, createdAt: '2023-12-20' },
    { id: '5', firstName: 'Ali', lastName: 'Öz', email: 'ali@email.com', role: 'Student', isActive: true, createdAt: '2024-02-15' },
];

const AdminSidebar: React.FC = () => {
    const location = useLocation();

    const menuItems = [
        { path: '/admin', label: 'Dashboard', icon: '📊' },
        { path: '/admin/users', label: 'Kullanıcılar', icon: '👥' },
        { path: '/admin/classrooms', label: 'Sınıflar', icon: '🏫' },
        { path: '/admin/exams', label: 'Sınavlar', icon: '📋' },
        { path: '/admin/reports', label: 'Raporlar', icon: '📈' },
        { path: '/admin/settings', label: 'Ayarlar', icon: '⚙️' },
    ];

    return (
        <nav className="admin-sidebar">
            <h3>Admin Paneli</h3>
            <ul>
                {menuItems.map((item) => (
                    <li key={item.path}>
                        <Link
                            to={item.path}
                            className={location.pathname === item.path ? 'active' : ''}
                        >
                            <span className="menu-icon">{item.icon}</span>
                            {item.label}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export const AdminDashboard: React.FC = () => {
    return (
        <div className="admin-page">
            <AdminSidebar />
            <div className="admin-content">
                <header className="admin-header">
                    <h1>📊 Admin Dashboard</h1>
                    <p>Sistem genel bakış ve istatistikleri</p>
                </header>

                {/* Stats Grid */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon">👥</div>
                        <div className="stat-info">
                            <span className="stat-value">{mockStats.totalUsers.toLocaleString()}</span>
                            <span className="stat-label">Toplam Kullanıcı</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon active">✓</div>
                        <div className="stat-info">
                            <span className="stat-value">{mockStats.activeUsers.toLocaleString()}</span>
                            <span className="stat-label">Aktif Kullanıcı</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">🏫</div>
                        <div className="stat-info">
                            <span className="stat-value">{mockStats.totalClassrooms}</span>
                            <span className="stat-label">Sınıf</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📋</div>
                        <div className="stat-info">
                            <span className="stat-value">{mockStats.totalExams}</span>
                            <span className="stat-label">Sınav</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📝</div>
                        <div className="stat-info">
                            <span className="stat-value">{mockStats.totalHomework.toLocaleString()}</span>
                            <span className="stat-label">Ödev</span>
                        </div>
                    </div>
                    <div className="stat-card live">
                        <div className="stat-icon">🔴</div>
                        <div className="stat-info">
                            <span className="stat-value">{mockStats.liveSessions}</span>
                            <span className="stat-label">Canlı Ders</span>
                        </div>
                    </div>
                </div>

                {/* Recent Activity */}
                <section className="admin-section">
                    <h2>📈 Son Aktiviteler</h2>
                    <div className="activity-list">
                        <div className="activity-item">
                            <span className="activity-icon">👤</span>
                            <span className="activity-text">Yeni kullanıcı kaydı: <strong>Ali Öz</strong></span>
                            <span className="activity-time">5 dk önce</span>
                        </div>
                        <div className="activity-item">
                            <span className="activity-icon">🏫</span>
                            <span className="activity-text">Yeni sınıf oluşturuldu: <strong>Fizik 101</strong></span>
                            <span className="activity-time">15 dk önce</span>
                        </div>
                        <div className="activity-item">
                            <span className="activity-icon">📋</span>
                            <span className="activity-text">Sınav yayınlandı: <strong>Matematik Vize</strong></span>
                            <span className="activity-time">1 saat önce</span>
                        </div>
                        <div className="activity-item">
                            <span className="activity-icon">🎥</span>
                            <span className="activity-text">Canlı ders başlatıldı: <strong>Kimya Dersi</strong></span>
                            <span className="activity-time">2 saat önce</span>
                        </div>
                    </div>
                </section>

                {/* Quick Actions */}
                <section className="admin-section">
                    <h2>⚡ Hızlı İşlemler</h2>
                    <div className="quick-actions">
                        <Link to="/admin/users" className="action-btn">
                            <span className="action-icon">👤</span>
                            <span>Kullanıcı Ekle</span>
                        </Link>
                        <Link to="/classrooms/new" className="action-btn">
                            <span className="action-icon">🏫</span>
                            <span>Sınıf Oluştur</span>
                        </Link>
                        <Link to="/exams/new" className="action-btn">
                            <span className="action-icon">📋</span>
                            <span>Sınav Oluştur</span>
                        </Link>
                        <button className="action-btn">
                            <span className="action-icon">📊</span>
                            <span>Rapor İndir</span>
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export const AdminUsers: React.FC = () => {
    const [users, setUsers] = useState(mockUsers);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    const filteredUsers = users.filter(user => {
        const matchesSearch = (user.firstName + ' ' + user.lastName + ' ' + user.email)
            .toLowerCase()
            .includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const toggleUserStatus = (userId: string) => {
        setUsers(users.map(user =>
            user.id === userId ? { ...user, isActive: !user.isActive } : user
        ));
    };

    return (
        <div className="admin-page">
            <AdminSidebar />
            <div className="admin-content">
                <header className="admin-header">
                    <h1>👥 Kullanıcı Yönetimi</h1>
                    <p>Tüm kullanıcıları görüntüleyin ve yönetin</p>
                </header>

                {/* Filters */}
                <div className="filters-bar">
                    <input
                        type="text"
                        placeholder="Kullanıcı ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">Tüm Roller</option>
                        <option value="Student">Öğrenci</option>
                        <option value="Instructor">Eğitmen</option>
                        <option value="Admin">Admin</option>
                    </select>
                    <button className="add-user-btn">+ Kullanıcı Ekle</button>
                </div>

                {/* Users Table */}
                <div className="users-table-container">
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>Kullanıcı</th>
                                <th>E-posta</th>
                                <th>Rol</th>
                                <th>Durum</th>
                                <th>Kayıt Tarihi</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => (
                                <tr key={user.id}>
                                    <td>
                                        <div className="user-cell">
                                            <div className="user-avatar">
                                                {user.firstName[0]}{user.lastName[0]}
                                            </div>
                                            <span>{user.firstName} {user.lastName}</span>
                                        </div>
                                    </td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span className={`role-badge ${user.role.toLowerCase()}`}>
                                            {user.role === 'Student' ? 'Öğrenci' :
                                                user.role === 'Instructor' ? 'Eğitmen' : 'Admin'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                                            {user.isActive ? 'Aktif' : 'Pasif'}
                                        </span>
                                    </td>
                                    <td>{new Date(user.createdAt).toLocaleDateString('tr-TR')}</td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="action-btn-small" title="Düzenle">
                                                ✏️
                                            </button>
                                            <button
                                                className="action-btn-small"
                                                title={user.isActive ? 'Pasife Al' : 'Aktifleştir'}
                                                onClick={() => toggleUserStatus(user.id)}
                                            >
                                                {user.isActive ? '🚫' : '✓'}
                                            </button>
                                            <button className="action-btn-small delete" title="Sil">
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="pagination">
                    <button disabled>← Önceki</button>
                    <span>Sayfa 1 / 1</span>
                    <button disabled>Sonraki →</button>
                </div>
            </div>
        </div>
    );
};
