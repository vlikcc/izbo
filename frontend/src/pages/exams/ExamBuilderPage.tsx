import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { QuestionEditor } from '../../components/exams/QuestionEditor';
import { FileImportModal } from '../../components/exams/FileImportModal';
import { examService } from '../../services/exam.service';
import type { Exam, Question, CreateQuestionRequest } from '../../types';
import './ExamBuilder.css';

export const ExamBuilderPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [exam, setExam] = useState<Exam | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    useEffect(() => {
        if (id) {
            fetchExamData(id);
        }
    }, [id]);

    const fetchExamData = async (examId: string) => {
        setIsLoading(true);
        try {
            const [examData, questionsData] = await Promise.all([
                examService.getExam(examId),
                examService.getQuestions(examId),
            ]);
            setExam(examData);
            setQuestions(questionsData.sort((a, b) => a.orderIndex - b.orderIndex));
        } catch (error) {
            console.error('Failed to fetch exam data:', error);
            alert('Sınav yüklenirken bir hata oluştu.');
            navigate('/app/exams');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddQuestion = async (data: CreateQuestionRequest) => {
        if (!id) return;

        try {
            const newQuestion = await examService.addQuestion(id, {
                ...data,
                orderIndex: questions.length + 1,
            });
            setQuestions([...questions, newQuestion]);
            setIsAddingNew(false);
        } catch (error) {
            console.error('Failed to add question:', error);
            alert('Soru eklenirken bir hata oluştu.');
        }
    };

    const handleBulkImport = async (importedQuestions: CreateQuestionRequest[]) => {
        if (!id) return;

        setIsImporting(true);
        let successCount = 0;
        const newQuestions: Question[] = [];

        for (const q of importedQuestions) {
            try {
                const newQuestion = await examService.addQuestion(id, {
                    ...q,
                    orderIndex: questions.length + successCount + 1,
                });
                newQuestions.push(newQuestion);
                successCount++;
            } catch (error) {
                console.error('Failed to add question:', error);
            }
        }

        setQuestions([...questions, ...newQuestions]);
        setIsImporting(false);

        if (successCount > 0) {
            alert(`${successCount} soru başarıyla içe aktarıldı!`);
        } else {
            alert('Sorular içe aktarılırken bir hata oluştu.');
        }
    };

    const handleUpdateQuestion = async (questionId: string, data: CreateQuestionRequest) => {
        try {
            await examService.updateQuestion(questionId, data);
            // Refresh questions
            if (id) {
                const updatedQuestions = await examService.getQuestions(id);
                setQuestions(updatedQuestions.sort((a, b) => a.orderIndex - b.orderIndex));
            }
        } catch (error) {
            console.error('Failed to update question:', error);
            alert('Soru güncellenirken bir hata oluştu.');
        }
    };

    const handleDeleteQuestion = async (questionId: string) => {
        if (!confirm('Bu soruyu silmek istediğinizden emin misiniz?')) return;

        try {
            await examService.deleteQuestion(questionId);
            setQuestions(questions.filter(q => q.id !== questionId));
        } catch (error) {
            console.error('Failed to delete question:', error);
            alert('Soru silinirken bir hata oluştu.');
        }
    };

    const handlePublish = async () => {
        if (!id) return;

        if (questions.length === 0) {
            alert('Sınavı yayınlamak için en az bir soru eklemelisiniz.');
            return;
        }

        if (!confirm('Sınavı yayınlamak istediğinizden emin misiniz? Yayınlandıktan sonra öğrenciler sınava girebilir.')) {
            return;
        }

        setIsPublishing(true);
        try {
            await examService.publishExam(id);
            alert('Sınav başarıyla yayınlandı!');
            navigate('/app/exams');
        } catch (error) {
            console.error('Failed to publish exam:', error);
            alert('Sınav yayınlanırken bir hata oluştu.');
        } finally {
            setIsPublishing(false);
        }
    };

    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    if (isLoading) {
        return (
            <div className="exam-builder">
                <div className="exam-builder-loading">
                    <div className="exam-builder-loading-spinner" />
                    <span>Sınav yükleniyor...</span>
                </div>
            </div>
        );
    }

    if (!exam) {
        return (
            <div className="exam-builder">
                <div className="exam-builder-loading">
                    <span>Sınav bulunamadı.</span>
                    <Button variant="primary" onClick={() => navigate('/app/exams')}>
                        Sınavlara Dön
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="exam-builder">
            {/* Header */}
            <header className="exam-builder-header">
                <div className="exam-builder-header-content">
                    <div
                        className="exam-builder-back"
                        onClick={() => navigate('/app/exams')}
                    >
                        ← Sınavlara Dön
                    </div>

                    <div className="exam-builder-title">
                        <h1>📝 {exam.title}</h1>
                        <p>{exam.classroomName}</p>
                    </div>

                    <span className={`exam-status-badge ${exam.status.toLowerCase()}`}>
                        {exam.status === 'Draft' ? 'Taslak' : exam.status === 'Published' ? 'Yayında' : exam.status}
                    </span>

                    <div className="exam-builder-actions">
                        {exam.status === 'Draft' && (
                            <>
                                <Button
                                    variant="secondary"
                                    size="md"
                                    onClick={() => setIsImportModalOpen(true)}
                                    isLoading={isImporting}
                                >
                                    📁 Dosyadan İçe Aktar
                                </Button>
                                <Button
                                    variant="primary"
                                    size="md"
                                    onClick={handlePublish}
                                    isLoading={isPublishing}
                                >
                                    🚀 Yayınla
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Stats Bar */}
            <div className="exam-stats-bar">
                <div className="exam-stat-item">
                    <span className="exam-stat-icon">❓</span>
                    <span className="exam-stat-value">{questions.length}</span>
                    <span className="exam-stat-label">Soru</span>
                </div>
                <div className="exam-stat-item">
                    <span className="exam-stat-icon">🏆</span>
                    <span className="exam-stat-value">{totalPoints}</span>
                    <span className="exam-stat-label">Toplam Puan</span>
                </div>
                <div className="exam-stat-item">
                    <span className="exam-stat-icon">⏱️</span>
                    <span className="exam-stat-value">{exam.durationMinutes}</span>
                    <span className="exam-stat-label">Dakika</span>
                </div>
            </div>

            {/* Content */}
            <div className="exam-builder-content">
                {questions.length === 0 && !isAddingNew ? (
                    <div className="questions-empty">
                        <div className="questions-empty-icon">📋</div>
                        <h3 className="questions-empty-title">Henüz soru yok</h3>
                        <p className="questions-empty-text">
                            Sınava soru ekleyerek başlayın
                        </p>
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={() => setIsAddingNew(true)}
                        >
                            ➕ İlk Soruyu Ekle
                        </Button>
                    </div>
                ) : (
                    <div className="questions-list">
                        {questions.map((question) => (
                            <QuestionEditor
                                key={question.id}
                                question={question}
                                orderIndex={question.orderIndex}
                                onSave={(data) => handleUpdateQuestion(question.id, data)}
                                onDelete={() => handleDeleteQuestion(question.id)}
                            />
                        ))}

                        {isAddingNew ? (
                            <QuestionEditor
                                orderIndex={questions.length + 1}
                                onSave={handleAddQuestion}
                                onCancel={() => setIsAddingNew(false)}
                                isNew
                            />
                        ) : (
                            <div
                                className="add-question-card"
                                onClick={() => setIsAddingNew(true)}
                            >
                                <div className="add-question-card-icon">➕</div>
                                <div className="add-question-card-text">Yeni Soru Ekle</div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* File Import Modal */}
            <FileImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleBulkImport}
                startOrderIndex={questions.length + 1}
            />
        </div>
    );
};

export default ExamBuilderPage;

