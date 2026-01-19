import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { classroomApi } from '../../services/api';
import type { ClassSession } from '../../types';

export const LiveSessionsListPage: React.FC = () => {
    const [liveSessions, setLiveSessions] = useState<ClassSession[]>([]);
    const [upcomingSessions, setUpcomingSessions] = useState<ClassSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            const [liveRes, upcomingRes] = await Promise.all([
                classroomApi.getLiveSessions(),
                classroomApi.getUpcomingSessions(),
            ]);

            if (liveRes.data.success) {
                setLiveSessions(liveRes.data.data || []);
            }
            if (upcomingRes.data.success) {
                setUpcomingSessions(upcomingRes.data.data || []);
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('tr-TR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getTimeUntil = (dateString: string) => {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = date.getTime() - now.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays} gün sonra`;
        if (diffHours > 0) return `${diffHours} saat sonra`;
        if (diffMins > 0) return `${diffMins} dakika sonra`;
        return 'Şimdi';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-4 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
                    <p className="text-gray-500">Canlı dersler yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 min-h-screen">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                    🎥 Canlı Dersler
                </h1>
                <p className="text-gray-500 mt-1">Aktif ve yaklaşan canlı dersleriniz</p>
            </header>

            {/* Live Now Section */}
            {liveSessions.length > 0 && (
                <section className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        Şu An Canlı
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {liveSessions.map((session) => (
                            <Link 
                                key={session.id} 
                                to={`/live/${session.id}`} 
                                className="relative overflow-hidden bg-gradient-to-r from-rose-500 to-rose-400 rounded-2xl p-6 text-white shadow-xl shadow-rose-200 hover:shadow-2xl hover:shadow-rose-300 transition-all hover:-translate-y-1"
                            >
                                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                    CANLI
                                </div>
                                <h3 className="text-xl font-bold mb-2">{session.title}</h3>
                                <p className="text-rose-100 text-sm mb-4 line-clamp-2">{session.description}</p>
                                <span className="text-rose-100 flex items-center gap-1 font-medium">
                                    Derse Katıl <span>→</span>
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Upcoming Sessions */}
            <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    📅 Yaklaşan Dersler
                </h2>
                {upcomingSessions.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-rose-100 p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-rose-100 rounded-full flex items-center justify-center text-3xl">
                            📭
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Yaklaşan ders yok</h3>
                        <p className="text-gray-500">Planlanmış canlı ders bulunmuyor</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {upcomingSessions.map((session) => (
                            <div 
                                key={session.id} 
                                className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-white rounded-2xl border border-rose-100 hover:shadow-lg transition-shadow"
                            >
                                <div className="flex-shrink-0">
                                    <span className="inline-block px-3 py-1 bg-rose-100 text-rose-600 text-sm font-medium rounded-full">
                                        {getTimeUntil(session.scheduledStartTime)}
                                    </span>
                                    <p className="text-sm text-gray-500 mt-1">{formatDate(session.scheduledStartTime)}</p>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-900">{session.title}</h3>
                                    <p className="text-gray-500 text-sm line-clamp-1">{session.description}</p>
                                </div>
                                <button 
                                    className="flex-shrink-0 w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-100 transition-colors"
                                    title="Hatırlatıcı ekle"
                                >
                                    🔔
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Info Card */}
            <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                <div className="flex gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                        💡
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Canlı Ders İpuçları</h3>
                        <ul className="space-y-2 text-gray-600 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                Derse başlamadan önce mikrofon ve kamera izinlerini kontrol edin
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                Stabil bir internet bağlantısı kullanın
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                Sessiz bir ortamda katılım sağlayın
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                Soru sormak için el kaldır özelliğini kullanın
                            </li>
                        </ul>
                    </div>
                </div>
            </section>
        </div>
    );
};
