import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { classroomApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Classroom, ClassSession } from '../../types';
import { InviteModal } from '../../components/classroom/InviteModal';
import { StudentListModal } from '../../components/classroom/StudentListModal';
import './Classroom.css';

export const ClassroomListPage: React.FC = () => {
    const { user } = useAuthStore();
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadClassrooms();
    }, []);

    const loadClassrooms = async () => {
        try {
            const response = await classroomApi.getMyClassrooms(1, 20);
            if (response.data.success && response.data.data) {
                setClassrooms(response.data.data.items);
            }
        } catch (error) {
            console.error('Failed to load classrooms:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="loading"><div className="spinner"></div></div>;
    }

    return (
        <div className="classroom-page">
            <header className="page-header">
                <div>
                    <h1>🏫 Sınıflarım</h1>
                    <p>Kayıtlı olduğunuz veya yönettiğiniz sınıflar</p>
                </div>
                {(user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin') && (
                    <Link to="/classrooms/new" className="create-btn">
                        + Yeni Sınıf
                    </Link>
                )}
            </header>

            <div className="classroom-grid">
                {classrooms.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">📚</span>
                        <h3>Henüz sınıf yok</h3>
                        <p>Sınıflara kaydolduğunuzda burada görünecek</p>
                    </div>
                ) : (
                    classrooms.map(classroom => (
                        <Link key={classroom.id} to={`/classrooms/${classroom.id}`} className="classroom-card">
                            <div
                                className="classroom-cover"
                                style={{ backgroundImage: classroom.coverImageUrl ? `url(${classroom.coverImageUrl})` : undefined }}
                            >
                                {!classroom.coverImageUrl && <span className="default-cover">🏫</span>}
                            </div>
                            <div className="classroom-body">
                                <h3>{classroom.name}</h3>
                                <p className="classroom-description">{classroom.description}</p>
                                <div className="classroom-footer">
                                    <span className="student-count">👥 {classroom.studentCount} öğrenci</span>
                                    {classroom.instructorName && (
                                        <span className="instructor">👩‍🏫 {classroom.instructorName}</span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
};

export const ClassroomDetailPage: React.FC = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [classroom, setClassroom] = useState<Classroom | null>(null);
    const [sessions, setSessions] = useState<ClassSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isStudentListModalOpen, setIsStudentListModalOpen] = useState(false);
    const [newSessionData, setNewSessionData] = useState({
        title: '',
        description: '',
        scheduledStartTime: '',
        durationMinutes: 60
    });

    const classroomId = window.location.pathname.split('/').pop()!;

    useEffect(() => {
        loadClassroom();
    }, [classroomId]);

    const loadClassroom = async () => {
        try {
            const [classroomRes, sessionsRes] = await Promise.all([
                classroomApi.get(classroomId),
                classroomApi.getSessions(classroomId)
            ]);

            if (classroomRes.data.success) {
                setClassroom(classroomRes.data.data!);
            }
            if (sessionsRes.data.success) {
                setSessions(sessionsRes.data.data || []);
            }
        } catch (error) {
            console.error('Failed to load classroom:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const startTime = new Date(newSessionData.scheduledStartTime);
            const endTime = new Date(startTime.getTime() + newSessionData.durationMinutes * 60000);

            const response = await classroomApi.createSession(classroomId, {
                title: newSessionData.title,
                description: newSessionData.description,
                scheduledStartTime: newSessionData.scheduledStartTime,
                scheduledEndTime: endTime.toISOString()
            });

            if (response.data.success) {
                setIsCreateSessionModalOpen(false);
                setNewSessionData({ title: '', description: '', scheduledStartTime: '', durationMinutes: 60 });
                loadClassroom(); // Reload sessions
            }
        } catch (error) {
            console.error('Failed to create session:', error);
            alert('Ders oluşturulurken bir hata oluştu');
        }
    };

    const handleStartSession = async (sessionId: string) => {
        try {
            const response = await classroomApi.startSession(sessionId);
            if (response.data.success) {
                navigate(`/live/${sessionId}`);
            }
        } catch (error) {
            console.error('Failed to start session:', error);
            alert('Ders başlatılamadı');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return <div className="loading"><div className="spinner"></div></div>;
    }

    if (!classroom) {
        return <div className="error">Sınıf bulunamadı</div>;
    }

    const liveSessions = sessions.filter(s => s.status === 'Live');
    const upcomingSessions = sessions.filter(s => s.status === 'Scheduled');
    const pastSessions = sessions.filter(s => s.status === 'Ended');

    return (
        <div className="classroom-detail">
            <header className="classroom-header">
                <Link to="/classrooms" className="back-btn">← Sınıflara Dön</Link>
                <div
                    className="classroom-hero"
                    style={{ backgroundImage: classroom.coverImageUrl ? `url(${classroom.coverImageUrl})` : undefined }}
                >
                    <div className="hero-content">
                        <h1>{classroom.name}</h1>
                        <p>{classroom.description}</p>
                        <div className="hero-meta">
                            <span>👥 {classroom.studentCount} öğrenci</span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="classroom-content">
                {(user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin') && (
                    <div className="classroom-actions">
                        <button onClick={() => setIsInviteModalOpen(true)} className="action-btn invite-btn">
                            🔗 Öğrenci Davet Et
                        </button>
                        <button onClick={() => setIsStudentListModalOpen(true)} className="action-btn students-btn">
                            👥 Öğrenci Listesi ({classroom.studentCount})
                        </button>
                        <button onClick={() => setIsCreateSessionModalOpen(true)} className="action-btn create-session-btn">
                            📅 Yeni Canlı Ders Planla
                        </button>
                    </div>
                )}

                {isInviteModalOpen && (
                    <InviteModal
                        classroomId={classroomId}
                        classroomName={classroom.name}
                        onClose={() => setIsInviteModalOpen(false)}
                    />
                )}

                {isStudentListModalOpen && (
                    <StudentListModal
                        classroomId={classroomId}
                        classroomName={classroom.name}
                        onClose={() => setIsStudentListModalOpen(false)}
                        onStudentCountChange={(count) => setClassroom({ ...classroom, studentCount: count })}
                    />
                )}

                {isCreateSessionModalOpen && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h2>Yeni Canlı Ders Planla</h2>
                            <form onSubmit={handleCreateSession}>
                                <div className="form-group">
                                    <label>Başlık</label>
                                    <input
                                        type="text"
                                        value={newSessionData.title}
                                        onChange={e => setNewSessionData({ ...newSessionData, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Açıklama</label>
                                    <textarea
                                        value={newSessionData.description}
                                        onChange={e => setNewSessionData({ ...newSessionData, description: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Başlangıç Zamanı</label>
                                    <input
                                        type="datetime-local"
                                        value={newSessionData.scheduledStartTime}
                                        onChange={e => setNewSessionData({ ...newSessionData, scheduledStartTime: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Süre (Dakika)</label>
                                    <input
                                        type="number"
                                        value={newSessionData.durationMinutes}
                                        onChange={e => setNewSessionData({ ...newSessionData, durationMinutes: parseInt(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div className="modal-actions">
                                    <button type="button" onClick={() => setIsCreateSessionModalOpen(false)}>İptal</button>
                                    <button type="submit">Oluştur</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {liveSessions.length > 0 && (
                    <section className="session-section live-section">
                        <h2>🔴 Şu An Canlı</h2>
                        <div className="session-list">
                            {liveSessions.map(session => (
                                <Link key={session.id} to={`/live/${session.id}`} className="session-card live">
                                    <div className="live-indicator">
                                        <span className="pulse"></span>
                                        CANLI
                                    </div>
                                    <h3>{session.title}</h3>
                                    <p>Derse katıl →</p>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                <section className="session-section">
                    <h2>📅 Yaklaşan Dersler</h2>
                    {upcomingSessions.length === 0 ? (
                        <p className="no-sessions">Yaklaşan ders yok</p>
                    ) : (
                        <div className="session-list">
                            {upcomingSessions.map(session => (
                                <div key={session.id} className="session-card">
                                    <div className="session-time">{formatDate(session.scheduledStartTime)}</div>
                                    <h3>{session.title}</h3>
                                    <p>{session.description}</p>
                                    {(user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin') && (
                                        <button onClick={() => handleStartSession(session.id)} className="start-session-btn">
                                            Dersi Başlat
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="session-section">
                    <h2>📚 Geçmiş Dersler</h2>
                    {pastSessions.length === 0 ? (
                        <p className="no-sessions">Geçmiş ders yok</p>
                    ) : (
                        <div className="session-list">
                            {pastSessions.slice(0, 5).map(session => (
                                <div key={session.id} className="session-card past">
                                    <div className="session-time">{formatDate(session.scheduledStartTime)}</div>
                                    <h3>{session.title}</h3>
                                    {session.recordingUrl && (
                                        <a href={session.recordingUrl} target="_blank" rel="noopener noreferrer" className="recording-link">
                                            🎥 Kaydı İzle
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
