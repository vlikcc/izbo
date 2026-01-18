import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { classroomApi } from '../../services/api';
import type { ClassSession } from '../../types';
import './LiveSessions.css';

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
            <div className="loading">
                <div className="spinner"></div>
                <p>Canlı dersler yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="live-sessions-page">
            <header className="page-header">
                <div>
                    <h1>🎥 Canlı Dersler</h1>
                    <p>Aktif ve yaklaşan canlı dersleriniz</p>
                </div>
            </header>

            {/* Live Now Section */}
            {liveSessions.length > 0 && (
                <section className="sessions-section live-now-section">
                    <h2>
                        <span className="section-icon pulse-icon">🔴</span>
                        Şu An Canlı
                    </h2>
                    <div className="sessions-grid">
                        {liveSessions.map((session) => (
                            <Link key={session.id} to={`/live/${session.id}`} className="session-card live">
                                <div className="live-badge">
                                    <span className="pulse-dot"></span>
                                    CANLI
                                </div>
                                <h3>{session.title}</h3>
                                <p className="session-description">{session.description}</p>
                                <div className="session-footer">
                                    <span className="join-text">Derse Katıl →</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Upcoming Sessions */}
            <section className="sessions-section">
                <h2>
                    <span className="section-icon">📅</span>
                    Yaklaşan Dersler
                </h2>
                {upcomingSessions.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">📭</span>
                        <h3>Yaklaşan ders yok</h3>
                        <p>Planlanmış canlı ders bulunmuyor</p>
                    </div>
                ) : (
                    <div className="sessions-list">
                        {upcomingSessions.map((session) => (
                            <div key={session.id} className="session-list-item">
                                <div className="session-time-info">
                                    <span className="time-badge">{getTimeUntil(session.scheduledStartTime)}</span>
                                    <span className="time-full">{formatDate(session.scheduledStartTime)}</span>
                                </div>
                                <div className="session-details">
                                    <h3>{session.title}</h3>
                                    <p>{session.description}</p>
                                </div>
                                <div className="session-actions">
                                    <button className="reminder-btn" title="Hatırlatıcı ekle">
                                        🔔
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Info Card */}
            <section className="info-card">
                <div className="info-icon">💡</div>
                <div className="info-content">
                    <h3>Canlı Ders İpuçları</h3>
                    <ul>
                        <li>Derse başlamadan önce mikrofon ve kamera izinlerini kontrol edin</li>
                        <li>Stabil bir internet bağlantısı kullanın</li>
                        <li>Sessiz bir ortamda katılım sağlayın</li>
                        <li>Soru sormak için el kaldır özelliğini kullanın</li>
                    </ul>
                </div>
            </section>
        </div>
    );
};
