import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import './Profile.css';

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
            // API call to update profile would go here
            // For now, we'll simulate success
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
            // API call to change password would go here
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
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <header className="profile-header">
                <h1>👤 Profilim</h1>
                <p>Hesap bilgilerinizi görüntüleyin ve düzenleyin</p>
            </header>

            {message && (
                <div className={`message ${message.type}`}>
                    {message.type === 'success' ? '✓' : '✕'} {message.text}
                </div>
            )}

            {/* Profile Stats */}
            <div className="profile-stats">
                <div className="stat-item">
                    <span className="stat-icon">🏫</span>
                    <span className="stat-value">5</span>
                    <span className="stat-label">Sınıf</span>
                </div>
                <div className="stat-item">
                    <span className="stat-icon">📝</span>
                    <span className="stat-value">12</span>
                    <span className="stat-label">Ödev</span>
                </div>
                <div className="stat-item">
                    <span className="stat-icon">📋</span>
                    <span className="stat-value">8</span>
                    <span className="stat-label">Sınav</span>
                </div>
                <div className="stat-item">
                    <span className="stat-icon">🎥</span>
                    <span className="stat-value">24</span>
                    <span className="stat-label">Canlı Ders</span>
                </div>
            </div>

            {/* Profile Info Card */}
            <div className="profile-card">
                <h2>📋 Profil Bilgileri</h2>

                <div className="profile-avatar-section">
                    <div className="profile-avatar">
                        {user.profileImageUrl ? (
                            <img src={user.profileImageUrl} alt="Profil" />
                        ) : (
                            `${user.firstName[0]}${user.lastName[0]}`
                        )}
                        <div className="avatar-upload">📷 Değiştir</div>
                    </div>
                    <div className="avatar-info">
                        <h3>{user.firstName} {user.lastName}</h3>
                        <p>{user.email}</p>
                        <span className="role-badge">{user.role}</span>
                    </div>
                </div>

                <form onSubmit={handleSaveProfile} className="profile-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="firstName">Ad</label>
                            <input
                                type="text"
                                id="firstName"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleInputChange}
                                disabled={!isEditing}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="lastName">Soyad</label>
                            <input
                                type="text"
                                id="lastName"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleInputChange}
                                disabled={!isEditing}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="email">E-posta</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                disabled={!isEditing}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="phoneNumber">Telefon</label>
                            <input
                                type="tel"
                                id="phoneNumber"
                                name="phoneNumber"
                                value={formData.phoneNumber}
                                onChange={handleInputChange}
                                placeholder="(5xx) xxx xx xx"
                                disabled={!isEditing}
                            />
                        </div>
                    </div>

                    <div className="form-actions">
                        {isEditing ? (
                            <>
                                <button
                                    type="button"
                                    className="btn-secondary"
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
                                <button type="submit" className="btn-primary" disabled={loading}>
                                    {loading ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => setIsEditing(true)}
                            >
                                Düzenle
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Password Change Card */}
            <div className="profile-card password-section">
                <h2>🔒 Şifre Değiştir</h2>

                <form onSubmit={handleChangePassword} className="profile-form">
                    <div className="form-group">
                        <label htmlFor="currentPassword">Mevcut Şifre</label>
                        <input
                            type="password"
                            id="currentPassword"
                            name="currentPassword"
                            value={passwordData.currentPassword}
                            onChange={handlePasswordChange}
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="newPassword">Yeni Şifre</label>
                        <input
                            type="password"
                            id="newPassword"
                            name="newPassword"
                            value={passwordData.newPassword}
                            onChange={handlePasswordChange}
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={passwordData.confirmPassword}
                            onChange={handlePasswordChange}
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
