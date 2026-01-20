import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { liveQuizHub } from '../../services/liveQuizHub';
import { useAuthStore } from '../../stores/authStore';
import './LiveQuizVoter.css';

interface QuestionData {
    id: string;
    content: string;
    type: string;
    options: string[];
    orderIndex: number;
    totalQuestions: number;
    timeLimit?: number;
}

export const LiveQuizVoterPage: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [joinCode, setJoinCode] = useState(code || '');
    const [isJoining, setIsJoining] = useState(false);
    const [isJoined, setIsJoined] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [waitingForQuestion, setWaitingForQuestion] = useState(false);
    const [quizEnded, setQuizEnded] = useState(false);
    const [finalRank, setFinalRank] = useState<number | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
    const [answerResult, setAnswerResult] = useState<'correct' | 'wrong' | null>(null);

    const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

    useEffect(() => {
        // Auto-join if code is in URL
        const token = localStorage.getItem('accessToken');
        if (code && token) {
            handleJoin();
        }

        return () => {
            liveQuizHub.disconnect();
        };
    }, []);

    const setupHubListeners = useCallback(() => {
        liveQuizHub.on<QuestionData>('QuestionStarted', (data) => {
            setCurrentQuestion(data);
            setSelectedAnswer(null);
            setHasSubmitted(false);
            setWaitingForQuestion(false);
            setAnswerResult(null);
            setTimeRemaining(data.timeLimit || null);
        });

        liveQuizHub.on<{ correctAnswer: string }>('QuestionEnded', (data) => {
            if (selectedAnswer === data.correctAnswer) {
                setAnswerResult('correct');
            } else if (selectedAnswer) {
                setAnswerResult('wrong');
            }
            setWaitingForQuestion(true);
        });

        liveQuizHub.on<{ score: number }>('ScoreUpdated', (data) => {
            setScore(data.score);
        });

        liveQuizHub.on<{ remaining: number }>('TimerTick', (data) => {
            setTimeRemaining(data.remaining);
        });

        liveQuizHub.on<{ rank: number; totalScore: number }>('QuizEnded', (data) => {
            setQuizEnded(true);
            setFinalRank(data.rank);
            setScore(data.totalScore);
        });
    }, [selectedAnswer]);

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
            alert('Quiz\'e katılınamadı. Kodu kontrol edin.');
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
            await liveQuizHub.submitAnswer('', currentQuestion.id, selectedAnswer);
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
                <div className="voter-header-center">
                    {timeRemaining !== null && (
                        <div className={`timer ${timeRemaining <= 5 ? 'warning' : ''}`}>
                            ⏱️ {timeRemaining}s
                        </div>
                    )}
                </div>
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
                </div>

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
