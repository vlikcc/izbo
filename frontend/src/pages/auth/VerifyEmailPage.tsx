import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../services/api';

export const VerifyEmailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');
    
    const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'no-token'>('verifying');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('no-token');
            return;
        }

        verifyEmail();
    }, [token]);

    const verifyEmail = async () => {
        try {
            const response = await authApi.verifyEmail(token!);
            if (response.data.success) {
                setStatus('success');
                setMessage('E-posta adresiniz başarıyla doğrulandı!');
                setTimeout(() => navigate('/login'), 3000);
            } else {
                setStatus('error');
                setMessage(response.data.message || 'Doğrulama başarısız oldu');
            }
        } catch (error: any) {
            setStatus('error');
            setMessage(error.response?.data?.message || 'Doğrulama bağlantısı geçersiz veya süresi dolmuş');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center p-4">
            {/* Background Decorations */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-rose-200/30 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-200/30 rounded-full blur-3xl"></div>
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

                    <div className="text-center">
                        {status === 'verifying' && (
                            <div className="py-8">
                                <div className="w-12 h-12 mx-auto mb-4 border-4 border-rose-100 border-t-rose-500 rounded-full animate-spin"></div>
                                <h2 className="text-xl font-semibold text-gray-800 mb-2">E-posta Doğrulanıyor...</h2>
                                <p className="text-gray-500">Lütfen bekleyin</p>
                            </div>
                        )}

                        {status === 'success' && (
                            <div className="py-6">
                                <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <span className="text-3xl text-emerald-500">✓</span>
                                </div>
                                <h2 className="text-xl font-semibold text-gray-800 mb-2">Doğrulama Başarılı!</h2>
                                <p className="text-gray-500 mb-2">{message}</p>
                                <p className="text-sm text-rose-500 mb-6">Giriş sayfasına yönlendiriliyorsunuz...</p>
                                <Link 
                                    to="/login" 
                                    className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                                >
                                    Hemen Giriş Yap
                                </Link>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="py-6">
                                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                                    <span className="text-3xl text-red-500">✕</span>
                                </div>
                                <h2 className="text-xl font-semibold text-gray-800 mb-2">Doğrulama Başarısız</h2>
                                <p className="text-gray-500 mb-6">{message}</p>
                                <div className="space-y-3">
                                    <Link 
                                        to="/resend-verification" 
                                        className="block w-full px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                                    >
                                        Yeni Doğrulama E-postası Gönder
                                    </Link>
                                    <Link 
                                        to="/login" 
                                        className="block text-rose-500 hover:text-rose-600 font-medium"
                                    >
                                        Giriş Sayfasına Dön
                                    </Link>
                                </div>
                            </div>
                        )}

                        {status === 'no-token' && (
                            <div className="py-6">
                                <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                                    <span className="text-3xl">⚠️</span>
                                </div>
                                <h2 className="text-xl font-semibold text-gray-800 mb-2">Geçersiz Bağlantı</h2>
                                <p className="text-gray-500 mb-6">Doğrulama bağlantısı eksik veya hatalı.</p>
                                <Link 
                                    to="/resend-verification" 
                                    className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                                >
                                    Yeni Doğrulama E-postası Gönder
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ResendVerificationPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authApi.resendVerification(email);
            if (response.data.success) {
                setSent(true);
            } else {
                setError(response.data.message || 'E-posta gönderilemedi');
            }
        } catch {
            setSent(true);
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

                    {sent ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 mx-auto mb-4 bg-rose-100 rounded-full flex items-center justify-center">
                                <span className="text-3xl">✉️</span>
                            </div>
                            <h2 className="text-xl font-semibold text-gray-800 mb-2">E-posta Gönderildi!</h2>
                            <p className="text-gray-500 mb-2">
                                Doğrulama bağlantısı <strong className="text-gray-700">{email}</strong> adresine gönderildi.
                            </p>
                            <p className="text-sm text-gray-400 mb-6">
                                E-postayı göremiyorsanız spam/önemsiz klasörünüzü kontrol edin.
                            </p>
                            <Link 
                                to="/login" 
                                className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                            >
                                Giriş Sayfasına Dön
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-xl font-semibold text-gray-800">Doğrulama E-postası Gönder</h2>
                                <p className="text-gray-500 text-sm mt-1">
                                    Kayıt olurken kullandığınız e-posta adresini girin.
                                </p>
                            </div>

                            {error && (
                                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                    E-posta Adresi
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
                                className="w-full px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? 'Gönderiliyor...' : 'Doğrulama E-postası Gönder'}
                            </button>

                            <p className="text-center text-sm">
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

export const PendingVerificationPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [resending, setResending] = useState(false);
    const [resent, setResent] = useState(false);

    useEffect(() => {
        const savedEmail = localStorage.getItem('pendingVerificationEmail');
        if (savedEmail) {
            setEmail(savedEmail);
        }
    }, []);

    const handleResend = async () => {
        if (!email) return;
        
        setResending(true);
        try {
            await authApi.resendVerification(email);
            setResent(true);
            setTimeout(() => setResent(false), 5000);
        } catch {
            setResent(true);
            setTimeout(() => setResent(false), 5000);
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center p-4">
            {/* Background Decorations */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-rose-200/30 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-200/30 rounded-full blur-3xl"></div>
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

                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-rose-100 rounded-full flex items-center justify-center">
                            <span className="text-3xl">📧</span>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">E-postanızı Doğrulayın</h2>
                        <p className="text-gray-500 mb-2">
                            <strong className="text-gray-700">{email || 'Kayıt olduğunuz e-posta adresine'}</strong> bir doğrulama bağlantısı gönderdik.
                        </p>
                        <p className="text-sm text-gray-400 mb-6">
                            E-postadaki bağlantıya tıklayarak hesabınızı doğrulayın.
                        </p>

                        <div className="mb-6 p-4 bg-rose-50 rounded-xl">
                            <p className="text-sm text-gray-600 mb-3">E-postayı almadınız mı?</p>
                            <button 
                                onClick={handleResend} 
                                disabled={resending || resent}
                                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                    resent 
                                        ? 'bg-emerald-100 text-emerald-600' 
                                        : 'bg-white border border-rose-200 text-rose-600 hover:bg-rose-50'
                                } disabled:opacity-50`}
                            >
                                {resending ? 'Gönderiliyor...' : resent ? '✓ Gönderildi!' : 'Tekrar Gönder'}
                            </button>
                        </div>

                        <div className="text-left mb-6 p-4 bg-gray-50 rounded-xl">
                            <h4 className="font-medium text-gray-700 mb-2">İpuçları:</h4>
                            <ul className="text-sm text-gray-500 space-y-1">
                                <li>• Spam/Önemsiz klasörünüzü kontrol edin</li>
                                <li>• E-posta adresinizin doğru olduğundan emin olun</li>
                                <li>• Birkaç dakika bekleyin ve tekrar deneyin</li>
                            </ul>
                        </div>

                        <Link to="/login" className="text-rose-500 hover:text-rose-600 font-medium">
                            ← Giriş sayfasına dön
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
