import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';

interface ProgressData {
    homeworkCompleted: number;
    homeworkTotal: number;
    examsCompleted: number;
    examsTotal: number;
    averageScore: number;
    attendanceRate: number;
    weeklyStudyHours: number[];
    recentGrades: { name: string; score: number; maxScore: number; date: string }[];
    classroomStats: { name: string; progress: number; grade: string }[];
}

export const AnalyticsPage: React.FC = () => {
    const { user } = useAuthStore();
    const [data, setData] = useState<ProgressData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'week' | 'month' | 'semester'>('month');

    const _isInstructor = user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin';
    void _isInstructor;

    useEffect(() => {
        loadAnalytics();
    }, [period]);

    const loadAnalytics = async () => {
        setLoading(true);
        setTimeout(() => {
            setData({
                homeworkCompleted: 12,
                homeworkTotal: 15,
                examsCompleted: 3,
                examsTotal: 4,
                averageScore: 78.5,
                attendanceRate: 92,
                weeklyStudyHours: [2, 3, 4, 2, 5, 3, 1],
                recentGrades: [
                    { name: 'Matematik Ara Sınav', score: 85, maxScore: 100, date: '2026-01-15' },
                    { name: 'Fizik Quiz', score: 45, maxScore: 50, date: '2026-01-12' },
                    { name: 'Türev Ödevi', score: 90, maxScore: 100, date: '2026-01-10' },
                    { name: 'Kimya Lab Raporu', score: 75, maxScore: 100, date: '2026-01-08' },
                ],
                classroomStats: [
                    { name: 'Matematik 101', progress: 85, grade: 'A-' },
                    { name: 'Fizik 102', progress: 72, grade: 'B' },
                    { name: 'Kimya 103', progress: 65, grade: 'C+' },
                ]
            });
            setLoading(false);
        }, 500);
    };

    const getProgressColor = (value: number) => {
        if (value >= 80) return 'bg-emerald-500';
        if (value >= 60) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const getTextColor = (value: number) => {
        if (value >= 80) return 'text-emerald-500';
        if (value >= 60) return 'text-amber-500';
        return 'text-red-500';
    };

    const formatPercentage = (completed: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((completed / total) * 100);
    };

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50">
                <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-4 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
                    <p className="text-gray-500">Yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 min-h-screen">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                        📈 İlerleme Takibi
                    </h1>
                    <p className="text-gray-500 mt-1">Akademik performansınızı ve ilerlemenizi görüntüleyin</p>
                </div>
                <div className="flex gap-2">
                    <button
                        className={`px-4 py-2 rounded-xl font-medium transition-all ${
                            period === 'week' 
                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                                : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                        }`}
                        onClick={() => setPeriod('week')}
                    >
                        Hafta
                    </button>
                    <button
                        className={`px-4 py-2 rounded-xl font-medium transition-all ${
                            period === 'month' 
                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                                : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                        }`}
                        onClick={() => setPeriod('month')}
                    >
                        Ay
                    </button>
                    <button
                        className={`px-4 py-2 rounded-xl font-medium transition-all ${
                            period === 'semester' 
                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                                : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                        }`}
                        onClick={() => setPeriod('semester')}
                    >
                        Dönem
                    </button>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-2xl border border-rose-100 p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">📝</span>
                        <div>
                            <span className="text-2xl font-bold text-gray-900">{data.homeworkCompleted}/{data.homeworkTotal}</span>
                            <span className="text-gray-500 text-sm block">Ödev Tamamlandı</span>
                        </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full ${getProgressColor(formatPercentage(data.homeworkCompleted, data.homeworkTotal))}`}
                            style={{ width: `${formatPercentage(data.homeworkCompleted, data.homeworkTotal)}%` }}
                        ></div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-rose-100 p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">📋</span>
                        <div>
                            <span className="text-2xl font-bold text-gray-900">{data.examsCompleted}/{data.examsTotal}</span>
                            <span className="text-gray-500 text-sm block">Sınav Tamamlandı</span>
                        </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full ${getProgressColor(formatPercentage(data.examsCompleted, data.examsTotal))}`}
                            style={{ width: `${formatPercentage(data.examsCompleted, data.examsTotal)}%` }}
                        ></div>
                    </div>
                </div>

                <div className="bg-gradient-to-r from-rose-500 to-rose-400 rounded-2xl p-4 text-white">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">🏆</span>
                        <div>
                            <span className="text-2xl font-bold">{data.averageScore.toFixed(1)}</span>
                            <span className="text-rose-100 text-sm block">Ortalama Puan</span>
                        </div>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-white rounded-full"
                            style={{ width: `${data.averageScore}%` }}
                        ></div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-rose-100 p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">✋</span>
                        <div>
                            <span className="text-2xl font-bold text-gray-900">%{data.attendanceRate}</span>
                            <span className="text-gray-500 text-sm block">Devam Oranı</span>
                        </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full ${getProgressColor(data.attendanceRate)}`}
                            style={{ width: `${data.attendanceRate}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Weekly Activity */}
                <div className="bg-white rounded-2xl border border-rose-100 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                        📊 Haftalık Aktivite
                    </h2>
                    <div className="flex items-end justify-between h-48 gap-2">
                        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day, index) => (
                            <div key={day} className="flex-1 flex flex-col items-center">
                                <div className="relative w-full flex-1 flex items-end">
                                    <div 
                                        className="w-full bg-gradient-to-t from-rose-500 to-rose-400 rounded-t-lg transition-all relative"
                                        style={{ height: `${(data.weeklyStudyHours[index] / 5) * 100}%` }}
                                    >
                                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium text-gray-600">
                                            {data.weeklyStudyHours[index]}s
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs text-gray-500 mt-2">{day}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Grades */}
                <div className="bg-white rounded-2xl border border-rose-100 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        📝 Son Notlar
                    </h2>
                    <div className="space-y-4">
                        {data.recentGrades.map((grade, index) => (
                            <div key={index} className="flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <span className="font-medium text-gray-900 block truncate">{grade.name}</span>
                                    <span className="text-sm text-gray-500">
                                        {new Date(grade.date).toLocaleDateString('tr-TR')}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className={`text-lg font-bold ${getTextColor((grade.score / grade.maxScore) * 100)}`}>
                                        {grade.score}
                                    </span>
                                    <span className="text-gray-400">/{grade.maxScore}</span>
                                </div>
                                <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${getProgressColor((grade.score / grade.maxScore) * 100)}`}
                                        style={{ width: `${(grade.score / grade.maxScore) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Classroom Stats */}
                <div className="bg-white rounded-2xl border border-rose-100 p-6 lg:col-span-2">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        🏫 Sınıf Performansı
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.classroomStats.map((stat, index) => (
                            <div key={index} className="p-4 bg-rose-50 rounded-xl">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-medium text-gray-900">{stat.name}</span>
                                    <span className={`px-3 py-1 text-white text-sm font-bold rounded-full ${getProgressColor(stat.progress)}`}>
                                        {stat.grade}
                                    </span>
                                </div>
                                <div className="h-2 bg-white rounded-full overflow-hidden mb-2">
                                    <div 
                                        className={`h-full rounded-full ${getProgressColor(stat.progress)}`}
                                        style={{ width: `${stat.progress}%` }}
                                    ></div>
                                </div>
                                <span className="text-sm text-gray-500">%{stat.progress} tamamlandı</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
