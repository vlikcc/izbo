import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

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
        <nav className="w-64 bg-white border-r border-rose-100 p-4 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 px-3">Admin Paneli</h3>
            <ul className="space-y-1">
                {menuItems.map((item) => (
                    <li key={item.path}>
                        <Link
                            to={item.path}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                                location.pathname === item.path 
                                    ? 'bg-rose-500 text-white' 
                                    : 'text-gray-600 hover:bg-rose-50 hover:text-rose-600'
                            }`}
                        >
                            <span>{item.icon}</span>
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
        <div className="flex min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50">
            <AdminSidebar />
            <div className="flex-1 p-6 lg:p-8 overflow-auto">
                <header className="mb-8">
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                        📊 Admin Dashboard
                    </h1>
                    <p className="text-gray-500 mt-1">Sistem genel bakış ve istatistikleri</p>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                    <div className="bg-white rounded-2xl border border-rose-100 p-4">
                        <span className="text-2xl mb-2 block">👥</span>
                        <span className="text-2xl font-bold text-gray-900">{mockStats.totalUsers.toLocaleString()}</span>
                        <span className="text-gray-500 text-sm block">Toplam Kullanıcı</span>
                    </div>
                    <div className="bg-white rounded-2xl border border-rose-100 p-4">
                        <span className="text-2xl mb-2 block text-emerald-500">✓</span>
                        <span className="text-2xl font-bold text-gray-900">{mockStats.activeUsers.toLocaleString()}</span>
                        <span className="text-gray-500 text-sm block">Aktif Kullanıcı</span>
                    </div>
                    <div className="bg-white rounded-2xl border border-rose-100 p-4">
                        <span className="text-2xl mb-2 block">🏫</span>
                        <span className="text-2xl font-bold text-gray-900">{mockStats.totalClassrooms}</span>
                        <span className="text-gray-500 text-sm block">Sınıf</span>
                    </div>
                    <div className="bg-white rounded-2xl border border-rose-100 p-4">
                        <span className="text-2xl mb-2 block">📋</span>
                        <span className="text-2xl font-bold text-gray-900">{mockStats.totalExams}</span>
                        <span className="text-gray-500 text-sm block">Sınav</span>
                    </div>
                    <div className="bg-white rounded-2xl border border-rose-100 p-4">
                        <span className="text-2xl mb-2 block">📝</span>
                        <span className="text-2xl font-bold text-gray-900">{mockStats.totalHomework.toLocaleString()}</span>
                        <span className="text-gray-500 text-sm block">Ödev</span>
                    </div>
                    <div className="bg-gradient-to-r from-rose-500 to-rose-400 rounded-2xl p-4 text-white">
                        <span className="text-2xl mb-2 block">🔴</span>
                        <span className="text-2xl font-bold">{mockStats.liveSessions}</span>
                        <span className="text-rose-100 text-sm block">Canlı Ders</span>
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Recent Activity */}
                    <div className="bg-white rounded-2xl border border-rose-100 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            📈 Son Aktiviteler
                        </h2>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-xl">
                                <span className="text-xl">👤</span>
                                <span className="flex-1 text-gray-700">Yeni kullanıcı kaydı: <strong>Ali Öz</strong></span>
                                <span className="text-sm text-gray-500">5 dk önce</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-xl">
                                <span className="text-xl">🏫</span>
                                <span className="flex-1 text-gray-700">Yeni sınıf oluşturuldu: <strong>Fizik 101</strong></span>
                                <span className="text-sm text-gray-500">15 dk önce</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-xl">
                                <span className="text-xl">📋</span>
                                <span className="flex-1 text-gray-700">Sınav yayınlandı: <strong>Matematik Vize</strong></span>
                                <span className="text-sm text-gray-500">1 saat önce</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-xl">
                                <span className="text-xl">🎥</span>
                                <span className="flex-1 text-gray-700">Canlı ders başlatıldı: <strong>Kimya Dersi</strong></span>
                                <span className="text-sm text-gray-500">2 saat önce</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-2xl border border-rose-100 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            ⚡ Hızlı İşlemler
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            <Link to="/admin/users" className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors">
                                <span className="text-2xl">👤</span>
                                <span className="font-medium text-gray-700">Kullanıcı Ekle</span>
                            </Link>
                            <Link to="/classrooms/new" className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors">
                                <span className="text-2xl">🏫</span>
                                <span className="font-medium text-gray-700">Sınıf Oluştur</span>
                            </Link>
                            <Link to="/exams/new" className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors">
                                <span className="text-2xl">📋</span>
                                <span className="font-medium text-gray-700">Sınav Oluştur</span>
                            </Link>
                            <button className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors">
                                <span className="text-2xl">📊</span>
                                <span className="font-medium text-gray-700">Rapor İndir</span>
                            </button>
                        </div>
                    </div>
                </div>
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
        <div className="flex min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50">
            <AdminSidebar />
            <div className="flex-1 p-6 lg:p-8 overflow-auto">
                <header className="mb-8">
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                        👥 Kullanıcı Yönetimi
                    </h1>
                    <p className="text-gray-500 mt-1">Tüm kullanıcıları görüntüleyin ve yönetin</p>
                </header>

                {/* Filters */}
                <div className="flex flex-wrap gap-4 mb-6">
                    <input
                        type="text"
                        placeholder="Kullanıcı ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 min-w-[200px] px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                    />
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-700 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                    >
                        <option value="all">Tüm Roller</option>
                        <option value="Student">Öğrenci</option>
                        <option value="Instructor">Eğitmen</option>
                        <option value="Admin">Admin</option>
                    </select>
                    <button className="px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200">
                        + Kullanıcı Ekle
                    </button>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-2xl border border-rose-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-rose-50">
                                    <th className="text-left px-6 py-4 font-medium text-gray-600">Kullanıcı</th>
                                    <th className="text-left px-6 py-4 font-medium text-gray-600">E-posta</th>
                                    <th className="text-left px-6 py-4 font-medium text-gray-600">Rol</th>
                                    <th className="text-left px-6 py-4 font-medium text-gray-600">Durum</th>
                                    <th className="text-left px-6 py-4 font-medium text-gray-600">Kayıt Tarihi</th>
                                    <th className="text-left px-6 py-4 font-medium text-gray-600">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="border-t border-rose-50 hover:bg-rose-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-rose-500 rounded-full flex items-center justify-center text-white font-medium">
                                                    {user.firstName[0]}{user.lastName[0]}
                                                </div>
                                                <span className="font-medium text-gray-900">{user.firstName} {user.lastName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{user.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                                                user.role === 'Student' ? 'bg-blue-100 text-blue-600' :
                                                user.role === 'Instructor' ? 'bg-purple-100 text-purple-600' :
                                                'bg-rose-100 text-rose-600'
                                            }`}>
                                                {user.role === 'Student' ? 'Öğrenci' :
                                                    user.role === 'Instructor' ? 'Eğitmen' : 'Admin'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                                                user.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {user.isActive ? 'Aktif' : 'Pasif'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{new Date(user.createdAt).toLocaleDateString('tr-TR')}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button className="w-8 h-8 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors" title="Düzenle">
                                                    ✏️
                                                </button>
                                                <button
                                                    className="w-8 h-8 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors"
                                                    title={user.isActive ? 'Pasife Al' : 'Aktifleştir'}
                                                    onClick={() => toggleUserStatus(user.id)}
                                                >
                                                    {user.isActive ? '🚫' : '✓'}
                                                </button>
                                                <button className="w-8 h-8 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors" title="Sil">
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-center gap-4 mt-6">
                    <button className="px-4 py-2 bg-white border border-rose-100 text-gray-500 rounded-xl disabled:opacity-50" disabled>
                        ← Önceki
                    </button>
                    <span className="text-gray-600">Sayfa 1 / 1</span>
                    <button className="px-4 py-2 bg-white border border-rose-100 text-gray-500 rounded-xl disabled:opacity-50" disabled>
                        Sonraki →
                    </button>
                </div>
            </div>
        </div>
    );
};
