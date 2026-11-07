import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    liveQuizHub,
    LIVE_QUIZ_EVENTS,
    type JoinedQuizPayload,
    type QuestionStartedPayload,
    type QuizEndedPayload,
    type ScoreUpdatedPayload,
} from '../../services/liveQuizHub';
import './LiveQuizPanel.css';

interface LiveQuizStudentPanelProps {
    quizCode: string | null;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/// Compact, embeddable version of LiveQuizVoterPage — auto-joins with the code the instructor
/// broadcast to the room (via ClassroomHub's QuizStarted event) instead of asking the student
/// to type it in manually.
export const LiveQuizStudentPanel: React.FC<LiveQuizStudentPanelProps> = ({ quizCode }) => {
    const [currentQuestion, setCurrentQuestion] = useState<QuestionStartedPayload | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [waiting, setWaiting] = useState(true);
    const [quizEnded, setQuizEnded] = useState(false);
    const [answerResult, setAnswerResult] = useState<'correct' | 'wrong' | null>(null);
    const joinedCodeRef = useRef<string | null>(null);

    const setupHubListeners = useCallback(() => {
        liveQuizHub.on<JoinedQuizPayload>(LIVE_QUIZ_EVENTS.JoinedQuiz, (data) => setScore(data.score));
        liveQuizHub.on<QuestionStartedPayload>(LIVE_QUIZ_EVENTS.QuestionStarted, (data) => {
            setCurrentQuestion(data);
            setSelectedAnswer(null);
            setHasSubmitted(data.hasAnswered || data.revealed);
            setWaiting(data.revealed);
            setAnswerResult(null);
        });
        liveQuizHub.on(LIVE_QUIZ_EVENTS.QuestionEnded, () => setWaiting(true));
        // Doğru/yanlış bilgisi sunucunun puanlamasından gelir.
        liveQuizHub.on<ScoreUpdatedPayload>(LIVE_QUIZ_EVENTS.ScoreUpdated, (data) => {
            setScore(data.score);
            setAnswerResult(data.answered ? (data.correct ? 'correct' : 'wrong') : null);
        });
        liveQuizHub.on<QuizEndedPayload>(LIVE_QUIZ_EVENTS.QuizEnded, (data) => {
            setQuizEnded(true);
            if (data.totalScore !== undefined) setScore(data.totalScore);
        });
    }, []);

    useEffect(() => {
        if (!quizCode) {
            joinedCodeRef.current = null;
            return;
        }
        if (joinedCodeRef.current === quizCode) return;
        joinedCodeRef.current = quizCode;

        const token = localStorage.getItem('accessToken');
        if (!token) return;

        liveQuizHub.connect(token).then(() => {
            setQuizEnded(false);
            setWaiting(true);
            setScore(0);
            setupHubListeners();
            return liveQuizHub.joinQuiz(quizCode);
        }).catch((error: unknown) => {
            console.error('Failed to join quiz:', error);
            joinedCodeRef.current = null;
        });
    }, [quizCode, setupHubListeners]);

    const handleSubmit = async () => {
        if (!selectedAnswer || !currentQuestion || hasSubmitted) return;
        await liveQuizHub.submitAnswer(currentQuestion.examId, currentQuestion.id, selectedAnswer);
        setHasSubmitted(true);
    };

    if (!quizCode) {
        return <div className="quiz-panel"><p className="quiz-panel-empty">Şu anda aktif bir quiz yok.</p></div>;
    }

    if (quizEnded) {
        return (
            <div className="quiz-panel">
                <div className="quiz-panel-end">
                    <div>🏆</div>
                    <h3>Quiz Bitti!</h3>
                    <p>Toplam puanınız: <strong>{score}</strong></p>
                </div>
            </div>
        );
    }

    if (waiting || !currentQuestion) {
        return (
            <div className="quiz-panel">
                <div className="quiz-panel-end">
                    <div>⏳</div>
                    {answerResult && <p>{answerResult === 'correct' ? '🎉 Doğru!' : '❌ Yanlış'}</p>}
                    <h3>Soru bekleniyor...</h3>
                    <p>Puanınız: <strong>{score}</strong></p>
                </div>
            </div>
        );
    }

    return (
        <div className="quiz-panel">
            <div className="quiz-panel-progress">
                Soru {currentQuestion.orderIndex} / {currentQuestion.totalQuestions} · {score} puan
            </div>
            <div className="quiz-panel-question">{currentQuestion.content}</div>
            {currentQuestion.imageUrl && (
                <img className="quiz-panel-image" src={currentQuestion.imageUrl} alt="Soru görseli" />
            )}

            {currentQuestion.options.length === 0 && (
                <input
                    className="quiz-panel-select"
                    value={selectedAnswer ?? ''}
                    onChange={(e) => !hasSubmitted && setSelectedAnswer(e.target.value || null)}
                    placeholder="Cevabınız"
                    disabled={hasSubmitted}
                />
            )}

            {currentQuestion.options.map((option, idx) => {
                const letter = OPTION_LETTERS[idx];
                const isSelected = selectedAnswer === letter;
                let cls = 'quiz-panel-answer-btn';
                if (isSelected) cls += ' selected';
                if (hasSubmitted && isSelected && answerResult) cls += answerResult === 'correct' ? ' correct' : ' wrong';

                return (
                    <button
                        key={idx}
                        className={cls}
                        onClick={() => !hasSubmitted && setSelectedAnswer(letter)}
                        disabled={hasSubmitted}
                    >
                        {letter}. {option}
                    </button>
                );
            })}

            {!hasSubmitted ? (
                <button className="quiz-panel-submit" onClick={handleSubmit} disabled={!selectedAnswer}>
                    ✓ Cevabı Gönder
                </button>
            ) : (
                <div className="quiz-panel-submitted">
                    {answerResult === 'correct' ? '🎉 Doğru!' : answerResult === 'wrong' ? '❌ Yanlış' : '✅ Cevabınız gönderildi'}
                </div>
            )}
        </div>
    );
};

export default LiveQuizStudentPanel;
