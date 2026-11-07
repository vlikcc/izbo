import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import {
    liveQuizHub,
    LIVE_QUIZ_EVENTS,
    type JoinedQuizPayload,
    type QuestionStartedPayload,
    type QuizEndedPayload,
    type ScoreUpdatedPayload,
} from '../../services/liveQuizHub';
import { useAuthStore } from '../../stores/authStore';
import './LiveQuizVoter.css';

export const LiveQuizVoterPage: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [joinCode, setJoinCode] = useState(code || '');
    const [isJoining, setIsJoining] = useState(false);
    const [isJoined, setIsJoined] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState<QuestionStartedPayload | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [waitingForQuestion, setWaitingForQuestion] = useState(false);
    const [quizEnded, setQuizEnded] = useState(false);
    const [finalRank, setFinalRank] = useState<number | null>(null);
    const [answerResult, setAnswerResult] = useState<'correct' | 'wrong' | null>(null);

    const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (code && token) {
            void handleJoin();
        }

        return () => {
            void liveQuizHub.disconnect();
        };
        // Join once on mount when the URL already includes a code.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setupHubListeners = useCallback(() => {
        liveQuizHub.on<JoinedQuizPayload>(LIVE_QUIZ_EVENTS.JoinedQuiz, (data) => {
            setScore(data.score);
        });

        liveQuizHub.on<QuestionStartedPayload>(LIVE_QUIZ_EVENTS.QuestionStarted, (data) => {
            setCurrentQuestion(data);
            setSelectedAnswer(null);
            setHasSubmitted(data.hasAnswered || data.revealed);
            setWaitingForQuestion(data.revealed);
            setAnswerResult(null);
        });

        liveQuizHub.on(LIVE_QUIZ_EVENTS.QuestionEnded, () => {
            setWaitingForQuestion(true);
        });

        // Doğru/yanlış bilgisi sunucunun puanlamasından gelir; istemci kendi karşılaştırmaz.
        liveQuizHub.on<ScoreUpdatedPayload>(LIVE_QUIZ_EVENTS.ScoreUpdated, (data) => {
            setScore(data.score);
            setAnswerResult(data.answered ? (data.correct ? 'correct' : 'wrong') : null);
        });

        liveQuizHub.on<QuizEndedPayload>(LIVE_QUIZ_EVENTS.QuizEnded, (data) => {
            setQuizEnded(true);
            setFinalRank(data.rank ?? null);
            if (data.totalScore !== undefined) setScore(data.totalScore);
        });
    }, []);

    const handleJoin = async () => {
        if (!joinCode.trim()) return;

        const token = localStorage.getItem('accessToken');
        if (!token) {
            alert('Oturum bulunamadı. Lütfen giriş yapın.');
            return;
        }

        setIsJoining(true);
        try {
            await liveQuizHub.connect(token);
            setupHubListeners();
            await liveQuizHub.joinQuiz(joinCode.trim().toUpperCase());
            setIsJoined(true);
            setWaitingForQuestion(true);
        } catch (error) {
            console.error('Failed to join quiz:', error);
            const message = error instanceof Error ? error.message.replace(/^.*HubException:\s*/, '') : '';
            alert(message || 'Quiz\'e katılınamadı. Kodu kontrol edin.');
        } finally {
            setIsJoining(false);
        }
    };

    const handleAnswerSelect = (answer: string) => {
        if (hasSubmitted) return;
        setSelectedAnswer(answer);
    };

    const handleSubmitAnswer = async () => {
        if (!selectedAnswer || !currentQuestion || hasSubmitted) return;

        try {
            await liveQuizHub.submitAnswer(currentQuestion.examId, currentQuestion.id, selectedAnswer);
            setHasSubmitted(true);
        } catch (error) {
            console.error('Failed to submit answer:', error);
        }
    };

    const handleLeave = () => {
        liveQuizHub.disconnect();
        navigate('/app/exams');
    };

    // Join Screen
    if (!isJoined) {
        return (
            <div className="live-quiz-voter">
                <div className="voter-join-screen">
                    <div className="join-logo">🎯</div>
                    <h1>Quiz'e Katıl</h1>
                    <p>Öğretmeninizden aldığınız kodu girin</p>

                    <div className="join-form">
                        <input
                            type="text"
                            className="join-code-input"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="QUIZ KODU"
                            maxLength={6}
                            autoFocus
                        />
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={handleJoin}
                            isLoading={isJoining}
                            disabled={!joinCode.trim()}
                        >
                            Katıl
                        </Button>
                    </div>

                    <Button variant="ghost" onClick={() => navigate('/app/exams')}>
                        ← Geri Dön
                    </Button>
                </div>
            </div>
        );
    }

    // Quiz Ended Screen
    if (quizEnded) {
        return (
            <div className="live-quiz-voter">
                <div className="voter-end-screen">
                    <div className="end-trophy">🏆</div>
                    <h1>Quiz Bitti!</h1>

                    <div className="final-stats">
                        <div className="final-stat">
                            <span className="final-stat-value">{score}</span>
                            <span className="final-stat-label">Toplam Puan</span>
                        </div>
                        {finalRank && (
                            <div className="final-stat">
                                <span className="final-stat-value">#{finalRank}</span>
                                <span className="final-stat-label">Sıralama</span>
                            </div>
                        )}
                    </div>

                    <Button variant="primary" size="lg" onClick={handleLeave}>
                        Tamam
                    </Button>
                </div>
            </div>
        );
    }

    // Waiting for Question
    if (waitingForQuestion || !currentQuestion) {
        return (
            <div className="live-quiz-voter">
                <div className="voter-waiting">
                    <div className="waiting-pulse" />
                    {answerResult && (
                        <div className={`answer-result ${answerResult}`}>
                            {answerResult === 'correct' ? '🎉 Doğru!' : '❌ Yanlış'}
                        </div>
                    )}
                    <h2>Soru Bekleniyor...</h2>
                    <p>Öğretmen bir sonraki soruyu başlattığında görünecek</p>

                    <div className="current-score">
                        <span className="score-label">Puanınız:</span>
                        <span className="score-value">{score}</span>
                    </div>
                </div>
            </div>
        );
    }

    // Question Screen
    return (
        <div className="live-quiz-voter">
            {/* Header */}
            <header className="voter-header">
                <div className="voter-header-left">
                    <span className="question-number">
                        Soru {currentQuestion.orderIndex} / {currentQuestion.totalQuestions}
                    </span>
                </div>
                <div className="voter-header-center" />
                <div className="voter-header-right">
                    <div className="voter-score">
                        {score} puan
                    </div>
                    <div className="voter-name">
                        {user?.firstName}
                    </div>
                </div>
            </header>

            {/* Question Content */}
            <div className="voter-content">
                <div className="voter-question-card">
                    <div className="voter-question-text">
                        {currentQuestion.content}
                    </div>
                    {currentQuestion.imageUrl && (
                        <img className="voter-question-image" src={currentQuestion.imageUrl} alt="Soru görseli" />
                    )}
                </div>

                {/* Şıksız (kısa cevap) sorular */}
                {currentQuestion.options.length === 0 && (
                    <input
                        type="text"
                        className="join-code-input voter-text-answer"
                        value={selectedAnswer ?? ''}
                        onChange={(e) => !hasSubmitted && setSelectedAnswer(e.target.value || null)}
                        placeholder="Cevabınız"
                        disabled={hasSubmitted}
                    />
                )}

                {/* Options */}
                <div className="voter-options">
                    {currentQuestion.options.map((option, idx) => {
                        const letter = OPTION_LETTERS[idx];
                        const isSelected = selectedAnswer === letter;
                        const showResult = answerResult !== null;

                        let buttonClass = 'voter-option';
                        if (isSelected) buttonClass += ' selected';
                        if (showResult && isSelected) {
                            buttonClass += answerResult === 'correct' ? ' correct' : ' wrong';
                        }

                        return (
                            <button
                                key={idx}
                                className={buttonClass}
                                onClick={() => handleAnswerSelect(letter)}
                                disabled={hasSubmitted}
                            >
                                <span className="voter-option-letter">{letter}</span>
                                <span className="voter-option-text">{option}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Submit Button */}
                {!hasSubmitted ? (
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={handleSubmitAnswer}
                        disabled={!selectedAnswer}
                        className="submit-answer-btn"
                    >
                        ✓ Cevabı Gönder
                    </Button>
                ) : (
                    <div className="answer-submitted">
                        {answerResult === null ? (
                            <>✅ Cevabınız gönderildi</>
                        ) : answerResult === 'correct' ? (
                            <>🎉 Doğru!</>
                        ) : (
                            <>❌ Yanlış</>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveQuizVoterPage;
