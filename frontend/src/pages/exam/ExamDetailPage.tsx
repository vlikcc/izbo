import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { examApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Exam, Question } from '../../types';
import './ExamList.css';

export const ExamDetailPage: React.FC = () => {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [exam, setExam] = useState<Exam | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [showConfirm, setShowConfirm] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const isInstructor = user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin';

    useEffect(() => {
        loadExamDetails();
    }, [examId]);

    const loadExamDetails = async () => {
        try {
            const [examRes, questionsRes] = await Promise.all([
                examApi.get(examId!),
                examApi.getQuestions(examId!)
            ]);

            if (examRes.data.success && examRes.data.data) {
                setExam(examRes.data.data);
            }
            if (questionsRes.data.success && questionsRes.data.data) {
                setQuestions(questionsRes.data.data);
            }
        } catch (error) {
            console.error('Failed to load exam:', error);
            // Mock data
            setExam({
                id: examId!,
                classroomId: 'c1',
                classroomName: 'Matematik 101',
                title: 'Ara Sınav - Türev ve İntegral',
                description: 'Türev ve integral konularını kapsayan ara sınav. Bu sınav dönem notunuzun %30\'unu oluşturacaktır.',
                durationMinutes: 60,
                startTime: new Date(Date.now() + 86400000).toISOString(),
                endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
                totalPoints: 100,
                questionCount: 20,
                shuffleQuestions: true,
                shuffleOptions: true,
                showResults: true,
                passingScore: 50,
                status: 'Published',
                createdAt: new Date().toISOString()
            });
            setQuestions([
                { id: 'q1', examId: examId!, orderIndex: 1, type: 'MultipleChoice', content: 'f(x) = x² fonksiyonunun türevi nedir?', options: ['2x', 'x', '2', 'x²'], points: 5 },
                { id: 'q2', examId: examId!, orderIndex: 2, type: 'TrueFalse', content: 'Her sürekli fonksiyon türevlenebilirdir.', points: 5 },
                { id: 'q3', examId: examId!, orderIndex: 3, type: 'FillInBlank', content: '∫x dx = ___', points: 10 }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        setPublishing(true);
        try {
            const response = await examApi.publish(examId!);
            if (response.data.success) {
                setExam(prev => prev ? { ...prev, status: 'Published' } : null);
            }
        } catch (error) {
            console.error('Failed to publish:', error);
            setExam(prev => prev ? { ...prev, status: 'Published' } : null);
        } finally {
            setPublishing(false);
            setShowConfirm(false);
        }
    };

    const handleDelete = async () => {
        try {
            await examApi.delete(examId!);
            navigate('/exams');
        } catch (error) {
            console.error('Failed to delete:', error);
        }
    };

    const handleStartExam = () => {
        navigate(`/exams/${examId}/session`);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusInfo = () => {
        if (!exam) return null;

        const now = new Date();
        const start = new Date(exam.startTime);
        const end = new Date(exam.endTime);

        if (exam.status === 'Draft') {
            return (
                <div className="status-info draft">
                    <span className="status-icon">📝</span>
                    <span>Taslak - Henüz yayınlanmadı</span>
                </div>
            );
        }

        if (exam.status === 'InProgress' || (now >= start && now <= end)) {
            return (
                <div className="status-info in-progress">
                    <span className="status-icon pulse">🔴</span>
                    <span>Sınav Devam Ediyor</span>
                </div>
            );
        }

        if (now < start) {
            const diff = start.getTime() - now.getTime();
            const days = Math.floor(diff / 86400000);
            const hours = Math.floor((diff % 86400000) / 3600000);
            return (
                <div className="status-info upcoming">
                    <span className="status-icon">📅</span>
                    <span>{days > 0 ? `${days} gün ${hours} saat sonra` : `${hours} saat sonra`} başlayacak</span>
                </div>
            );
        }

        return (
            <div className="status-info ended">
                <span className="status-icon">✓</span>
                <span>Sınav Tamamlandı</span>
            </div>
        );
    };

    const getQuestionTypeLabel = (type: string) => {
        switch (type) {
            case 'MultipleChoice': return 'Çoktan Seçmeli';
            case 'TrueFalse': return 'Doğru/Yanlış';
            case 'FillInBlank': return 'Boşluk Doldurma';
            case 'Essay': return 'Yazılı';
            case 'Matching': return 'Eşleştirme';
            default: return type;
        }
    };

    if (loading) {
        return (
            <div className="exam-detail-page">
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Yükleniyor...</p>
                </div>
            </div>
        );
    }

    if (!exam) {
        return (
            <div className="exam-detail-page">
                <div className="error-state">
                    <h2>Sınav bulunamadı</h2>
                    <Link to="/exams">← Sınavlara Dön</Link>
                </div>
            </div>
        );
    }

    const canStart = exam.status === 'InProgress' || 
        (exam.status === 'Published' && new Date(exam.startTime) <= new Date() && new Date(exam.endTime) > new Date());

    return (
        <div className="exam-detail-page">
            <header className="detail-header">
                <Link to="/exams" className="back-link">← Sınavlara Dön</Link>
            </header>

            <div className="detail-content">
                <div className="detail-main">
                    <div className="exam-hero">
                        {getStatusInfo()}
                        <h1>{exam.title}</h1>
                        <div className="exam-meta">
                            <span className="classroom-badge">{exam.classroomName}</span>
                        </div>
                        {exam.description && (
                            <p className="exam-description">{exam.description}</p>
                        )}
                    </div>

                    <div className="exam-stats">
                        <div className="stat-card">
                            <span className="stat-icon">⏱️</span>
                            <span className="stat-value">{exam.durationMinutes}</span>
                            <span className="stat-label">Dakika</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-icon">❓</span>
                            <span className="stat-value">{exam.questionCount}</span>
                            <span className="stat-label">Soru</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-icon">🏆</span>
                            <span className="stat-value">{exam.totalPoints}</span>
                            <span className="stat-label">Toplam Puan</span>
                        </div>
                        {exam.passingScore && (
                            <div className="stat-card">
                                <span className="stat-icon">✓</span>
                                <span className="stat-value">{exam.passingScore}</span>
                                <span className="stat-label">Geçme Notu</span>
                            </div>
                        )}
                    </div>

                    <div className="exam-schedule">
                        <h3>📅 Sınav Zamanı</h3>
                        <div className="schedule-info">
                            <div className="schedule-item">
                                <span className="schedule-label">Başlangıç:</span>
                                <span className="schedule-value">{formatDate(exam.startTime)}</span>
                            </div>
                            <div className="schedule-item">
                                <span className="schedule-label">Bitiş:</span>
                                <span className="schedule-value">{formatDate(exam.endTime)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="exam-settings">
                        <h3>⚙️ Sınav Ayarları</h3>
                        <div className="settings-list">
                            <div className="setting-item">
                                <span className={exam.shuffleQuestions ? 'enabled' : 'disabled'}>
                                    {exam.shuffleQuestions ? '✓' : '✕'}
                                </span>
                                Sorular karıştırılsın
                            </div>
                            <div className="setting-item">
                                <span className={exam.shuffleOptions ? 'enabled' : 'disabled'}>
                                    {exam.shuffleOptions ? '✓' : '✕'}
                                </span>
                                Seçenekler karıştırılsın
                            </div>
                            <div className="setting-item">
                                <span className={exam.showResults ? 'enabled' : 'disabled'}>
                                    {exam.showResults ? '✓' : '✕'}
                                </span>
                                Sonuçları göster
                            </div>
                        </div>
                    </div>

                    {isInstructor && questions.length > 0 && (
                        <div className="questions-preview">
                            <h3>📝 Sorular ({questions.length})</h3>
                            <div className="questions-list">
                                {questions.map((q, index) => (
                                    <div key={q.id} className="question-preview">
                                        <div className="question-header">
                                            <span className="question-number">Soru {index + 1}</span>
                                            <span className="question-type">{getQuestionTypeLabel(q.type)}</span>
                                            <span className="question-points">{q.points} puan</span>
                                        </div>
                                        <p className="question-content">{q.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="detail-sidebar">
                    <div className="action-card">
                        {canStart && !isInstructor && (
                            <button className="primary-action start" onClick={handleStartExam}>
                                🚀 Sınava Başla
                            </button>
                        )}

                        {isInstructor && (
                            <>
                                {exam.status === 'Draft' && (
                                    <button
                                        className="primary-action publish"
                                        onClick={() => setShowConfirm(true)}
                                        disabled={publishing}
                                    >
                                        {publishing ? 'Yayınlanıyor...' : '📤 Sınavı Yayınla'}
                                    </button>
                                )}
                                <Link to={`/exams/${exam.id}/edit`} className="secondary-action">
                                    ✏️ Düzenle
                                </Link>
                                <button className="danger-action" onClick={handleDelete}>
                                    🗑️ Sil
                                </button>
                            </>
                        )}
                    </div>

                    <div className="info-card">
                        <h4>ℹ️ Bilgilendirme</h4>
                        <ul>
                            <li>Sınav başladıktan sonra süre işlemeye başlar</li>
                            <li>Sayfa kapatılsa bile süre devam eder</li>
                            <li>Süre bitiminde sınav otomatik teslim edilir</li>
                        </ul>
                    </div>
                </div>
            </div>

            {showConfirm && (
                <div className="modal-overlay">
                    <div className="confirm-modal">
                        <h3>Sınavı Yayınla</h3>
                        <p>Sınav yayınlandıktan sonra sorular değiştirilemez. Devam etmek istiyor musunuz?</p>
                        <div className="confirm-actions">
                            <button onClick={() => setShowConfirm(false)}>İptal</button>
                            <button onClick={handlePublish} className="confirm-btn">
                                {publishing ? 'Yayınlanıyor...' : 'Evet, Yayınla'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
