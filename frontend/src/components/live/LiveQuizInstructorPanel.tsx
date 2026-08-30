import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '../ui';
import { examService } from '../../services/exam.service';
import { liveQuizHub } from '../../services/liveQuizHub';
import type { Exam, Question } from '../../types';
import './LiveQuizPanel.css';

interface ParticipantData {
    odaId: string;
    odaName: string;
    connectionId: string;
    score: number;
}

interface AnswerStats {
    [answer: string]: number;
}

interface LiveQuizInstructorPanelProps {
    classroomId: string;
    onQuizStarted: (examId: string, quizCode: string) => void;
    onQuizEnded: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/// Compact, embeddable version of LiveQuizPresenterPage — same liveQuizHub contract, fitted
/// into the live class room's side panel instead of a dedicated full-screen route.
export const LiveQuizInstructorPanel: React.FC<LiveQuizInstructorPanelProps> = ({
    classroomId,
    onQuizStarted,
    onQuizEnded,
}) => {
    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedExamId, setSelectedExamId] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [quizCode, setQuizCode] = useState('');
    const [participants, setParticipants] = useState<ParticipantData[]>([]);
    const [answerStats, setAnswerStats] = useState<AnswerStats>({});
    const [showAnswer, setShowAnswer] = useState(false);
    const [isQuizActive, setIsQuizActive] = useState(false);
    const [isStarting, setIsStarting] = useState(false);

    useEffect(() => {
        examService.getExams(classroomId, 1, 100).then((res) => {
            setExams(res.items.filter((e) => e.status === 'Published' && e.questionCount > 0));
        });
        return () => {
            liveQuizHub.disconnect();
        };
    }, [classroomId]);

    const setupHubListeners = useCallback(() => {
        liveQuizHub.on<ParticipantData>('ParticipantJoined', (data) => {
            setParticipants((prev) => [...prev, data]);
        });
        liveQuizHub.on<{ odaId: string }>('ParticipantLeft', (data) => {
            setParticipants((prev) => prev.filter((p) => p.odaId !== data.odaId));
        });
        liveQuizHub.on<{ odaId: string; answer: string }>('AnswerReceived', (data) => {
            setAnswerStats((prev) => ({ ...prev, [data.answer]: (prev[data.answer] || 0) + 1 }));
        });
    }, []);

    const startQuiz = async () => {
        if (!selectedExamId) return;
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        setIsStarting(true);
        try {
            const questionsData = await examService.getQuestions(selectedExamId);
            setQuestions(questionsData.sort((a, b) => a.orderIndex - b.orderIndex));

            await liveQuizHub.connect(token);
            setupHubListeners();
            const code = await liveQuizHub.startLiveQuiz(selectedExamId);
            setQuizCode(code);
            setIsQuizActive(true);
            setCurrentIndex(0);
            setAnswerStats({});
            setShowAnswer(false);
            onQuizStarted(selectedExamId, code);
        } catch (error) {
            console.error('Failed to start quiz:', error);
            alert('Quiz başlatılamadı.');
        } finally {
            setIsStarting(false);
        }
    };

    const endQuiz = async () => {
        if (!selectedExamId) return;
        try {
            await liveQuizHub.endLiveQuiz(selectedExamId);
        } catch (error) {
            console.error('Failed to end quiz:', error);
        }
        setIsQuizActive(false);
        setQuizCode('');
        setParticipants([]);
        onQuizEnded();
    };

    const nextQuestion = async () => {
        if (currentIndex >= questions.length - 1) return;
        await liveQuizHub.nextQuestion(selectedExamId);
        setCurrentIndex((prev) => prev + 1);
        setAnswerStats({});
        setShowAnswer(false);
    };

    const previousQuestion = async () => {
        if (currentIndex <= 0) return;
        await liveQuizHub.previousQuestion(selectedExamId);
        setCurrentIndex((prev) => prev - 1);
        setAnswerStats({});
        setShowAnswer(false);
    };

    const revealAnswer = async () => {
        await liveQuizHub.revealAnswer(selectedExamId);
        setShowAnswer(true);
    };

    const currentQuestion = questions[currentIndex];
    const totalAnswers = Object.values(answerStats).reduce((a, b) => a + b, 0);

    if (!isQuizActive) {
        return (
            <div className="quiz-panel">
                <h3 className="quiz-panel-title">🎯 Anlık Quiz Başlat</h3>
                {exams.length === 0 ? (
                    <p className="quiz-panel-empty">Yayınlanmış ve sorulu bir sınavınız yok.</p>
                ) : (
                    <>
                        <select
                            className="quiz-panel-select"
                            value={selectedExamId}
                            onChange={(e) => setSelectedExamId(e.target.value)}
                        >
                            <option value="">Sınav seçin...</option>
                            {exams.map((exam) => (
                                <option key={exam.id} value={exam.id}>
                                    {exam.title} ({exam.questionCount} soru)
                                </option>
                            ))}
                        </select>
                        <Button
                            variant="primary"
                            fullWidth
                            onClick={startQuiz}
                            isLoading={isStarting}
                            disabled={!selectedExamId}
                        >
                            🚀 Quiz'i Başlat
                        </Button>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="quiz-panel">
            <div className="quiz-panel-active-header">
                <div className="quiz-code-display">
                    <span>Kod:</span> <strong>{quizCode}</strong>
                </div>
                <span className="quiz-panel-participants">👥 {participants.length}</span>
                <Button variant="ghost" size="sm" onClick={endQuiz}>⏹️ Bitir</Button>
            </div>

            {currentQuestion && (
                <>
                    <div className="quiz-panel-progress">
                        Soru {currentIndex + 1} / {questions.length}
                    </div>
                    <div className="quiz-panel-question">{currentQuestion.content}</div>

                    {currentQuestion.options?.map((option, idx) => {
                        const letter = OPTION_LETTERS[idx];
                        const count = answerStats[letter] || 0;
                        const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;
                        const isCorrect = showAnswer && currentQuestion.correctAnswer === letter;
                        return (
                            <div key={idx} className={`quiz-panel-option ${isCorrect ? 'correct' : ''}`}>
                                <div className="quiz-panel-option-fill" style={{ width: `${percentage}%` }} />
                                <span className="quiz-panel-option-label">{letter}. {option}</span>
                                <span className="quiz-panel-option-count">{count}</span>
                            </div>
                        );
                    })}

                    <div className="quiz-panel-controls">
                        <Button variant="secondary" size="sm" onClick={previousQuestion} disabled={currentIndex === 0}>←</Button>
                        {!showAnswer ? (
                            <Button variant="primary" size="sm" onClick={revealAnswer}>👁️ Cevabı Göster</Button>
                        ) : (
                            <span className="quiz-panel-correct-label">✅ {currentQuestion.correctAnswer}</span>
                        )}
                        <Button variant="secondary" size="sm" onClick={nextQuestion} disabled={currentIndex === questions.length - 1}>→</Button>
                    </div>
                </>
            )}
        </div>
    );
};

export default LiveQuizInstructorPanel;
