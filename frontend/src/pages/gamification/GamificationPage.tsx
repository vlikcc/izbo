import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import './Gamification.css';

interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'achievement' | 'milestone' | 'skill' | 'special';
    earnedAt?: string;
    progress?: number;
    maxProgress?: number;
}

interface LeaderboardEntry {
    rank: number;
    userId: string;
    userName: string;
    avatarUrl?: string;
    points: number;
    badges: number;
    streak: number;
}

interface UserStats {
    totalPoints: number;
    rank: number;
    level: number;
    xpToNextLevel: number;
    currentXp: number;
    streak: number;
    longestStreak: number;
    badgesEarned: number;
    totalBadges: number;
    homeworksCompleted: number;
    examsCompleted: number;
    classesAttended: number;
}

export const GamificationPage: React.FC = () => {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'leaderboard'>('overview');
    const [stats, setStats] = useState<UserStats | null>(null);
    const [badges, setBadges] = useState<Badge[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        // Simulating API call with mock data
        setTimeout(() => {
            setStats({
                totalPoints: 2450,
                rank: 12,
                level: 8,
                xpToNextLevel: 500,
                currentXp: 350,
                streak: 7,
                longestStreak: 15,
                badgesEarned: 12,
                totalBadges: 30,
                homeworksCompleted: 28,
                examsCompleted: 8,
                classesAttended: 45
            });

            setBadges([
                { id: '1', name: 'İlk Adım', description: 'İlk dersine katıl', icon: '👶', category: 'milestone', earnedAt: '2024-01-15' },
                { id: '2', name: 'Çalışkan Arı', description: '10 ödevi zamanında tamamla', icon: '🐝', category: 'achievement', earnedAt: '2024-02-10' },
                { id: '3', name: 'Sınav Ustası', description: '5 sınavdan 90+ puan al', icon: '🎯', category: 'skill', earnedAt: '2024-03-01' },
                { id: '4', name: 'Haftalık Seri', description: '7 gün art arda giriş yap', icon: '🔥', category: 'milestone', earnedAt: '2024-03-10' },
                { id: '5', name: 'Yardımsever', description: '10 soruyu cevapla', icon: '🤝', category: 'achievement', progress: 7, maxProgress: 10 },
                { id: '6', name: 'Quiz Kralı', description: '20 quizi tamamla', icon: '👑', category: 'achievement', progress: 15, maxProgress: 20 },
                { id: '7', name: 'Erken Kuş', description: '10 ödevi son günden önce teslim et', icon: '🌅', category: 'skill', progress: 6, maxProgress: 10 },
                { id: '8', name: 'Mükemmellik', description: 'Bir sınavdan 100 puan al', icon: '💯', category: 'special' },
                { id: '9', name: 'Aylık Seri', description: '30 gün art arda giriş yap', icon: '📅', category: 'milestone', progress: 7, maxProgress: 30 },
                { id: '10', name: 'Sosyal Kelebek', description: '50 mesaj gönder', icon: '🦋', category: 'achievement', progress: 32, maxProgress: 50 }
            ]);

            setLeaderboard([
                { rank: 1, userId: '1', userName: 'Ahmet Yılmaz', points: 4520, badges: 22, streak: 21 },
                { rank: 2, userId: '2', userName: 'Elif Demir', points: 4350, badges: 20, streak: 18 },
                { rank: 3, userId: '3', userName: 'Mehmet Kaya', points: 4100, badges: 19, streak: 14 },
                { rank: 4, userId: '4', userName: 'Zeynep Öz', points: 3890, badges: 18, streak: 12 },
                { rank: 5, userId: '5', userName: 'Can Aksoy', points: 3650, badges: 17, streak: 10 },
                { rank: 6, userId: '6', userName: 'Selin Yurt', points: 3480, badges: 16, streak: 9 },
                { rank: 7, userId: '7', userName: 'Emre Bal', points: 3200, badges: 15, streak: 8 },
                { rank: 8, userId: '8', userName: 'Ayşe Tan', points: 2980, badges: 14, streak: 7 },
                { rank: 9, userId: '9', userName: 'Burak Deniz', points: 2750, badges: 13, streak: 6 },
                { rank: 10, userId: '10', userName: 'Ceren Su', points: 2600, badges: 12, streak: 5 },
                { rank: 11, userId: '11', userName: 'Deniz Çelik', points: 2500, badges: 12, streak: 5 },
                { rank: 12, userId: user?.id || '12', userName: `${user?.firstName} ${user?.lastName}` || 'Sen', points: 2450, badges: 12, streak: 7 }
            ]);

            setLoading(false);
        }, 500);
    };

    const getLevelProgress = () => {
        if (!stats) return 0;
        return (stats.currentXp / stats.xpToNextLevel) * 100;
    };

    const getCategoryBadges = (category: Badge['category']) => {
        return badges.filter(b => b.category === category);
    };

    if (loading) {
        return (
            <div className="gamification-page loading-state">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="gamification-page">
            <header className="page-header">
                <h1>🏆 Başarılar & Sıralama</h1>
            </header>

            <div className="gamification-tabs">
                <button
                    className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    📊 Genel Bakış
                </button>
                <button
                    className={`tab-btn ${activeTab === 'badges' ? 'active' : ''}`}
                    onClick={() => setActiveTab('badges')}
                >
                    🎖️ Rozetler
                </button>
                <button
                    className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('leaderboard')}
                >
                    🏅 Sıralama
                </button>
            </div>

            {activeTab === 'overview' && stats && (
                <div className="overview-content">
                    <div className="user-level-card">
                        <div className="level-info">
                            <div className="level-badge">
                                <span className="level-number">{stats.level}</span>
                            </div>
                            <div className="level-details">
                                <h2>Seviye {stats.level}</h2>
                                <p>{stats.currentXp} / {stats.xpToNextLevel} XP</p>
                            </div>
                        </div>
                        <div className="level-progress-bar">
                            <div 
                                className="level-progress-fill"
                                style={{ width: `${getLevelProgress()}%` }}
                            ></div>
                        </div>
                        <p className="next-level-hint">
                            Sonraki seviyeye {stats.xpToNextLevel - stats.currentXp} XP kaldı
                        </p>
                    </div>

                    <div className="stats-grid">
                        <div className="stat-card points">
                            <span className="stat-icon">⭐</span>
                            <div className="stat-info">
                                <span className="stat-value">{stats.totalPoints.toLocaleString()}</span>
                                <span className="stat-label">Toplam Puan</span>
                            </div>
                        </div>
                        <div className="stat-card rank">
                            <span className="stat-icon">🏆</span>
                            <div className="stat-info">
                                <span className="stat-value">#{stats.rank}</span>
                                <span className="stat-label">Sıralama</span>
                            </div>
                        </div>
                        <div className="stat-card streak">
                            <span className="stat-icon">🔥</span>
                            <div className="stat-info">
                                <span className="stat-value">{stats.streak} gün</span>
                                <span className="stat-label">Günlük Seri</span>
                            </div>
                        </div>
                        <div className="stat-card badges">
                            <span className="stat-icon">🎖️</span>
                            <div className="stat-info">
                                <span className="stat-value">{stats.badgesEarned}/{stats.totalBadges}</span>
                                <span className="stat-label">Rozetler</span>
                            </div>
                        </div>
                    </div>

                    <div className="activity-stats">
                        <h3>📈 Aktivite İstatistikleri</h3>
                        <div className="activity-grid">
                            <div className="activity-item">
                                <span className="activity-icon">📝</span>
                                <span className="activity-value">{stats.homeworksCompleted}</span>
                                <span className="activity-label">Tamamlanan Ödev</span>
                            </div>
                            <div className="activity-item">
                                <span className="activity-icon">📋</span>
                                <span className="activity-value">{stats.examsCompleted}</span>
                                <span className="activity-label">Tamamlanan Sınav</span>
                            </div>
                            <div className="activity-item">
                                <span className="activity-icon">🎥</span>
                                <span className="activity-value">{stats.classesAttended}</span>
                                <span className="activity-label">Katıldığı Ders</span>
                            </div>
                            <div className="activity-item">
                                <span className="activity-icon">📆</span>
                                <span className="activity-value">{stats.longestStreak}</span>
                                <span className="activity-label">En Uzun Seri</span>
                            </div>
                        </div>
                    </div>

                    <div className="recent-badges">
                        <h3>🎖️ Son Kazanılan Rozetler</h3>
                        <div className="badges-row">
                            {badges.filter(b => b.earnedAt).slice(0, 4).map(badge => (
                                <div key={badge.id} className="badge-item earned">
                                    <span className="badge-icon">{badge.icon}</span>
                                    <span className="badge-name">{badge.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'badges' && (
                <div className="badges-content">
                    {(['milestone', 'achievement', 'skill', 'special'] as const).map(category => (
                        <div key={category} className="badge-category">
                            <h3>
                                {category === 'milestone' && '📍 Kilometre Taşları'}
                                {category === 'achievement' && '🏅 Başarılar'}
                                {category === 'skill' && '💪 Beceriler'}
                                {category === 'special' && '✨ Özel'}
                            </h3>
                            <div className="badges-grid">
                                {getCategoryBadges(category).map(badge => (
                                    <div 
                                        key={badge.id} 
                                        className={`badge-card ${badge.earnedAt ? 'earned' : 'locked'}`}
                                    >
                                        <span className="badge-icon">{badge.icon}</span>
                                        <h4 className="badge-name">{badge.name}</h4>
                                        <p className="badge-description">{badge.description}</p>
                                        {badge.earnedAt && (
                                            <span className="badge-date">
                                                {new Date(badge.earnedAt).toLocaleDateString('tr-TR')}
                                            </span>
                                        )}
                                        {badge.progress !== undefined && !badge.earnedAt && (
                                            <div className="badge-progress">
                                                <div className="badge-progress-bar">
                                                    <div 
                                                        className="badge-progress-fill"
                                                        style={{ width: `${(badge.progress / (badge.maxProgress || 1)) * 100}%` }}
                                                    ></div>
                                                </div>
                                                <span className="badge-progress-text">
                                                    {badge.progress}/{badge.maxProgress}
                                                </span>
                                            </div>
                                        )}
                                        {!badge.earnedAt && !badge.progress && (
                                            <span className="badge-locked-text">🔒 Kilitli</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'leaderboard' && (
                <div className="leaderboard-content">
                    <div className="top-three">
                        {leaderboard.slice(0, 3).map((entry, index) => (
                            <div 
                                key={entry.userId}
                                className={`top-player rank-${index + 1}`}
                            >
                                <div className="podium-rank">
                                    {index === 0 && '🥇'}
                                    {index === 1 && '🥈'}
                                    {index === 2 && '🥉'}
                                </div>
                                <div className="player-avatar">
                                    {entry.userName.charAt(0)}
                                </div>
                                <h4 className="player-name">{entry.userName}</h4>
                                <span className="player-points">{entry.points.toLocaleString()} puan</span>
                                <div className="player-meta">
                                    <span>🎖️ {entry.badges}</span>
                                    <span>🔥 {entry.streak}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="leaderboard-table">
                        <div className="table-header">
                            <span>Sıra</span>
                            <span>Kullanıcı</span>
                            <span>Puan</span>
                            <span>Rozet</span>
                            <span>Seri</span>
                        </div>
                        {leaderboard.slice(3).map(entry => (
                            <div 
                                key={entry.userId}
                                className={`table-row ${entry.userId === user?.id ? 'current-user' : ''}`}
                            >
                                <span className="rank">#{entry.rank}</span>
                                <span className="name">
                                    <span className="avatar">{entry.userName.charAt(0)}</span>
                                    {entry.userName}
                                    {entry.userId === user?.id && <span className="you-badge">Sen</span>}
                                </span>
                                <span className="points">{entry.points.toLocaleString()}</span>
                                <span className="badges">🎖️ {entry.badges}</span>
                                <span className="streak">🔥 {entry.streak}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
