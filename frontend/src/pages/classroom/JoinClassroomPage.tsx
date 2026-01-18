import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { classroomApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import './Classroom.css';

export const JoinClassroomPage: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [inputCode, setInputCode] = useState(code || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (code) {
            handleJoin();
        }
    }, [code]);

    const handleJoin = async (e?: React.FormEvent) => {
        e?.preventDefault();
        
        const codeToUse = inputCode.trim().toUpperCase();
        if (!codeToUse) {
            setError('Lütfen bir davet kodu girin');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await classroomApi.joinByCode(codeToUse);
            if (response.data.success && response.data.data) {
                setSuccess(`"${response.data.data.name}" sınıfına başarıyla katıldınız!`);
                setTimeout(() => {
                    navigate(`/classrooms/${response.data.data!.id}`);
                }, 2000);
            } else {
                setError(response.data.message || 'Sınıfa katılınamadı');
            }
        } catch (error: any) {
            const message = error.response?.data?.message || 'Geçersiz davet kodu veya sınıf bulunamadı';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="join-classroom-page">
                <div className="join-card">
                    <span className="join-icon">🔐</span>
                    <h1>Sınıfa Katıl</h1>
                    <p>Sınıfa katılmak için önce giriş yapmanız gerekiyor.</p>
                    <Link to="/login" className="login-btn">
                        Giriş Yap
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="join-classroom-page">
            <div className="join-card">
                <span className="join-icon">🏫</span>
                <h1>Sınıfa Katıl</h1>
                <p>Öğretmeninizden aldığınız davet kodunu girin</p>

                {success ? (
                    <div className="success-message">
                        <span className="success-icon">✅</span>
                        <p>{success}</p>
                        <p className="redirect-text">Yönlendiriliyorsunuz...</p>
                    </div>
                ) : (
                    <form onSubmit={handleJoin}>
                        <div className="code-input-container">
                            <input
                                type="text"
                                value={inputCode}
                                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                                placeholder="ÖRNEK: ABC123"
                                maxLength={8}
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="error-message">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            className="join-btn"
                            disabled={loading || !inputCode.trim()}
                        >
                            {loading ? 'Katılınıyor...' : 'Sınıfa Katıl'}
                        </button>
                    </form>
                )}

                <Link to="/classrooms" className="back-link">
                    ← Sınıflarıma Dön
                </Link>
            </div>
        </div>
    );
};
