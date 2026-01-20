import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Modal, Input } from '../../components/ui';
import { SessionShareModal } from '../../components/live/SessionShareModal';
import { liveService } from '../../services/live.service';
import { classroomService } from '../../services/classroom.service';
import { useAuthStore } from '../../stores/authStore';
import type { LiveSession, Classroom } from '../../types';
import './Live.css';

export const LivePage: React.FC = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<LiveSession[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Share modal state
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [createdSession, setCreatedSession] = useState<{ id: string; title: string } | null>(null);

    const [formData, setFormData] = useState({
        classroomId: '',
        title: '',
        description: '',
        scheduledStartTime: '',
        scheduledEndTime: '',
        meetingUrl: '',
    });

    const isInstructor = user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin';

    const fetchSessions = async () => {
        try {
            const data = await liveService.getUpcomingSessions();
            setSessions(data);
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchClassrooms = async () => {
        try {
            const response = await classroomService.getMyClassrooms(1, 50);
            setClassrooms(response.items);
        } catch (error) {
            console.error('Failed to fetch classrooms:', error);
        }
    };

    useEffect(() => {
        fetchSessions();
        if (isInstructor) {
            fetchClassrooms();
        }
    }, [isInstructor]);

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('tr-TR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getSessionStatus = (session: LiveSession) => {
        const now = new Date();
        const start = new Date(session.scheduledStartTime);
        const end = new Date(session.scheduledEndTime);

        if (session.status === 'Live' || (now >= start && now <= end)) {
            return <span className="live-status live-status-active">🔴 Canlı</span>;
        } else if (now < start) {
            return <span className="live-status live-status-upcoming">⏰ Yaklaşan</span>;
        } else {
            return <span className="live-status live-status-ended">✓ Bitti</span>;
        }
    };

    const handleJoinSession = (sessionId: string) => {
        navigate(`/live/${sessionId}`);
    };

    const handleOpenModal = () => {
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

        setFormData({
            classroomId: classrooms[0]?.id || '',
            title: '',
            description: '',
            scheduledStartTime: now.toISOString().slice(0, 16),
            scheduledEndTime: oneHourLater.toISOString().slice(0, 16),
            meetingUrl: '',
        });
        setError('');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setError('');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.classroomId) {
            setError('Sınıf seçmelisiniz');
            return;
        }
        if (!formData.title.trim()) {
            setError('Başlık zorunludur');
            return;
        }

        setIsSubmitting(true);
        try {
            const newSession = await liveService.createSession({
                classroomId: formData.classroomId,
                title: formData.title,
                description: formData.description || undefined,
                scheduledStartTime: formData.scheduledStartTime,
                scheduledEndTime: formData.scheduledEndTime,
                meetingUrl: formData.meetingUrl || undefined,
            });
            handleCloseModal();
            fetchSessions();

            // Open share modal with created session info
            setCreatedSession({ id: newSession.id, title: formData.title });
            setIsShareModalOpen(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Canlı ders oluşturulamadı');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStartSession = async (sessionId: string) => {
        if (!confirm('Canlı dersi başlatmak istediğinize emin misiniz?')) return;

        try {
            await liveService.startSession(sessionId);
            // Wait a bit and refresh
            setTimeout(() => {
                fetchSessions();
                navigate(`/live/${sessionId}`);
            }, 500);
        } catch (error) {
            console.error('Failed to start session:', error);
            alert('Ders başlatılamadı');
        }
    };

    return (
        <div className="page animate-fadeIn">
            {/* ... Existing header ... */}
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">🎥 Canlı Dersler</h1>
                    <p className="page-subtitle">Canlı ders oturumları ve kayıtlar</p>
                </div>
                {isInstructor && (
                    <Button variant="primary" size="md" onClick={handleOpenModal}>
                        + Yeni Canlı Ders
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className="live-loading">
                    <div className="live-loading-spinner" />
                    <span>Oturumlar yükleniyor...</span>
                </div>
            ) : sessions.length > 0 ? (
                <div className="live-grid">
                    {sessions.map(session => {
                        const status = getSessionStatus(session);
                        const isLive = session.status === 'Live';
                        // Check if it's "Active time" even if not started yet
                        const now = new Date();
                        const start = new Date(session.scheduledStartTime);
                        const end = new Date(session.scheduledEndTime);
                        const isActiveTime = now >= start && now <= end;

                        return (
                            <Card key={session.id} variant="default" padding="none" hoverable className="live-card">
                                <div className="live-card-header">
                                    <div className="live-card-icon">🎥</div>
                                    {/* Use logical status for display */}
                                    {status}
                                </div>

                                <div className="live-card-content">
                                    <h3 className="live-card-title">{session.title}</h3>
                                    {session.description && (
                                        <p className="live-card-desc">{session.description}</p>
                                    )}

                                    <div className="live-card-time">
                                        <span className="live-card-time-icon">📅</span>
                                        <span>{formatDate(session.scheduledStartTime)}</span>
                                    </div>
                                </div>

                                <div className="live-card-footer">
                                    {isLive ? (
                                        <Button
                                            variant="primary"
                                            size="md"
                                            fullWidth
                                            onClick={() => handleJoinSession(session.id)}
                                        >
                                            Katıl 🎥
                                        </Button>
                                    ) : (
                                        <>
                                            {isInstructor && session.status === 'Scheduled' && (
                                                <Button
                                                    variant="secondary"
                                                    size="md"
                                                    fullWidth
                                                    onClick={() => handleStartSession(session.id)}
                                                    style={{ marginBottom: '8px' }}
                                                >
                                                    Dersi Başlat 🚀
                                                </Button>
                                            )}

                                            {!isInstructor && isActiveTime && !isLive && (
                                                <Button variant="secondary" size="md" fullWidth disabled>
                                                    Öğretmen Bekleniyor...
                                                </Button>
                                            )}

                                            {!isActiveTime && !session.recordingUrl && session.status !== 'Live' && (
                                                <Button variant="secondary" size="md" fullWidth disabled>
                                                    Henüz başlamadı
                                                </Button>
                                            )}

                                            {session.recordingUrl && (
                                                <Button variant="outline" size="md" fullWidth>
                                                    Kaydı İzle 📹
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </Card>
                        )
                    })}
                </div>
            ) : (
                <Card variant="default" padding="lg" className="live-empty animate-slideUp">
                    <div className="live-empty-content">
                        <span className="live-empty-icon">🎥</span>
                        <h3 className="live-empty-title">Henüz canlı ders yok</h3>
                        <p className="live-empty-text">
                            {isInstructor
                                ? 'İlk canlı dersinizi planlayın!'
                                : 'Yaklaşan canlı dersler burada görünecektir.'
                            }
                        </p>
                        {isInstructor && (
                            <Button variant="primary" size="lg" style={{ marginTop: '16px' }} onClick={handleOpenModal}>
                                + Canlı Ders Planla
                            </Button>
                        )}
                    </div>
                </Card>
            )}

            {/* Create Live Session Modal */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Yeni Canlı Ders" size="md">
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && (
                        <div className="auth-error">{error}</div>
                    )}

                    <div className="input-wrapper">
                        <label className="input-label">Sınıf</label>
                        <select
                            name="classroomId"
                            value={formData.classroomId}
                            onChange={handleChange}
                            className="modal-select"
                            required
                        >
                            <option value="">Sınıf Seçin</option>
                            {classrooms.map(classroom => (
                                <option key={classroom.id} value={classroom.id}>
                                    {classroom.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <Input
                        label="Başlık"
                        name="title"
                        placeholder="Örn: Matematik Canlı Ders"
                        value={formData.title}
                        onChange={handleChange}
                        required
                    />

                    <div className="input-wrapper">
                        <label className="input-label">Açıklama</label>
                        <textarea
                            name="description"
                            placeholder="Ders içeriği hakkında kısa bilgi..."
                            value={formData.description}
                            onChange={handleChange}
                            className="modal-textarea"
                        />
                    </div>

                    <div className="modal-row">
                        <Input
                            label="Başlangıç Zamanı"
                            type="datetime-local"
                            name="scheduledStartTime"
                            value={formData.scheduledStartTime}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            label="Bitiş Zamanı"
                            type="datetime-local"
                            name="scheduledEndTime"
                            value={formData.scheduledEndTime}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <Input
                        label="Toplantı Bağlantısı (Opsiyonel)"
                        name="meetingUrl"
                        placeholder="https://zoom.us/j/..."
                        value={formData.meetingUrl}
                        onChange={handleChange}
                    />

                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={handleCloseModal}>
                            İptal
                        </Button>
                        <Button type="submit" variant="primary" isLoading={isSubmitting}>
                            Oluştur
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Share Session Modal */}
            {createdSession && (
                <SessionShareModal
                    isOpen={isShareModalOpen}
                    onClose={() => {
                        setIsShareModalOpen(false);
                        setCreatedSession(null);
                    }}
                    sessionId={createdSession.id}
                    sessionTitle={createdSession.title}
                />
            )}
        </div>
    );
};

export default LivePage;
