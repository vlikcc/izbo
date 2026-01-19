
import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { classroomService } from '../../services/classroom.service';
import type { Classroom, ClassSession } from '../../types';
import './Dashboard.css';

export const DashboardPage: React.FC = () => {
    const { user } = useAuthStore();
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [upcomingSessions, setUpcomingSessions] = useState<ClassSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [classroomsRes, sessionsRes] = await Promise.all([
                    classroomService.getMyClassrooms(1, 4),
                    classroomService.getUpcomingSessions(),
                ]);
                setClassrooms(classroomsRes.items);
                setUpcomingSessions(sessionsRes.slice(0, 3));
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Günaydın';
        if (hour < 18) return 'İyi günler';
        return 'İyi akşamlar';
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('tr-TR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="page animate-fadeIn">
            {/* Welcome Section */}
            <div className="dashboard-welcome">
                <div className="dashboard-welcome-content">
                    <h1 className="dashboard-welcome-title">
                        {getGreeting()}, {user?.firstName}! 👋
                    </h1>
                    <p className="dashboard-welcome-text">
                        {user?.role === 'Student'
                            ? 'Bugün öğrenmeye hazır mısın?'
                            : 'Sınıflarınız sizi bekliyor!'
                        }
                    </p>
                </div>
                <div className="dashboard-welcome-illustration">
                    📚
                </div>
            </div>

            {/* Stats Grid */}
            <div className="dashboard-stats">
                <Card variant="default" padding="md" className="dashboard-stat-card">
                    <div className="stat-icon stat-icon-primary">📖</div>
                    <div className="stat-info">
                        <span className="stat-value">{classrooms.length}</span>
                        <span className="stat-label">Aktif Sınıf</span>
                    </div>
                </Card>
                <Card variant="default" padding="md" className="dashboard-stat-card">
                    <div className="stat-icon stat-icon-success">📅</div>
                    <div className="stat-info">
                        <span className="stat-value">{upcomingSessions.length}</span>
                        <span className="stat-label">Yaklaşan Ders</span>
                    </div>
                </Card>
                <Card variant="default" padding="md" className="dashboard-stat-card">
                    <div className="stat-icon stat-icon-warning">📝</div>
                    <div className="stat-info">
                        <span className="stat-value">0</span>
                        <span className="stat-label">Bekleyen Ödev</span>
                    </div>
                </Card>
                <Card variant="default" padding="md" className="dashboard-stat-card">
                    <div className="stat-icon stat-icon-info">🏆</div>
                    <div className="stat-info">
                        <span className="stat-value">0</span>
                        <span className="stat-label">Rozet</span>
                    </div>
                </Card>
            </div>

            {/* Content Grid */}
            <div className="dashboard-grid">
                {/* Upcoming Sessions */}
                <Card variant="default" padding="md" className="dashboard-section">
                    <div className="dashboard-section-header">
                        <h3 className="dashboard-section-title">📅 Yaklaşan Dersler</h3>
                    </div>
                    <div className="dashboard-section-content">
                        {isLoading ? (
                            <div className="dashboard-loading">Yükleniyor...</div>
                        ) : upcomingSessions.length > 0 ? (
                            <div className="session-list">
                                {upcomingSessions.map(session => (
                                    <div key={session.id} className="session-item">
                                        <div className="session-time">
                                            <span className="session-time-icon">🕐</span>
                                            <span>{formatDate(session.scheduledStartTime)}</span>
                                        </div>
                                        <div className="session-info">
                                            <span className="session-title">{session.title}</span>
                                            {session.description && (
                                                <span className="session-desc">{session.description}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="dashboard-empty">
                                <span className="dashboard-empty-icon">📭</span>
                                <span>Henüz planlanmış ders yok</span>
                            </div>
                        )}
                    </div>
                </Card>

                {/* My Classrooms */}
                <Card variant="default" padding="md" className="dashboard-section">
                    <div className="dashboard-section-header">
                        <h3 className="dashboard-section-title">📚 Sınıflarım</h3>
                    </div>
                    <div className="dashboard-section-content">
                        {isLoading ? (
                            <div className="dashboard-loading">Yükleniyor...</div>
                        ) : classrooms.length > 0 ? (
                            <div className="classroom-list">
                                {classrooms.map(classroom => (
                                    <div key={classroom.id} className="classroom-item">
                                        <div className="classroom-icon">📖</div>
                                        <div className="classroom-info">
                                            <span className="classroom-name">{classroom.name}</span>
                                            <span className="classroom-meta">
                                                {classroom.studentCount} öğrenci
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="dashboard-empty">
                                <span className="dashboard-empty-icon">📭</span>
                                <span>Henüz sınıf yok</span>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default DashboardPage;
