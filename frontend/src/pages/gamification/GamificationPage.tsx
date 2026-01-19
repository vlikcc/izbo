import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';

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
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50">
                <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 min-h-screen">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                    🏆 Başarılar & Sıralama
                </h1>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                <button
                    className={`px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                        activeTab === 'overview' 
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                            : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                    }`}
                    onClick={() => setActiveTab('overview')}
                >
                    📊 Genel Bakış
                </button>
                <button
                    className={`px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                        activeTab === 'badges' 
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                            : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                    }`}
                    onClick={() => setActiveTab('badges')}
                >
                    🎖️ Rozetler
                </button>
                <button
                    className={`px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                        activeTab === 'leaderboard' 
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                            : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                    }`}
                    onClick={() => setActiveTab('leaderboard')}
                >
                    🏅 Sıralama
                </button>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
                <div className="space-y-6">
                    {/* Level Card */}
                    <div className="bg-gradient-to-r from-rose-500 to-rose-400 rounded-2xl p-6 text-white">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold">
                                {stats.level}
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">Seviye {stats.level}</h2>
                                <p className="text-rose-100">{stats.currentXp} / {stats.xpToNextLevel} XP</p>
                            </div>
                        </div>
                        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-white rounded-full transition-all"
                                style={{ width: `${getLevelProgress()}%` }}
                            ></div>
                        </div>
                        <p className="text-rose-100 text-sm mt-2">
                            Sonraki seviyeye {stats.xpToNextLevel - stats.currentXp} XP kaldı
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl border border-rose-100 p-4">
                            <span className="text-2xl mb-2 block">⭐</span>
                            <span className="text-2xl font-bold text-gray-900">{stats.totalPoints.toLocaleString()}</span>
                            <span className="text-gray-500 text-sm block">Toplam Puan</span>
                        </div>
                        <div className="bg-white rounded-2xl border border-rose-100 p-4">
                            <span className="text-2xl mb-2 block">🏆</span>
                            <span className="text-2xl font-bold text-gray-900">#{stats.rank}</span>
                            <span className="text-gray-500 text-sm block">Sıralama</span>
                        </div>
                        <div className="bg-white rounded-2xl border border-rose-100 p-4">
                            <span className="text-2xl mb-2 block">🔥</span>
                            <span className="text-2xl font-bold text-gray-900">{stats.streak} gün</span>
                            <span className="text-gray-500 text-sm block">Günlük Seri</span>
                        </div>
                        <div className="bg-white rounded-2xl border border-rose-100 p-4">
                            <span className="text-2xl mb-2 block">🎖️</span>
                            <span className="text-2xl font-bold text-gray-900">{stats.badgesEarned}/{stats.totalBadges}</span>
                            <span className="text-gray-500 text-sm block">Rozetler</span>
                        </div>
                    </div>

                    {/* Activity Stats */}
                    <div className="bg-white rounded-2xl border border-rose-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            📈 Aktivite İstatistikleri
                        </h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-rose-50 rounded-xl">
                                <span className="text-2xl block mb-1">📝</span>
                                <span className="text-xl font-bold text-gray-900">{stats.homeworksCompleted}</span>
                                <span className="text-gray-500 text-sm block">Tamamlanan Ödev</span>
                            </div>
                            <div className="text-center p-4 bg-rose-50 rounded-xl">
                                <span className="text-2xl block mb-1">📋</span>
                                <span className="text-xl font-bold text-gray-900">{stats.examsCompleted}</span>
                                <span className="text-gray-500 text-sm block">Tamamlanan Sınav</span>
                            </div>
                            <div className="text-center p-4 bg-rose-50 rounded-xl">
                                <span className="text-2xl block mb-1">🎥</span>
                                <span className="text-xl font-bold text-gray-900">{stats.classesAttended}</span>
                                <span className="text-gray-500 text-sm block">Katıldığı Ders</span>
                            </div>
                            <div className="text-center p-4 bg-rose-50 rounded-xl">
                                <span className="text-2xl block mb-1">📆</span>
                                <span className="text-xl font-bold text-gray-900">{stats.longestStreak}</span>
                                <span className="text-gray-500 text-sm block">En Uzun Seri</span>
                            </div>
                        </div>
                    </div>

                    {/* Recent Badges */}
                    <div className="bg-white rounded-2xl border border-rose-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            🎖️ Son Kazanılan Rozetler
                        </h3>
                        <div className="flex flex-wrap gap-4">
                            {badges.filter(b => b.earnedAt).slice(0, 4).map(badge => (
                                <div key={badge.id} className="flex items-center gap-3 p-3 bg-rose-50 rounded-xl">
                                    <span className="text-2xl">{badge.icon}</span>
                                    <span className="font-medium text-gray-800">{badge.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Badges Tab */}
            {activeTab === 'badges' && (
                <div className="space-y-8">
                    {(['milestone', 'achievement', 'skill', 'special'] as const).map(category => (
                        <div key={category}>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                {category === 'milestone' && '📍 Kilometre Taşları'}
                                {category === 'achievement' && '🏅 Başarılar'}
                                {category === 'skill' && '💪 Beceriler'}
                                {category === 'special' && '✨ Özel'}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {getCategoryBadges(category).map(badge => (
                                    <div 
                                        key={badge.id} 
                                        className={`bg-white rounded-2xl border p-4 transition-all ${
                                            badge.earnedAt 
                                                ? 'border-rose-200 shadow-lg shadow-rose-100' 
                                                : 'border-gray-200 opacity-60'
                                        }`}
                                    >
                                        <div className="text-center">
                                            <span className="text-4xl block mb-2">{badge.icon}</span>
                                            <h4 className="font-semibold text-gray-900 mb-1">{badge.name}</h4>
                                            <p className="text-sm text-gray-500 mb-3">{badge.description}</p>
                                            {badge.earnedAt && (
                                                <span className="text-xs text-rose-500 font-medium">
                                                    ✓ {new Date(badge.earnedAt).toLocaleDateString('tr-TR')}
                                                </span>
                                            )}
                                            {badge.progress !== undefined && !badge.earnedAt && (
                                                <div>
                                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
                                                        <div 
                                                            className="h-full bg-rose-400 rounded-full"
                                                            style={{ width: `${(badge.progress / (badge.maxProgress || 1)) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs text-gray-500">
                                                        {badge.progress}/{badge.maxProgress}
                                                    </span>
                                                </div>
                                            )}
                                            {!badge.earnedAt && !badge.progress && (
                                                <span className="text-xs text-gray-400">🔒 Kilitli</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
                <div className="space-y-6">
                    {/* Top 3 */}
                    <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                        {leaderboard.slice(0, 3).map((entry, index) => (
                            <div 
                                key={entry.userId}
                                className={`bg-white rounded-2xl border border-rose-100 p-4 text-center ${
                                    index === 0 ? 'order-2 transform scale-105' : index === 1 ? 'order-1' : 'order-3'
                                }`}
                            >
                                <div className="text-3xl mb-2">
                                    {index === 0 && '🥇'}
                                    {index === 1 && '🥈'}
                                    {index === 2 && '🥉'}
                                </div>
                                <div className="w-12 h-12 mx-auto bg-gradient-to-br from-rose-400 to-rose-500 rounded-full flex items-center justify-center text-white font-bold text-lg mb-2">
                                    {entry.userName.charAt(0)}
                                </div>
                                <h4 className="font-semibold text-gray-900 text-sm truncate">{entry.userName}</h4>
                                <span className="text-rose-500 font-bold">{entry.points.toLocaleString()}</span>
                                <div className="flex justify-center gap-2 mt-2 text-xs text-gray-500">
                                    <span>🎖️ {entry.badges}</span>
                                    <span>🔥 {entry.streak}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Leaderboard Table */}
                    <div className="bg-white rounded-2xl border border-rose-100 overflow-hidden">
                        <div className="grid grid-cols-5 gap-4 p-4 bg-rose-50 font-medium text-gray-600 text-sm">
                            <span>Sıra</span>
                            <span className="col-span-2">Kullanıcı</span>
                            <span>Puan</span>
                            <span>Rozet</span>
                        </div>
                        {leaderboard.slice(3).map(entry => (
                            <div 
                                key={entry.userId}
                                className={`grid grid-cols-5 gap-4 p-4 border-t border-rose-50 items-center ${
                                    entry.userId === user?.id ? 'bg-rose-50' : ''
                                }`}
                            >
                                <span className="font-medium text-gray-600">#{entry.rank}</span>
                                <span className="col-span-2 flex items-center gap-2">
                                    <span className="w-8 h-8 bg-gradient-to-br from-rose-400 to-rose-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                        {entry.userName.charAt(0)}
                                    </span>
                                    <span className="font-medium text-gray-900 truncate">{entry.userName}</span>
                                    {entry.userId === user?.id && (
                                        <span className="px-2 py-0.5 bg-rose-500 text-white text-xs font-medium rounded-full">Sen</span>
                                    )}
                                </span>
                                <span className="font-semibold text-gray-900">{entry.points.toLocaleString()}</span>
                                <span className="text-gray-500">🎖️ {entry.badges}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
