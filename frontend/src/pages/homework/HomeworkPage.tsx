import React, { useEffect, useState } from 'react';
import { Card, Button } from '../../components/ui';
import { homeworkService } from '../../services/homework.service';
import { useAuthStore } from '../../stores/authStore';
import type { Homework } from '../../types';
import './Homework.css';

export const HomeworkPage: React.FC = () => {
    const { user } = useAuthStore();
    const [homeworks, setHomeworks] = useState<Homework[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const isInstructor = user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin';

    useEffect(() => {
        const fetchHomeworks = async () => {
            try {
                const response = await homeworkService.getHomeworks(undefined, 1, 20);
                setHomeworks(response.items);
            } catch (error) {
                console.error('Failed to fetch homeworks:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHomeworks();
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

    const getDueStatus = (homework: Homework) => {
        const now = new Date();
        const due = new Date(homework.dueDate);
        const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return <span className="homework-status homework-status-overdue">Süresi Geçti</span>;
        } else if (diffDays <= 2) {
            return <span className="homework-status homework-status-urgent">Acil ({diffDays} gün)</span>;
        } else {
            return <span className="homework-status homework-status-normal">{diffDays} gün kaldı</span>;
        }
    };

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">📖 Ödevler</h1>
                    <p className="page-subtitle">Ödevleriniz ve teslim durumları</p>
                </div>
                {isInstructor && (
                    <Button variant="primary" size="md">
                        + Yeni Ödev Oluştur
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className="homework-loading">
                    <div className="homework-loading-spinner" />
                    <span>Ödevler yükleniyor...</span>
                </div>
            ) : homeworks.length > 0 ? (
                <div className="homework-list">
                    {homeworks.map(homework => (
                        <Card key={homework.id} variant="default" padding="md" hoverable className="homework-card">
                            <div className="homework-card-header">
                                <div className="homework-info">
                                    <h3 className="homework-title">{homework.title}</h3>
                                    <p className="homework-classroom">📚 {homework.classroomName}</p>
                                </div>
                                {getDueStatus(homework)}
                            </div>

                            <p className="homework-description">{homework.description}</p>

                            <div className="homework-meta">
                                <div className="homework-meta-item">
                                    <span className="homework-meta-icon">📅</span>
                                    <span>Teslim: {formatDate(homework.dueDate)}</span>
                                </div>
                                <div className="homework-meta-item">
                                    <span className="homework-meta-icon">🏆</span>
                                    <span>Maks. {homework.maxScore} puan</span>
                                </div>
                                {homework.allowLateSubmission && (
                                    <div className="homework-meta-item">
                                        <span className="homework-meta-icon">⚠️</span>
                                        <span>Geç teslimde -%{homework.latePenaltyPercent}</span>
                                    </div>
                                )}
                                {isInstructor && (
                                    <div className="homework-meta-item">
                                        <span className="homework-meta-icon">📤</span>
                                        <span>{homework.submissionCount} teslim</span>
                                    </div>
                                )}
                            </div>

                            <div className="homework-actions">
                                {!isInstructor && (
                                    <Button variant="primary" size="md">
                                        Ödevi Teslim Et
                                    </Button>
                                )}
                                {isInstructor && (
                                    <>
                                        <Button variant="outline" size="sm">Düzenle</Button>
                                        <Button variant="ghost" size="sm">Teslimler ({homework.submissionCount})</Button>
                                    </>
                                )}
                                {homework.attachmentUrl && (
                                    <Button variant="ghost" size="sm">
                                        📎 Ek Dosya
                                    </Button>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card variant="default" padding="lg" className="homework-empty animate-slideUp">
                    <div className="homework-empty-content">
                        <span className="homework-empty-icon">📖</span>
                        <h3 className="homework-empty-title">Henüz ödev yok</h3>
                        <p className="homework-empty-text">
                            {isInstructor
                                ? 'İlk ödevinizi oluşturun!'
                                : 'Kayıtlı olduğunuz sınıflardaki ödevler burada görünecektir.'
                            }
                        </p>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default HomeworkPage;
