import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

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
        <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center p-4">
            {/* Background Decorations */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-rose-200/30 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-200/30 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md relative">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-rose-100 p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-rose-400 to-rose-500 rounded-2xl mb-4 shadow-lg shadow-rose-200">
                            <span className="text-3xl">🎓</span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">
                            İzbo
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Eğitim ve Sınav Platformu</p>
                    </div>

                    {submitted ? (
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
                                <span className="text-3xl text-emerald-500">✓</span>
                            </div>
                            <h2 className="text-xl font-semibold text-gray-800 mb-2">E-posta Gönderildi!</h2>
                            <p className="text-gray-500 mb-6">
                                Şifre sıfırlama bağlantısı <strong className="text-gray-700">{email}</strong> adresine gönderildi.
                            </p>
                            <Link
                                to="/login"
                                className="inline-flex items-center justify-center w-full px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                            >
                                Giriş Sayfasına Dön
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-semibold text-gray-800">Şifremi Unuttum</h2>
                                <p className="text-gray-500 text-sm mt-1">
                                    E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.
                                </p>
                            </div>

                            {error && (
                                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                    E-posta
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ornek@email.com"
                                    required
                                    className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading}
                            >
                                {loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
                            </button>

                            <p className="text-center text-sm text-gray-500">
                                <Link to="/login" className="text-rose-500 hover:text-rose-600 font-medium">
                                    ← Giriş sayfasına dön
                                </Link>
                            </p>
                        </form>
                    )}
                </div>
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
        <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center p-4">
            {/* Background Decorations */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-rose-200/30 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-200/30 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md relative">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-rose-100 p-10">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-rose-400 to-rose-500 rounded-2xl mb-4 shadow-lg shadow-rose-200">
                            <span className="text-3xl">🎓</span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">
                            İzbo
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Eğitim ve Sınav Platformu</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <h2 className="text-xl font-semibold text-gray-800 text-center">Giriş Yap</h2>

                        {error && (
                            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                E-posta
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ornek@email.com"
                                required
                                autoComplete="email"
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Şifre
                            </label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                        </button>

                        <div className="text-center space-y-3 pt-2">
                            <Link to="/forgot-password" className="text-sm text-rose-500 hover:text-rose-600 font-medium">
                                Şifremi Unuttum
                            </Link>
                            <p className="text-sm text-gray-500">
                                Hesabınız yok mu?{' '}
                                <Link to="/register" className="text-rose-500 hover:text-rose-600 font-medium">
                                    Kayıt Ol
                                </Link>
                            </p>
                        </div>
                    </form>
                </div>
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
        <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center p-4">
            {/* Background Decorations */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-rose-200/30 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-200/30 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md relative">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-rose-100 p-10">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-rose-400 to-rose-500 rounded-2xl mb-4 shadow-lg shadow-rose-200">
                            <span className="text-3xl">🎓</span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">
                            İzbo
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Eğitim ve Sınav Platformu</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <h2 className="text-xl font-semibold text-gray-800 text-center">Kayıt Ol</h2>

                        {error && (
                            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                                    Ad
                                </label>
                                <input
                                    type="text"
                                    id="firstName"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    placeholder="Adınız"
                                    required
                                    autoComplete="given-name"
                                    className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                />
                            </div>
                            <div>
                                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                                    Soyad
                                </label>
                                <input
                                    type="text"
                                    id="lastName"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    placeholder="Soyadınız"
                                    required
                                    autoComplete="family-name"
                                    className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                E-posta
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="ornek@email.com"
                                required
                                autoComplete="email"
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                        </div>

                        <div>
                            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                                Hesap Türü
                            </label>
                            <select
                                id="role"
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all cursor-pointer"
                            >
                                <option value="Student">Öğrenci</option>
                                <option value="Instructor">Eğitmen</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Şifre
                            </label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                required
                                autoComplete="new-password"
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                Şifre Tekrar
                            </label>
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="••••••••"
                                required
                                autoComplete="new-password"
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
                        </button>

                        <p className="text-center text-sm text-gray-500">
                            Zaten hesabınız var mı?{' '}
                            <Link to="/login" className="text-rose-500 hover:text-rose-600 font-medium">
                                Giriş Yap
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};
