import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Card } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { PASSWORD_HINT, validatePassword } from '../../utils/passwordPolicy';
import './Auth.css';

export const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const { register, isLoading, error, clearError } = useAuthStore();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'Student',
    });
    const [validationError, setValidationError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        setValidationError('');

        if (formData.password !== formData.confirmPassword) {
            setValidationError('Parolalar eşleşmiyor');
            return;
        }

        const passwordError = validatePassword(formData.password);
        if (passwordError) {
            setValidationError(passwordError);
            return;
        }

        try {
            const message = await register({
                email: formData.email,
                password: formData.password,
                firstName: formData.firstName,
                lastName: formData.lastName,
                role: formData.role,
            });

            // Registration issues no session, so the next step is signing in.
            navigate('/login', { state: { notice: message } });
        } catch {
            // Error handled by store
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    return (
        <div className="auth-page">
            <div className="auth-background">
                <div className="auth-gradient-orb auth-gradient-orb-1" />
                <div className="auth-gradient-orb auth-gradient-orb-2" />
            </div>

            <div className="auth-container animate-slideUp">
                <Card variant="glass" padding="lg" className="auth-card">
                    <div className="auth-header">
                        <div className="auth-logo">
                            <span className="auth-logo-icon">📚</span>
                            <span className="auth-logo-text">EduPlatform</span>
                        </div>
                        <h1 className="auth-title">Hesap Oluştur</h1>
                        <p className="auth-subtitle">Öğrenmeye başlamak için kayıt olun</p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        {(error || validationError) && (
                            <div className="auth-error">
                                {error || validationError}
                            </div>
                        )}

                        <div className="auth-row">
                            <Input
                                label="Ad"
                                type="text"
                                name="firstName"
                                placeholder="Adınız"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                            />
                            <Input
                                label="Soyad"
                                type="text"
                                name="lastName"
                                placeholder="Soyadınız"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <Input
                            label="E-posta"
                            type="email"
                            name="email"
                            placeholder="ornek@email.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />

                        <div className="input-wrapper">
                            <label className="input-label">Rol</label>
                            <select
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                className="auth-select"
                            >
                                <option value="Student">Öğrenci</option>
                                <option value="Instructor">Eğitmen</option>
                            </select>
                        </div>

                        <Input
                            label="Şifre"
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                            helperText={PASSWORD_HINT}
                            required
                        />

                        <Input
                            label="Şifre Tekrar"
                            type="password"
                            name="confirmPassword"
                            placeholder="••••••••"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                        />

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            fullWidth
                            isLoading={isLoading}
                        >
                            Kayıt Ol
                        </Button>
                    </form>

                    <div className="auth-footer">
                        <p>
                            Zaten hesabınız var mı?{' '}
                            <Link to="/login">Giriş Yapın</Link>
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default RegisterPage;
