import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import './Analytics.css';

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
    void _isInstructor; // Reserved for future use

    useEffect(() => {
        loadAnalytics();
    }, [period]);

    const loadAnalytics = async () => {
        setLoading(true);
        // Mock data - in real app, fetch from API
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
        if (value >= 80) return '#10b981';
        if (value >= 60) return '#f59e0b';
        return '#ef4444';
    };

    const formatPercentage = (completed: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((completed / total) * 100);
    };

    if (loading || !data) {
        return (
            <div className="analytics-page">
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="analytics-page">
            <header className="page-header">
                <div>
                    <h1>📈 İlerleme Takibi</h1>
                    <p>Akademik performansınızı ve ilerlemenizi görüntüleyin</p>
                </div>
                <div className="period-selector">
                    <button
                        className={`period-btn ${period === 'week' ? 'active' : ''}`}
                        onClick={() => setPeriod('week')}
                    >
                        Hafta
                    </button>
                    <button
                        className={`period-btn ${period === 'month' ? 'active' : ''}`}
                        onClick={() => setPeriod('month')}
                    >
                        Ay
                    </button>
                    <button
                        className={`period-btn ${period === 'semester' ? 'active' : ''}`}
                        onClick={() => setPeriod('semester')}
                    >
                        Dönem
                    </button>
                </div>
            </header>

            {/* Overview Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">📝</div>
                    <div className="stat-content">
                        <span className="stat-value">{data.homeworkCompleted}/{data.homeworkTotal}</span>
                        <span className="stat-label">Ödev Tamamlandı</span>
                    </div>
                    <div className="stat-progress">
                        <div 
                            className="progress-fill"
                            style={{ 
                                width: `${formatPercentage(data.homeworkCompleted, data.homeworkTotal)}%`,
                                backgroundColor: getProgressColor(formatPercentage(data.homeworkCompleted, data.homeworkTotal))
                            }}
                        ></div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">📋</div>
                    <div className="stat-content">
                        <span className="stat-value">{data.examsCompleted}/{data.examsTotal}</span>
                        <span className="stat-label">Sınav Tamamlandı</span>
                    </div>
                    <div className="stat-progress">
                        <div 
                            className="progress-fill"
                            style={{ 
                                width: `${formatPercentage(data.examsCompleted, data.examsTotal)}%`,
                                backgroundColor: getProgressColor(formatPercentage(data.examsCompleted, data.examsTotal))
                            }}
                        ></div>
                    </div>
                </div>

                <div className="stat-card highlight">
                    <div className="stat-icon">🏆</div>
                    <div className="stat-content">
                        <span className="stat-value">{data.averageScore.toFixed(1)}</span>
                        <span className="stat-label">Ortalama Puan</span>
                    </div>
                    <div className="stat-progress">
                        <div 
                            className="progress-fill"
                            style={{ 
                                width: `${data.averageScore}%`,
                                backgroundColor: getProgressColor(data.averageScore)
                            }}
                        ></div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">✋</div>
                    <div className="stat-content">
                        <span className="stat-value">%{data.attendanceRate}</span>
                        <span className="stat-label">Devam Oranı</span>
                    </div>
                    <div className="stat-progress">
                        <div 
                            className="progress-fill"
                            style={{ 
                                width: `${data.attendanceRate}%`,
                                backgroundColor: getProgressColor(data.attendanceRate)
                            }}
                        ></div>
                    </div>
                </div>
            </div>

            <div className="analytics-content">
                {/* Weekly Activity */}
                <section className="analytics-section">
                    <h2>📊 Haftalık Aktivite</h2>
                    <div className="weekly-chart">
                        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day, index) => (
                            <div key={day} className="chart-bar">
                                <div 
                                    className="bar-fill"
                                    style={{ height: `${(data.weeklyStudyHours[index] / 5) * 100}%` }}
                                >
                                    <span className="bar-value">{data.weeklyStudyHours[index]}s</span>
                                </div>
                                <span className="bar-label">{day}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Recent Grades */}
                <section className="analytics-section">
                    <h2>📝 Son Notlar</h2>
                    <div className="grades-list">
                        {data.recentGrades.map((grade, index) => (
                            <div key={index} className="grade-item">
                                <div className="grade-info">
                                    <span className="grade-name">{grade.name}</span>
                                    <span className="grade-date">
                                        {new Date(grade.date).toLocaleDateString('tr-TR')}
                                    </span>
                                </div>
                                <div className="grade-score">
                                    <span 
                                        className="score-value"
                                        style={{ color: getProgressColor((grade.score / grade.maxScore) * 100) }}
                                    >
                                        {grade.score}
                                    </span>
                                    <span className="score-max">/{grade.maxScore}</span>
                                </div>
                                <div className="grade-bar">
                                    <div 
                                        className="bar-fill"
                                        style={{ 
                                            width: `${(grade.score / grade.maxScore) * 100}%`,
                                            backgroundColor: getProgressColor((grade.score / grade.maxScore) * 100)
                                        }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Classroom Stats */}
                <section className="analytics-section">
                    <h2>🏫 Sınıf Performansı</h2>
                    <div className="classroom-stats">
                        {data.classroomStats.map((stat, index) => (
                            <div key={index} className="classroom-stat-card">
                                <div className="classroom-header">
                                    <span className="classroom-name">{stat.name}</span>
                                    <span 
                                        className="classroom-grade"
                                        style={{ backgroundColor: getProgressColor(stat.progress) }}
                                    >
                                        {stat.grade}
                                    </span>
                                </div>
                                <div className="classroom-progress">
                                    <div className="progress-bar">
                                        <div 
                                            className="progress-fill"
                                            style={{ 
                                                width: `${stat.progress}%`,
                                                backgroundColor: getProgressColor(stat.progress)
                                            }}
                                        ></div>
                                    </div>
                                    <span className="progress-label">%{stat.progress} tamamlandı</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};
