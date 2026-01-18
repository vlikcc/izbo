import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import './Auth.css';

// Forgot Password Page
export const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // API call would go here
            // await authApi.forgotPassword({ email });
            setTimeout(() => {
                setSubmitted(true);
                setLoading(false);
            }, 1500);
        } catch {
            setError('Bir hata oluştu. Lütfen tekrar deneyin.');
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-background">
                <div className="auth-shape shape-1"></div>
                <div className="auth-shape shape-2"></div>
                <div className="auth-shape shape-3"></div>
            </div>

            <div className="auth-card">
                <div className="auth-header">
                    <h1>📚 EduPlatform</h1>
                    <p>Eğitim ve Sınav Platformu</p>
                </div>

                {submitted ? (
                    <div className="auth-form">
                        <div className="success-message">
                            <span className="success-icon">✓</span>
                            <h2>E-posta Gönderildi!</h2>
                            <p>
                                Şifre sıfırlama bağlantısı <strong>{email}</strong> adresine gönderildi.
                                Lütfen gelen kutunuzu kontrol edin.
                            </p>
                            <Link to="/login" className="auth-btn">
                                Giriş Sayfasına Dön
                            </Link>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <h2>Şifremi Unuttum</h2>
                        <p className="auth-subtitle">
                            E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.
                        </p>

                        {error && <div className="auth-error">{error}</div>}

                        <div className="form-group">
                            <label htmlFor="email">E-posta</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ornek@email.com"
                                required
                            />
                        </div>

                        <button type="submit" className="auth-btn" disabled={loading}>
                            {loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
                        </button>

                        <p className="auth-link">
                            <Link to="/login">← Giriş sayfasına dön</Link>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
};

export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { setAuth } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authApi.login({ email, password });
            if (response.data.success && response.data.data) {
                const { user, accessToken, refreshToken } = response.data.data;
                setAuth(user, accessToken, refreshToken);
                navigate('/dashboard');
            } else {
                setError(response.data.message || 'Giriş başarısız');
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            setError(error.response?.data?.message || 'Giriş yapılırken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-background">
                <div className="auth-shape shape-1"></div>
                <div className="auth-shape shape-2"></div>
                <div className="auth-shape shape-3"></div>
            </div>

            <div className="auth-card">
                <div className="auth-header">
                    <h1>📚 EduPlatform</h1>
                    <p>Eğitim ve Sınav Platformu</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <h2>Giriş Yap</h2>

                    {error && <div className="auth-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="email">E-posta</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ornek@email.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Şifre</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                    </button>

                    <p className="auth-link forgot">
                        <Link to="/forgot-password">Şifremi Unuttum</Link>
                    </p>

                    <p className="auth-link">
                        Hesabınız yok mu? <Link to="/register">Kayıt Ol</Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const { setAuth } = useAuthStore();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'Student' as 'Student' | 'Instructor',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Şifreler eşleşmiyor');
            return;
        }

        setLoading(true);

        try {
            const response = await authApi.register({
                email: formData.email,
                password: formData.password,
                firstName: formData.firstName,
                lastName: formData.lastName,
                role: formData.role,
            });

            if (response.data.success && response.data.data) {
                const { user, accessToken, refreshToken } = response.data.data;
                setAuth(user, accessToken, refreshToken);
                navigate('/dashboard');
            } else {
                setError(response.data.message || 'Kayıt başarısız');
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            setError(error.response?.data?.message || 'Kayıt olurken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-background">
                <div className="auth-shape shape-1"></div>
                <div className="auth-shape shape-2"></div>
                <div className="auth-shape shape-3"></div>
            </div>

            <div className="auth-card">
                <div className="auth-header">
                    <h1>📚 EduPlatform</h1>
                    <p>Eğitim ve Sınav Platformu</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <h2>Kayıt Ol</h2>

                    {error && <div className="auth-error">{error}</div>}

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="firstName">Ad</label>
                            <input
                                type="text"
                                id="firstName"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                placeholder="Adınız"
                                required
                                autoComplete="given-name"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="lastName">Soyad</label>
                            <input
                                type="text"
                                id="lastName"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                placeholder="Soyadınız"
                                required
                                autoComplete="family-name"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">E-posta</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="ornek@email.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Şifre</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            minLength={6}
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Şifre Tekrar</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="••••••••"
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="role">Hesap Türü</label>
                        <select
                            id="role"
                            name="role"
                            value={formData.role}
                            onChange={handleChange}
                            className="form-select"
                        >
                            <option value="Student">Öğrenci</option>
                            <option value="Instructor">Öğretmen</option>
                        </select>
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
                    </button>

                    <p className="auth-link">
                        Zaten hesabınız var mı? <Link to="/login">Giriş Yap</Link>
                    </p>
                </form>
            </div>
        </div>
    );
};
