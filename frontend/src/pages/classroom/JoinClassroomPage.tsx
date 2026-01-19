import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { classroomApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

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
            <div className="min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white rounded-2xl border border-rose-100 p-8 text-center shadow-xl shadow-rose-100/50">
                    <div className="w-16 h-16 mx-auto mb-6 bg-rose-100 rounded-full flex items-center justify-center text-3xl">
                        🔐
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Sınıfa Katıl</h1>
                    <p className="text-gray-500 mb-6">Sınıfa katılmak için önce giriş yapmanız gerekiyor.</p>
                    <Link 
                        to="/login" 
                        className="inline-block w-full px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                    >
                        Giriş Yap
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-rose-100 p-8 text-center shadow-xl shadow-rose-100/50">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-rose-100 to-orange-100 rounded-full flex items-center justify-center text-3xl">
                    🏫
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Sınıfa Katıl</h1>
                <p className="text-gray-500 mb-6">Öğretmeninizden aldığınız davet kodunu girin</p>

                {success ? (
                    <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center text-3xl">
                            ✅
                        </div>
                        <p className="text-emerald-600 font-medium">{success}</p>
                        <p className="text-gray-400 text-sm">Yönlendiriliyorsunuz...</p>
                    </div>
                ) : (
                    <form onSubmit={handleJoin} className="space-y-4">
                        <div>
                            <input
                                type="text"
                                value={inputCode}
                                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                                placeholder="ÖRNEK: ABC123"
                                maxLength={8}
                                autoFocus
                                className="w-full px-6 py-4 bg-rose-50 border-2 border-rose-100 rounded-xl text-center text-2xl font-bold tracking-widest text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all uppercase"
                            />
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center justify-center gap-2">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            className="w-full px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading || !inputCode.trim()}
                        >
                            {loading ? 'Katılınıyor...' : 'Sınıfa Katıl'}
                        </button>
                    </form>
                )}

                <Link 
                    to="/classrooms" 
                    className="inline-block mt-6 text-rose-500 hover:text-rose-600 font-medium"
                >
                    ← Sınıflarıma Dön
                </Link>
            </div>
        </div>
    );
};
