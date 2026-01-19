import React, { useState } from 'react';
import { Card, Button, Input, Modal } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { userService } from '../../services/user.service';
import './Profile.css';

export const ProfilePage: React.FC = () => {
    const { user, checkAuth } = useAuthStore();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [editForm, setEditForm] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        phoneNumber: user?.phoneNumber || '',
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasswordForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            await userService.updateProfile(editForm);
            await checkAuth();
            setSuccess('Profil başarıyla güncellendi!');
            setIsEditModalOpen(false);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Güncelleme başarısız');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setError('Şifreler eşleşmiyor');
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            setError('Şifre en az 6 karakter olmalıdır');
            return;
        }

        setIsSubmitting(true);

        try {
            await userService.changePassword({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword,
            });
            setSuccess('Şifre başarıyla değiştirildi!');
            setIsPasswordModalOpen(false);
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Şifre değiştirilemedi');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditModal = () => {
        setEditForm({
            firstName: user?.firstName || '',
            lastName: user?.lastName || '',
            phoneNumber: user?.phoneNumber || '',
        });
        setError('');
        setIsEditModalOpen(true);
    };

    const openPasswordModal = () => {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setError('');
        setIsPasswordModalOpen(true);
    };

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <h1 className="page-title">👤 Profil</h1>
                <p className="page-subtitle">Hesap ayarlarınız</p>
            </div>

            {success && (
                <div className="profile-success">{success}</div>
            )}

            <div className="profile-grid">
                <Card variant="default" padding="lg" className="profile-card animate-slideUp">
                    <div className="profile-avatar">
                        <div className="profile-avatar-circle">
                            {user?.firstName?.charAt(0) || '?'}
                            {user?.lastName?.charAt(0) || ''}
                        </div>
                        <Button variant="ghost" size="sm">Fotoğraf Değiştir</Button>
                    </div>

                    <div className="profile-info">
                        <div className="profile-field">
                            <label className="profile-label">Ad</label>
                            <span className="profile-value">{user?.firstName || '-'}</span>
                        </div>
                        <div className="profile-field">
                            <label className="profile-label">Soyad</label>
                            <span className="profile-value">{user?.lastName || '-'}</span>
                        </div>
                        <div className="profile-field">
                            <label className="profile-label">E-posta</label>
                            <span className="profile-value">{user?.email || '-'}</span>
                        </div>
                        <div className="profile-field">
                            <label className="profile-label">Rol</label>
                            <span className="profile-value profile-role">
                                {user?.role === 'Student' && '📚 Öğrenci'}
                                {user?.role === 'Instructor' && '👨‍🏫 Eğitmen'}
                                {user?.role === 'Admin' && '🔧 Admin'}
                                {user?.role === 'SuperAdmin' && '🛡️ Süper Admin'}
                            </span>
                        </div>
                    </div>

                    <div className="profile-actions">
                        <Button variant="outline" size="md" onClick={openEditModal}>
                            Profili Düzenle
                        </Button>
                        <Button variant="ghost" size="md" onClick={openPasswordModal}>
                            Şifre Değiştir
                        </Button>
                    </div>
                </Card>

                <Card variant="default" padding="lg" className="profile-card animate-slideUp" style={{ animationDelay: '0.1s' }}>
                    <h3 className="profile-section-title">🔔 Bildirim Tercihleri</h3>

                    <div className="profile-settings">
                        <div className="profile-setting">
                            <div className="profile-setting-info">
                                <span className="profile-setting-label">E-posta Bildirimleri</span>
                                <span className="profile-setting-desc">Yeni ödev ve dersler için e-posta alın</span>
                            </div>
                            <label className="profile-toggle">
                                <input type="checkbox" defaultChecked />
                                <span className="profile-toggle-slider" />
                            </label>
                        </div>
                        <div className="profile-setting">
                            <div className="profile-setting-info">
                                <span className="profile-setting-label">Tarayıcı Bildirimleri</span>
                                <span className="profile-setting-desc">Anlık bildirimler alın</span>
                            </div>
                            <label className="profile-toggle">
                                <input type="checkbox" />
                                <span className="profile-toggle-slider" />
                            </label>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Edit Profile Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Profili Düzenle">
                <form onSubmit={handleEditSubmit} className="modal-form">
                    {error && <div className="auth-error">{error}</div>}

                    <Input
                        label="Ad"
                        name="firstName"
                        value={editForm.firstName}
                        onChange={handleEditChange}
                        required
                    />
                    <Input
                        label="Soyad"
                        name="lastName"
                        value={editForm.lastName}
                        onChange={handleEditChange}
                        required
                    />
                    <Input
                        label="Telefon"
                        name="phoneNumber"
                        value={editForm.phoneNumber}
                        onChange={handleEditChange}
                        placeholder="+90 5XX XXX XX XX"
                    />

                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>
                            İptal
                        </Button>
                        <Button type="submit" variant="primary" isLoading={isSubmitting}>
                            Kaydet
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Change Password Modal */}
            <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} title="Şifre Değiştir">
                <form onSubmit={handlePasswordSubmit} className="modal-form">
                    {error && <div className="auth-error">{error}</div>}

                    <Input
                        label="Mevcut Şifre"
                        type="password"
                        name="currentPassword"
                        value={passwordForm.currentPassword}
                        onChange={handlePasswordChange}
                        required
                    />
                    <Input
                        label="Yeni Şifre"
                        type="password"
                        name="newPassword"
                        value={passwordForm.newPassword}
                        onChange={handlePasswordChange}
                        required
                    />
                    <Input
                        label="Yeni Şifre (Tekrar)"
                        type="password"
                        name="confirmPassword"
                        value={passwordForm.confirmPassword}
                        onChange={handlePasswordChange}
                        required
                    />

                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={() => setIsPasswordModalOpen(false)}>
                            İptal
                        </Button>
                        <Button type="submit" variant="primary" isLoading={isSubmitting}>
                            Değiştir
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ProfilePage;
