import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/ui';
import { CreateExamModal } from '../../components/exams/CreateExamModal';
import { examService } from '../../services/exam.service';
import { useAuthStore } from '../../stores/authStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { useUpgradeStore } from '../../stores/upgradeStore';
import type { Exam } from '../../types';
import './Exams.css';

export const ExamsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const hasLiveQuiz = useSubscriptionStore((s) => s.hasFeature('live_quiz'));
    const openUpgradeModal = useUpgradeStore((s) => s.open);
    const [exams, setExams] = useState<Exam[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const isInstructor = user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin';
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const fetchExams = async () => {
        setIsLoading(true);
        try {
            const response = await examService.getExams(undefined, 1, 20);
            setExams(response.items);
        } catch (error) {
            console.error('Failed to fetch exams:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchExams();
    }, []);

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (exam: Exam) => {
        const now = new Date();
        const start = new Date(exam.startTime);
        const end = new Date(exam.endTime);

        if (now < start) {
            return <span className="exam-status exam-status-upcoming">Yaklaşan</span>;
        } else if (now >= start && now <= end) {
            return <span className="exam-status exam-status-active">Aktif</span>;
        } else {
            return <span className="exam-status exam-status-ended">Bitti</span>;
        }
    };

    const handleEditExam = (examId: string) => {
        navigate(`/app/exams/${examId}/builder`);
    };

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">📝 Sınavlar</h1>
                    <p className="page-subtitle">Sınav takvimi ve sonuçlarınız</p>
                </div>
                <div className="page-header-actions">
                    <Button
                        variant="secondary"
                        size="md"
                        onClick={() => navigate('/quiz/join')}
                    >
                        🎯 Quiz'e Katıl
                    </Button>
                    {isInstructor && (
                        <Button variant="primary" size="md" onClick={() => setIsCreateModalOpen(true)}>
                            + Yeni Sınav Oluştur
                        </Button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="exams-loading">
                    <div className="exams-loading-spinner" />
                    <span>Sınavlar yükleniyor...</span>
                </div>
            ) : exams.length > 0 ? (
                <div className="exams-list">
                    {exams.map(exam => (
                        <Card key={exam.id} variant="default" padding="md" hoverable className="exam-card">
                            <div className="exam-card-header">
                                <div className="exam-info">
                                    <h3 className="exam-title">{exam.title}</h3>
                                    <p className="exam-classroom">📚 {exam.classroomName}</p>
                                </div>
                                {getStatusBadge(exam)}
                            </div>

                            {exam.description && (
                                <p className="exam-description">{exam.description}</p>
                            )}

                            <div className="exam-meta">
                                <div className="exam-meta-item">
                                    <span className="exam-meta-icon">📅</span>
                                    <span>{formatDate(exam.startTime)}</span>
                                </div>
                                <div className="exam-meta-item">
                                    <span className="exam-meta-icon">⏱️</span>
                                    <span>{exam.durationMinutes} dakika</span>
                                </div>
                                <div className="exam-meta-item">
                                    <span className="exam-meta-icon">❓</span>
                                    <span>{exam.questionCount} soru</span>
                                </div>
                                <div className="exam-meta-item">
                                    <span className="exam-meta-icon">🏆</span>
                                    <span>{exam.totalPoints} puan</span>
                                </div>
                            </div>

                            <div className="exam-actions">
                                {!isInstructor && new Date() >= new Date(exam.startTime) && new Date() <= new Date(exam.endTime) && (
                                    <Button variant="primary" size="md">
                                        Sınava Başla
                                    </Button>
                                )}
                                {isInstructor && (
                                    <>
                                        {exam.status === 'Published' && exam.questionCount > 0 && (
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => {
                                                    if (!hasLiveQuiz) {
                                                        openUpgradeModal({
                                                            message: 'Canlı quiz özelliği mevcut planınızda bulunmuyor.',
                                                            errorCode: 'QUOTA_EXCEEDED',
                                                            featureCode: 'live_quiz',
                                                            upgradeUrl: '/app/billing',
                                                        });
                                                        return;
                                                    }
                                                    navigate(`/quiz/presenter/${exam.id}`);
                                                }}
                                            >
                                                {hasLiveQuiz ? '🎯 Canlı Başlat' : '🔒 Canlı Başlat'}
                                            </Button>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => handleEditExam(exam.id)}>
                                            ✏️ Düzenle
                                        </Button>
                                        <Button variant="ghost" size="sm">Sonuçlar</Button>
                                    </>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card variant="default" padding="lg" className="exams-empty animate-slideUp">
                    <div className="exams-empty-content">
                        <span className="exams-empty-icon">📝</span>
                        <h3 className="exams-empty-title">Henüz sınav yok</h3>
                        <p className="exams-empty-text">
                            {isInstructor
                                ? 'İlk sınavınızı oluşturun!'
                                : 'Kayıtlı olduğunuz sınıflardaki sınavlar burada görünecektir.'
                            }
                        </p>
                    </div>
                </Card>
            )}

            <CreateExamModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchExams}
            />
        </div>
    );
};

export default ExamsPage;
