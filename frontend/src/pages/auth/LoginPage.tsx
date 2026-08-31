import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Input, Card } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import './Auth.css';

export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isLoading, error, clearError } = useAuthStore();
    const notice = (location.state as { notice?: string } | null)?.notice;
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        try {
            await login(formData.email, formData.password);
            const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
            navigate(from && from.startsWith('/app') ? from : '/app/dashboard');
        } catch {
            // Error handled by store
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
                        <h1 className="auth-title">Hoş Geldiniz</h1>
                        <p className="auth-subtitle">Hesabınıza giriş yapın</p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        {notice && !error && (
                            <div className="auth-notice">
                                {notice}
                            </div>
                        )}

                        {error && (
                            <div className="auth-error">
                                {error}
                            </div>
                        )}

                        <Input
                            label="E-posta"
                            type="email"
                            name="email"
                            placeholder="ornek@email.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />

                        <Input
                            label="Şifre"
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            value={formData.password}
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
                            Giriş Yap
                        </Button>
                    </form>

                    <div className="auth-footer">
                        <p>
                            <Link to="/forgot-password">Parolamı unuttum</Link>
                        </p>
                        <p>
                            Hesabınız yok mu?{' '}
                            <Link to="/register">Kayıt Olun</Link>
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default LoginPage;
