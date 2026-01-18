import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { homeworkApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Homework, Submission } from '../../types';
import './Homework.css';

export const HomeworkListPage: React.FC = () => {
    const { user } = useAuthStore();
    const [homeworks, setHomeworks] = useState<Homework[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        loadHomeworks();
    }, [page]);

    const loadHomeworks = async () => {
        try {
            const response = await homeworkApi.getAll(undefined, page, 10);
            if (response.data.success && response.data.data) {
                setHomeworks(response.data.data.items);
                setTotalPages(response.data.data.totalPages);
            }
        } catch (error) {
            console.error('Failed to load homeworks:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const isOverdue = (dueDate: string) => {
        return new Date(dueDate) < new Date();
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
                <p>Ödevler yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="homework-page">
            <header className="page-header">
                <div>
                    <h1>📝 Ödevler</h1>
                    <p>Tüm ödevlerinizi buradan takip edebilirsiniz</p>
                </div>
                {(user?.role === 'Instructor' || user?.role === 'Admin') && (
                    <Link to="/homework/new" className="create-btn">
                        + Yeni Ödev
                    </Link>
                )}
            </header>

            <div className="homework-list">
                {homeworks.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">📋</span>
                        <h3>Henüz ödev yok</h3>
                        <p>Ödevler eklendiğinde burada görünecek</p>
                    </div>
                ) : (
                    homeworks.map(hw => (
                        <Link key={hw.id} to={`/homework/${hw.id}`} className="homework-card">
                            <div className="homework-icon">📝</div>
                            <div className="homework-info">
                                <h3>{hw.title}</h3>
                                <p className="homework-classroom">{hw.classroomName}</p>
                                <p className="homework-description">{hw.description}</p>
                            </div>
                            <div className="homework-meta">
                                <div className={`due-date ${isOverdue(hw.dueDate) ? 'overdue' : ''}`}>
                                    <span className="label">Son Teslim</span>
                                    <span className="value">{formatDate(hw.dueDate)}</span>
                                </div>
                                <div className="max-score">
                                    <span className="label">Puan</span>
                                    <span className="value">{hw.maxScore}</span>
                                </div>
                                <div className="submissions">
                                    <span className="label">Teslim</span>
                                    <span className="value">{hw.submissionCount}</span>
                                </div>
                            </div>
                            {isOverdue(hw.dueDate) && !hw.allowLateSubmission && (
                                <span className="status-badge overdue">Süre Doldu</span>
                            )}
                            {isOverdue(hw.dueDate) && hw.allowLateSubmission && (
                                <span className="status-badge late">Geç Teslim</span>
                            )}
                        </Link>
                    ))
                )}
            </div>

            {totalPages > 1 && (
                <div className="pagination">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        ← Önceki
                    </button>
                    <span>Sayfa {page} / {totalPages}</span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        Sonraki →
                    </button>
                </div>
            )}
        </div>
    );
};

export const HomeworkDetailPage: React.FC = () => {
    const { user } = useAuthStore();
    const [homework, setHomework] = useState<Homework | null>(null);
    const [submission, setSubmission] = useState<Submission | null>(null);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const homeworkId = window.location.pathname.split('/').pop()!;

    useEffect(() => {
        loadHomework();
    }, [homeworkId]);

    const loadHomework = async () => {
        try {
            const [hwRes, subRes] = await Promise.all([
                homeworkApi.get(homeworkId),
                homeworkApi.getMySubmission(homeworkId).catch(() => null)
            ]);

            if (hwRes.data.success) {
                setHomework(hwRes.data.data!);
            }
            if (subRes?.data.success) {
                setSubmission(subRes.data.data!);
                setContent(subRes.data.data?.content || '');
            }
        } catch (error) {
            console.error('Failed to load homework:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!content.trim()) return;

        setSubmitting(true);
        try {
            const response = await homeworkApi.submit(homeworkId, { content });
            if (response.data.success) {
                setSubmission(response.data.data!);
                alert('Ödev başarıyla teslim edildi!');
            }
        } catch (error) {
            alert('Ödev teslim edilirken hata oluştu');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="loading"><div className="spinner"></div></div>;
    }

    if (!homework) {
        return <div className="error">Ödev bulunamadı</div>;
    }

    return (
        <div className="homework-detail">
            <header className="detail-header">
                <Link to="/homework" className="back-btn">← Ödevlere Dön</Link>
                <h1>{homework.title}</h1>
                <span className="classroom-name">{homework.classroomName}</span>
            </header>

            <div className="detail-content">
                <section className="homework-description-section">
                    <h2>📋 Açıklama</h2>
                    <p>{homework.description}</p>

                    {homework.attachmentUrl && (
                        <a href={homework.attachmentUrl} target="_blank" rel="noopener noreferrer" className="attachment-link">
                            📎 Ek Dosyayı İndir
                        </a>
                    )}
                </section>

                <section className="homework-info-section">
                    <div className="info-grid">
                        <div className="info-item">
                            <span className="info-label">Son Teslim</span>
                            <span className="info-value">
                                {new Date(homework.dueDate).toLocaleDateString('tr-TR', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Maksimum Puan</span>
                            <span className="info-value">{homework.maxScore}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Geç Teslim</span>
                            <span className="info-value">
                                {homework.allowLateSubmission ? `İzin Var (-%${homework.latePenaltyPercent} ceza)` : 'İzin Yok'}
                            </span>
                        </div>
                    </div>
                </section>

                {user?.role === 'Student' && (
                    <section className="submission-section">
                        <h2>✍️ Cevabınız</h2>

                        {submission?.status === 'Graded' ? (
                            <div className="graded-result">
                                <div className="score">
                                    <span className="score-value">{submission.score}</span>
                                    <span className="score-max">/ {homework.maxScore}</span>
                                </div>
                                {submission.feedback && (
                                    <div className="feedback">
                                        <h4>Geri Bildirim:</h4>
                                        <p>{submission.feedback}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Cevabınızı buraya yazın..."
                                    rows={10}
                                    disabled={submission?.status === 'Submitted' || submission?.status === 'Late'}
                                />

                                {submission && (
                                    <p className="submission-status">
                                        ✅ Teslim edildi: {new Date(submission.submittedAt!).toLocaleString('tr-TR')}
                                    </p>
                                )}

                                <button
                                    className="submit-btn"
                                    onClick={handleSubmit}
                                    disabled={submitting || !content.trim()}
                                >
                                    {submitting ? 'Gönderiliyor...' : submission ? 'Güncelle' : 'Teslim Et'}
                                </button>
                            </>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
};
