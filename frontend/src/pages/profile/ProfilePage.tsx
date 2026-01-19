import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

export const ProfilePage: React.FC = () => {
    const { user } = useAuthStore();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [formData, setFormData] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        phoneNumber: user?.phoneNumber || '',
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            setTimeout(() => {
                setMessage({ type: 'success', text: 'Profil bilgileri başarıyla güncellendi!' });
                setIsEditing(false);
                setLoading(false);
            }, 1000);
        } catch {
            setMessage({ type: 'error', text: 'Profil güncellenirken bir hata oluştu.' });
            setLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: 'Yeni şifreler eşleşmiyor!' });
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Şifre en az 6 karakter olmalıdır!' });
            return;
        }

        setLoading(true);

        try {
            setTimeout(() => {
                setMessage({ type: 'success', text: 'Şifre başarıyla değiştirildi!' });
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setLoading(false);
            }, 1000);
        } catch {
            setMessage({ type: 'error', text: 'Şifre değiştirilirken bir hata oluştu.' });
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 min-h-screen">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                    👤 Profilim
                </h1>
                <p className="text-gray-500 mt-1">Hesap bilgilerinizi görüntüleyin ve düzenleyin</p>
            </header>

            {/* Message */}
            {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                    message.type === 'success' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                    {message.type === 'success' ? '✓' : '✕'} {message.text}
                </div>
            )}

            {/* Profile Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-2xl border border-rose-100 p-5 text-center">
                    <span className="text-3xl mb-2 block">🏫</span>
                    <span className="text-2xl font-bold text-gray-900 block">5</span>
                    <span className="text-sm text-gray-500">Sınıf</span>
                </div>
                <div className="bg-white rounded-2xl border border-rose-100 p-5 text-center">
                    <span className="text-3xl mb-2 block">📝</span>
                    <span className="text-2xl font-bold text-gray-900 block">12</span>
                    <span className="text-sm text-gray-500">Ödev</span>
                </div>
                <div className="bg-white rounded-2xl border border-rose-100 p-5 text-center">
                    <span className="text-3xl mb-2 block">📋</span>
                    <span className="text-2xl font-bold text-gray-900 block">8</span>
                    <span className="text-sm text-gray-500">Sınav</span>
                </div>
                <div className="bg-white rounded-2xl border border-rose-100 p-5 text-center">
                    <span className="text-3xl mb-2 block">🎥</span>
                    <span className="text-2xl font-bold text-gray-900 block">24</span>
                    <span className="text-sm text-gray-500">Canlı Ders</span>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Profile Info Card */}
                <div className="bg-white rounded-2xl border border-rose-100 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                        📋 Profil Bilgileri
                    </h2>

                    {/* Avatar Section */}
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-rose-100">
                        <div className="relative">
                            <div className="w-20 h-20 bg-gradient-to-br from-rose-400 to-rose-500 rounded-full flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                                {user.profileImageUrl ? (
                                    <img src={user.profileImageUrl} alt="Profil" className="w-full h-full object-cover" />
                                ) : (
                                    `${(user.firstName || 'U')[0]}${(user.lastName || 'U')[0]}`
                                )}
                            </div>
                            <button className="absolute -bottom-1 -right-1 w-8 h-8 bg-white border border-rose-200 rounded-full flex items-center justify-center text-sm hover:bg-rose-50 transition-colors">
                                📷
                            </button>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900">{user.firstName} {user.lastName}</h3>
                            <p className="text-gray-500">{user.email}</p>
                            <span className="inline-block mt-2 px-3 py-1 bg-rose-100 text-rose-600 text-sm font-medium rounded-full">
                                {user.role}
                            </span>
                        </div>
                    </div>

                    {/* Profile Form */}
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">Ad</label>
                                <input
                                    type="text"
                                    id="firstName"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleInputChange}
                                    disabled={!isEditing}
                                    className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">Soyad</label>
                                <input
                                    type="text"
                                    id="lastName"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleInputChange}
                                    disabled={!isEditing}
                                    className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">E-posta</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    disabled={!isEditing}
                                    className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">Telefon</label>
                                <input
                                    type="tel"
                                    id="phoneNumber"
                                    name="phoneNumber"
                                    value={formData.phoneNumber}
                                    onChange={handleInputChange}
                                    placeholder="(5xx) xxx xx xx"
                                    disabled={!isEditing}
                                    className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            {isEditing ? (
                                <>
                                    <button
                                        type="button"
                                        className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setFormData({
                                                firstName: user.firstName,
                                                lastName: user.lastName,
                                                email: user.email,
                                                phoneNumber: user.phoneNumber || '',
                                            });
                                        }}
                                    >
                                        İptal
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
                                        disabled={loading}
                                    >
                                        {loading ? 'Kaydediliyor...' : 'Kaydet'}
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className="w-full px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                                    onClick={() => setIsEditing(true)}
                                >
                                    Düzenle
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Password Change Card */}
                <div className="bg-white rounded-2xl border border-rose-100 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                        🔒 Şifre Değiştir
                    </h2>

                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">Mevcut Şifre</label>
                            <input
                                type="password"
                                id="currentPassword"
                                name="currentPassword"
                                value={passwordData.currentPassword}
                                onChange={handlePasswordChange}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                        </div>

                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">Yeni Şifre</label>
                            <input
                                type="password"
                                id="newPassword"
                                name="newPassword"
                                value={passwordData.newPassword}
                                onChange={handlePasswordChange}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">Yeni Şifre (Tekrar)</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                value={passwordData.confirmPassword}
                                onChange={handlePasswordChange}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                        </div>

                        <div className="pt-4">
                            <button 
                                type="submit" 
                                className="w-full px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
