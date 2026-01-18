import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { examApi } from '../../services/api';
import { useExamHub } from '../../hooks/useSignalR';
import type { StartExamResponse, ExamResult } from '../../types';
import './ExamSession.css';

export const ExamSessionPage: React.FC = () => {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();
    const { invoke } = useExamHub();

    const [session, setSession] = useState<StartExamResponse | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<ExamResult | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        startExam();
    }, [examId]);

    useEffect(() => {
        if (remainingSeconds <= 0) return;

        const timer = setInterval(() => {
            setRemainingSeconds((prev) => {
                if (prev <= 1) {
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [remainingSeconds]);

    const startExam = async () => {
        try {
            const response = await examApi.startExam(examId!);
            if (response.data.success && response.data.data) {
                setSession(response.data.data);
                setRemainingSeconds(response.data.data.remainingSeconds);
                invoke('JoinExam', examId);
            } else {
                setError(response.data.message || 'Sınav başlatılamadı');
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            setError(error.response?.data?.message || 'Sınav başlatılırken hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = useCallback(async (questionId: string, answer: string) => {
        setAnswers((prev) => ({ ...prev, [questionId]: answer }));

        // Save to server
        if (session) {
            await examApi.saveAnswer(session.sessionId, { questionId, answer });
        }
    }, [session]);

    const handleSubmit = async () => {
        if (!session) return;

        setSubmitting(true);
        try {
            const response = await examApi.submitExam(session.sessionId);
            if (response.data.success && response.data.data) {
                setResult(response.data.data);
            }
        } catch (err) {
            console.error('Submit failed:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="exam-loading">
                <div className="spinner"></div>
                <p>Sınav yükleniyor...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="exam-error">
                <h2>❌ Hata</h2>
                <p>{error}</p>
                <button onClick={() => navigate('/exams')}>Sınavlara Dön</button>
            </div>
        );
    }

    if (result) {
        return (
            <div className="exam-result">
                <div className="result-card">
                    <div className={`result-icon ${result.isPassed ? 'passed' : 'failed'}`}>
                        {result.isPassed ? '🎉' : '😔'}
                    </div>
                    <h1>{result.isPassed ? 'Tebrikler!' : 'Maalesef'}</h1>
                    <h2>{result.examTitle}</h2>

                    <div className="result-score">
                        <span className="score">{result.totalScore}</span>
                        <span className="max-score">/ {result.maxScore}</span>
                    </div>

                    <div className="result-percentage">
                        <div className="percentage-bar">
                            <div
                                className="percentage-fill"
                                style={{ width: `${result.percentage}%` }}
                            ></div>
                        </div>
                        <span>%{result.percentage.toFixed(1)}</span>
                    </div>

                    <p className={`result-status ${result.isPassed ? 'passed' : 'failed'}`}>
                        {result.isPassed ? '✓ Geçtiniz' : '✕ Kaldınız'}
                    </p>

                    <button onClick={() => navigate('/exams')} className="result-btn">
                        Sınavlara Dön
                    </button>
                </div>
            </div>
        );
    }

    if (!session) return null;

    const currentQuestion = session.questions[currentQuestionIndex];
    const totalQuestions = session.questions.length;
    const answeredCount = Object.keys(answers).length;

    return (
        <div className="exam-session">
            <header className="exam-header">
                <div className="exam-progress">
                    <span>Soru {currentQuestionIndex + 1} / {totalQuestions}</span>
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                        ></div>
                    </div>
                </div>

                <div className={`exam-timer ${remainingSeconds < 300 ? 'warning' : ''}`}>
                    ⏱️ {formatTime(remainingSeconds)}
                </div>

                <div className="exam-answered">
                    ✓ {answeredCount} / {totalQuestions} yanıtlandı
                </div>
            </header>

            <main className="exam-main">
                <div className="question-card">
                    <div className="question-header">
                        <span className="question-type">{currentQuestion.type}</span>
                        <span className="question-points">{currentQuestion.points} puan</span>
                    </div>

                    <div className="question-content">
                        <p>{currentQuestion.content}</p>
                        {currentQuestion.imageUrl && (
                            <img src={currentQuestion.imageUrl} alt="Question" className="question-image" />
                        )}
                    </div>

                    <div className="question-options">
                        {currentQuestion.type === 'MultipleChoice' && currentQuestion.options?.map((option, index) => (
                            <button
                                key={index}
                                className={`option-btn ${answers[currentQuestion.id] === option ? 'selected' : ''}`}
                                onClick={() => handleAnswer(currentQuestion.id, option)}
                            >
                                <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                                <span className="option-text">{option}</span>
                            </button>
                        ))}

                        {currentQuestion.type === 'TrueFalse' && (
                            <>
                                <button
                                    className={`option-btn ${answers[currentQuestion.id] === 'true' ? 'selected' : ''}`}
                                    onClick={() => handleAnswer(currentQuestion.id, 'true')}
                                >
                                    <span className="option-text">✓ Doğru</span>
                                </button>
                                <button
                                    className={`option-btn ${answers[currentQuestion.id] === 'false' ? 'selected' : ''}`}
                                    onClick={() => handleAnswer(currentQuestion.id, 'false')}
                                >
                                    <span className="option-text">✕ Yanlış</span>
                                </button>
                            </>
                        )}

                        {(currentQuestion.type === 'FillInBlank' || currentQuestion.type === 'Essay') && (
                            <textarea
                                value={answers[currentQuestion.id] || ''}
                                onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                                placeholder="Cevabınızı yazın..."
                                className="answer-textarea"
                                rows={currentQuestion.type === 'Essay' ? 6 : 2}
                            />
                        )}
                    </div>
                </div>
            </main>

            <footer className="exam-footer">
                <div className="question-nav">
                    {session.questions.map((q, index) => (
                        <button
                            key={q.id}
                            className={`nav-btn ${index === currentQuestionIndex ? 'current' : ''} ${answers[q.id] ? 'answered' : ''}`}
                            onClick={() => setCurrentQuestionIndex(index)}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>

                <div className="footer-actions">
                    <button
                        className="nav-btn-large prev"
                        onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                        disabled={currentQuestionIndex === 0}
                    >
                        ← Önceki
                    </button>

                    {currentQuestionIndex < totalQuestions - 1 ? (
                        <button
                            className="nav-btn-large next"
                            onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                        >
                            Sonraki →
                        </button>
                    ) : (
                        <button
                            className="submit-btn"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? 'Gönderiliyor...' : '✓ Sınavı Bitir'}
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
};
