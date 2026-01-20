import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { examService } from '../../services/exam.service';
import { liveQuizHub } from '../../services/liveQuizHub';
import type { Exam, Question } from '../../types';
import './LiveQuizPresenter.css';

interface ParticipantData {
    odaId: string;
    odaName: string;
    connectionId: string;
    score: number;
}

interface AnswerStats {
    [answer: string]: number;
}

export const LiveQuizPresenterPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [exam, setExam] = useState<Exam | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [quizCode, setQuizCode] = useState<string>('');
    const [participants, setParticipants] = useState<ParticipantData[]>([]);
    const [answerStats, setAnswerStats] = useState<AnswerStats>({});
    const [showAnswer, setShowAnswer] = useState(false);
    const [isQuizActive, setIsQuizActive] = useState(false);

    useEffect(() => {
        if (id) {
            loadExamData();
        }
        return () => {
            liveQuizHub.disconnect();
        };
    }, [id]);

    const loadExamData = async () => {
        if (!id) return;
        setIsLoading(true);
        try {
            const [examData, questionsData] = await Promise.all([
                examService.getExam(id),
                examService.getQuestions(id),
            ]);
            setExam(examData);
            setQuestions(questionsData.sort((a, b) => a.orderIndex - b.orderIndex));
        } catch (error) {
            console.error('Failed to load exam:', error);
            alert('Sınav yüklenirken hata oluştu.');
            navigate('/app/exams');
        } finally {
            setIsLoading(false);
        }
    };

    const setupHubListeners = useCallback(() => {
        liveQuizHub.on<ParticipantData>('ParticipantJoined', (data) => {
            setParticipants(prev => [...prev, data]);
        });

        liveQuizHub.on<{ odaId: string }>('ParticipantLeft', (data) => {
            setParticipants(prev => prev.filter(p => p.odaId !== data.odaId));
        });

        liveQuizHub.on<{ odaId: string; answer: string }>('AnswerReceived', (data) => {
            setAnswerStats(prev => ({
                ...prev,
                [data.answer]: (prev[data.answer] || 0) + 1,
            }));
        });
    }, []);

    const startQuiz = async () => {
        if (!id) return;

        const token = localStorage.getItem('accessToken');
        if (!token) {
            alert('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
            return;
        }

        try {
            await liveQuizHub.connect(token);
            setupHubListeners();
            const code = await liveQuizHub.startLiveQuiz(id);
            setQuizCode(code);
            setIsQuizActive(true);
            setCurrentIndex(0);
            setAnswerStats({});
            setShowAnswer(false);
        } catch (error) {
            console.error('Failed to start quiz:', error);
            alert('Quiz başlatılamadı.');
        }
    };

    const endQuiz = async () => {
        if (!id) return;

        if (!confirm('Quiz\'i sonlandırmak istediğinizden emin misiniz?')) return;

        try {
            await liveQuizHub.endLiveQuiz(id);
            setIsQuizActive(false);
            setQuizCode('');
            setParticipants([]);
        } catch (error) {
            console.error('Failed to end quiz:', error);
        }
    };

    const nextQuestion = async () => {
        if (!id || currentIndex >= questions.length - 1) return;

        try {
            await liveQuizHub.nextQuestion(id);
            setCurrentIndex(prev => prev + 1);
            setAnswerStats({});
            setShowAnswer(false);
        } catch (error) {
            console.error('Failed to go to next question:', error);
        }
    };

    const previousQuestion = async () => {
        if (!id || currentIndex <= 0) return;

        try {
            await liveQuizHub.previousQuestion(id);
            setCurrentIndex(prev => prev - 1);
            setAnswerStats({});
            setShowAnswer(false);
        } catch (error) {
            console.error('Failed to go to previous question:', error);
        }
    };

    const revealAnswer = async () => {
        if (!id) return;

        try {
            await liveQuizHub.revealAnswer(id);
            setShowAnswer(true);
        } catch (error) {
            console.error('Failed to reveal answer:', error);
        }
    };

    const currentQuestion = questions[currentIndex];
    const totalAnswers = Object.values(answerStats).reduce((a, b) => a + b, 0);
    const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

    if (isLoading) {
        return (
            <div className="live-quiz-presenter">
                <div className="live-quiz-loading">
                    <div className="loading-spinner" />
                    <span>Yükleniyor...</span>
                </div>
            </div>
        );
    }

    if (!exam || questions.length === 0) {
        return (
            <div className="live-quiz-presenter">
                <div className="live-quiz-error">
                    <h2>Quiz bulunamadı veya soru yok</h2>
                    <Button onClick={() => navigate('/app/exams')}>Sınavlara Dön</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="live-quiz-presenter">
            {/* Header */}
            <header className="presenter-header">
                <div className="presenter-header-left">
                    <Button variant="ghost" onClick={() => navigate('/app/exams')}>
                        ← Çıkış
                    </Button>
                    <h1>{exam.title}</h1>
                </div>
                <div className="presenter-header-center">
                    {isQuizActive && quizCode && (
                        <div className="quiz-code-display">
                            <span className="quiz-code-label">Quiz Kodu:</span>
                            <span className="quiz-code-value">{quizCode}</span>
                        </div>
                    )}
                </div>
                <div className="presenter-header-right">
                    <div className="participant-count">
                        👥 {participants.length} Katılımcı
                    </div>
                    {!isQuizActive ? (
                        <Button variant="primary" onClick={startQuiz}>
                            🚀 Quiz'i Başlat
                        </Button>
                    ) : (
                        <Button variant="secondary" onClick={endQuiz}>
                            ⏹️ Sonlandır
                        </Button>
                    )}
                </div>
            </header>

            {!isQuizActive ? (
                /* Waiting State */
                <div className="presenter-waiting">
                    <div className="waiting-icon">🎯</div>
                    <h2>Quiz'i Başlatmaya Hazır</h2>
                    <p>{questions.length} soru • {exam.durationMinutes} dakika</p>
                    <Button variant="primary" size="lg" onClick={startQuiz}>
                        🚀 Quiz'i Başlat
                    </Button>
                </div>
            ) : (
                /* Active Quiz */
                <div className="presenter-content">
                    {/* Question Display */}
                    <div className="presenter-question-area">
                        <div className="question-progress">
                            <span>Soru {currentIndex + 1} / {questions.length}</span>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                                />
                            </div>
                        </div>

                        <div className="question-card-presenter">
                            <div className="question-type-badge">
                                {currentQuestion.type === 'MultipleChoice' && '📝 Çoktan Seçmeli'}
                                {currentQuestion.type === 'TrueFalse' && '✓✗ Doğru/Yanlış'}
                                {currentQuestion.type === 'ShortAnswer' && '✏️ Kısa Cevap'}
                            </div>
                            <div className="question-text-presenter">
                                {currentQuestion.content}
                            </div>

                            {currentQuestion.options && currentQuestion.options.length > 0 && (
                                <div className="options-grid-presenter">
                                    {currentQuestion.options.map((option, idx) => {
                                        const letter = OPTION_LETTERS[idx];
                                        const count = answerStats[letter] || 0;
                                        const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;
                                        const isCorrect = showAnswer && currentQuestion.correctAnswer === letter;

                                        return (
                                            <div
                                                key={idx}
                                                className={`option-bar ${isCorrect ? 'correct' : ''}`}
                                            >
                                                <div className="option-bar-content">
                                                    <span className="option-letter-presenter">{letter}</span>
                                                    <span className="option-text-presenter">{option}</span>
                                                    <span className="option-count">{count}</span>
                                                </div>
                                                <div
                                                    className="option-bar-fill"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="question-stats">
                            <div className="stat-item">
                                <span className="stat-value">{totalAnswers}</span>
                                <span className="stat-label">Yanıt</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{currentQuestion.points}</span>
                                <span className="stat-label">Puan</span>
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="presenter-controls">
                        <Button
                            variant="secondary"
                            onClick={previousQuestion}
                            disabled={currentIndex === 0}
                        >
                            ← Önceki
                        </Button>

                        {!showAnswer ? (
                            <Button variant="primary" onClick={revealAnswer}>
                                👁️ Cevabı Göster
                            </Button>
                        ) : (
                            <div className="answer-revealed">
                                ✅ Doğru Cevap: {currentQuestion.correctAnswer}
                            </div>
                        )}

                        <Button
                            variant="secondary"
                            onClick={nextQuestion}
                            disabled={currentIndex === questions.length - 1}
                        >
                            Sonraki →
                        </Button>
                    </div>

                    {/* Participants Sidebar */}
                    <div className="participants-sidebar">
                        <h3>👥 Katılımcılar ({participants.length})</h3>
                        <div className="participants-list">
                            {participants.map((p) => (
                                <div key={p.connectionId} className="participant-item">
                                    <span className="participant-name">{p.odaName}</span>
                                    <span className="participant-score">{p.score} puan</span>
                                </div>
                            ))}
                            {participants.length === 0 && (
                                <div className="no-participants">
                                    Henüz katılımcı yok
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveQuizPresenterPage;
