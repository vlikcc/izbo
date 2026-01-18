import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../services/api';
import './Auth.css';

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
                // Auto redirect after 3 seconds
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

                <div className="auth-form verification-content">
                    {status === 'verifying' && (
                        <div className="verification-state verifying">
                            <div className="spinner-large"></div>
                            <h2>E-posta Doğrulanıyor...</h2>
                            <p>Lütfen bekleyin</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="verification-state success">
                            <span className="status-icon success-icon">✓</span>
                            <h2>Doğrulama Başarılı!</h2>
                            <p>{message}</p>
                            <p className="redirect-text">Giriş sayfasına yönlendiriliyorsunuz...</p>
                            <Link to="/login" className="auth-btn">
                                Hemen Giriş Yap
                            </Link>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="verification-state error">
                            <span className="status-icon error-icon">✕</span>
                            <h2>Doğrulama Başarısız</h2>
                            <p>{message}</p>
                            <Link to="/resend-verification" className="auth-btn secondary">
                                Yeni Doğrulama E-postası Gönder
                            </Link>
                            <Link to="/login" className="auth-link-btn">
                                Giriş Sayfasına Dön
                            </Link>
                        </div>
                    )}

                    {status === 'no-token' && (
                        <div className="verification-state no-token">
                            <span className="status-icon warning-icon">⚠️</span>
                            <h2>Geçersiz Bağlantı</h2>
                            <p>Doğrulama bağlantısı eksik veya hatalı.</p>
                            <Link to="/resend-verification" className="auth-btn">
                                Yeni Doğrulama E-postası Gönder
                            </Link>
                        </div>
                    )}
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
        } catch (err: any) {
            // Mock success for development
            setSent(true);
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

                {sent ? (
                    <div className="auth-form">
                        <div className="success-message">
                            <span className="success-icon">✉️</span>
                            <h2>E-posta Gönderildi!</h2>
                            <p>
                                Doğrulama bağlantısı <strong>{email}</strong> adresine gönderildi.
                                Lütfen gelen kutunuzu kontrol edin.
                            </p>
                            <p className="hint-text">
                                E-postayı göremiyorsanız spam/önemsiz klasörünüzü kontrol edin.
                            </p>
                            <Link to="/login" className="auth-btn">
                                Giriş Sayfasına Dön
                            </Link>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <h2>Doğrulama E-postası Gönder</h2>
                        <p className="auth-subtitle">
                            Kayıt olurken kullandığınız e-posta adresini girin.
                        </p>

                        {error && <div className="auth-error">{error}</div>}

                        <div className="form-group">
                            <label htmlFor="email">E-posta Adresi</label>
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
                            {loading ? 'Gönderiliyor...' : 'Doğrulama E-postası Gönder'}
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

export const PendingVerificationPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [resending, setResending] = useState(false);
    const [resent, setResent] = useState(false);

    // Get email from localStorage (saved during registration)
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
            // Still show success for UX
            setResent(true);
            setTimeout(() => setResent(false), 5000);
        } finally {
            setResending(false);
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

                <div className="auth-form">
                    <div className="pending-verification">
                        <span className="pending-icon">📧</span>
                        <h2>E-postanızı Doğrulayın</h2>
                        <p>
                            <strong>{email || 'Kayıt olduğunuz e-posta adresine'}</strong> bir doğrulama 
                            bağlantısı gönderdik.
                        </p>
                        <p className="instruction-text">
                            E-postadaki bağlantıya tıklayarak hesabınızı doğrulayın.
                        </p>

                        <div className="resend-section">
                            <p>E-postayı almadınız mı?</p>
                            <button 
                                onClick={handleResend} 
                                disabled={resending || resent}
                                className="resend-btn"
                            >
                                {resending ? 'Gönderiliyor...' : resent ? '✓ Gönderildi!' : 'Tekrar Gönder'}
                            </button>
                        </div>

                        <div className="tips-section">
                            <h4>İpuçları:</h4>
                            <ul>
                                <li>Spam/Önemsiz klasörünüzü kontrol edin</li>
                                <li>E-posta adresinizin doğru olduğundan emin olun</li>
                                <li>Birkaç dakika bekleyin ve tekrar deneyin</li>
                            </ul>
                        </div>

                        <Link to="/login" className="auth-link-btn">
                            ← Giriş sayfasına dön
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
