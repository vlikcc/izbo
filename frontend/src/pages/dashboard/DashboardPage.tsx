import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { classroomApi, homeworkApi, examApi } from '../../services/api';
import type { Classroom, Homework, Exam, ClassSession } from '../../types';
import './Dashboard.css';

export const DashboardPage: React.FC = () => {
    const { user } = useAuthStore();
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [upcomingHomework, setUpcomingHomework] = useState<Homework[]>([]);
    const [upcomingExams, setUpcomingExams] = useState<Exam[]>([]);
    const [liveSessions, setLiveSessions] = useState<ClassSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            const [classroomsRes, homeworkRes, examsRes, liveRes] = await Promise.all([
                classroomApi.getMyClassrooms(1, 5),
                homeworkApi.getAll(undefined, 1, 5),
                examApi.getAll(undefined, 1, 5),
                classroomApi.getLiveSessions(),
            ]);

            if (classroomsRes.data.success) setClassrooms(classroomsRes.data.data?.items || []);
            if (homeworkRes.data.success) setUpcomingHomework(homeworkRes.data.data?.items || []);
            if (examsRes.data.success) setUpcomingExams(examsRes.data.data?.items || []);
            if (liveRes.data.success) setLiveSessions(liveRes.data.data || []);
        } catch (error) {
            console.error('Dashboard data loading failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <div>
                    <h1>Hoş Geldiniz, {user?.firstName}! 👋</h1>
                    <p>Bugün neler yapmak istersiniz?</p>
                </div>
                <div className="header-stats">
                    <div className="stat-card">
                        <span className="stat-icon">🏫</span>
                        <div>
                            <span className="stat-value">{classrooms.length}</span>
                            <span className="stat-label">Sınıf</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <span className="stat-icon">📝</span>
                        <div>
                            <span className="stat-value">{upcomingHomework.length}</span>
                            <span className="stat-label">Bekleyen Ödev</span>
                        </div>
                    </div>
                    <div className="stat-card live">
                        <span className="stat-icon">🔴</span>
                        <div>
                            <span className="stat-value">{liveSessions.length}</span>
                            <span className="stat-label">Canlı Ders</span>
                        </div>
                    </div>
                </div>
            </header>

            {liveSessions.length > 0 && (
                <section className="dashboard-section live-section">
                    <h2>🔴 Canlı Dersler</h2>
                    <div className="live-sessions">
                        {liveSessions.map((session) => (
                            <Link key={session.id} to={`/live/${session.id}`} className="live-card">
                                <div className="live-indicator">
                                    <span className="pulse"></span>
                                    CANLI
                                </div>
                                <h3>{session.title}</h3>
                                <p>Şimdi katıl →</p>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <div className="dashboard-grid">
                <section className="dashboard-section">
                    <div className="section-header">
                        <h2>📚 Sınıflarım</h2>
                        <Link to="/classrooms" className="view-all">Tümünü Gör</Link>
                    </div>
                    <div className="cards-list">
                        {classrooms.length === 0 ? (
                            <p className="empty-state">Henüz sınıfınız yok</p>
                        ) : (
                            classrooms.map((classroom) => (
                                <Link key={classroom.id} to={`/classrooms/${classroom.id}`} className="card">
                                    <div className="card-icon">🏫</div>
                                    <div className="card-content">
                                        <h3>{classroom.name}</h3>
                                        <p>{classroom.studentCount} öğrenci</p>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </section>

                <section className="dashboard-section">
                    <div className="section-header">
                        <h2>📝 Yaklaşan Ödevler</h2>
                        <Link to="/homework" className="view-all">Tümünü Gör</Link>
                    </div>
                    <div className="cards-list">
                        {upcomingHomework.length === 0 ? (
                            <p className="empty-state">Bekleyen ödeviniz yok</p>
                        ) : (
                            upcomingHomework.map((hw) => (
                                <Link key={hw.id} to={`/homework/${hw.id}`} className="card">
                                    <div className="card-icon">📝</div>
                                    <div className="card-content">
                                        <h3>{hw.title}</h3>
                                        <p className="due-date">Son Teslim: {formatDate(hw.dueDate)}</p>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </section>

                <section className="dashboard-section">
                    <div className="section-header">
                        <h2>📋 Yaklaşan Sınavlar</h2>
                        <Link to="/exams" className="view-all">Tümünü Gör</Link>
                    </div>
                    <div className="cards-list">
                        {upcomingExams.length === 0 ? (
                            <p className="empty-state">Yaklaşan sınavınız yok</p>
                        ) : (
                            upcomingExams.map((exam) => (
                                <Link key={exam.id} to={`/exams/${exam.id}`} className="card">
                                    <div className="card-icon">📋</div>
                                    <div className="card-content">
                                        <h3>{exam.title}</h3>
                                        <p>{formatDate(exam.startTime)} • {exam.durationMinutes} dk</p>
                                    </div>
                                    <span className={`exam-status ${exam.status.toLowerCase()}`}>
                                        {exam.status === 'Published' ? 'Hazır' : exam.status}
                                    </span>
                                </Link>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};
