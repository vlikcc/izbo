import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Input } from '../../components/ui';
import { examService } from '../../services/exam.service';
import { toast } from '../../lib/toast';
import type { Question } from '../../types';
import type { StartExamResponse } from '../../types/examSession';
import './Exams.css';

function formatRemaining(totalSeconds: number): string {
    const clamped = Math.max(0, totalSeconds);
    const minutes = Math.floor(clamped / 60);
    const seconds = clamped % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const ExamTakePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [session, setSession] = useState<StartExamResponse | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [remaining, setRemaining] = useState(0);
    const [index, setIndex] = useState(0);
    const [isStarting, setIsStarting] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const saveTimers = useRef<Record<string, number>>({});

    const submit = useCallback(async (sessionId: string) => {
        setIsSubmitting(true);
        try {
            await examService.submitExam(sessionId);
            toast.success('Sınav teslim edildi');
            navigate(`/app/exams/sessions/${sessionId}/result`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Teslim edilemedi');
            setIsSubmitting(false);
        }
    }, [navigate]);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        const start = async () => {
            try {
                const started = await examService.startExam(id);
                if (cancelled) return;
                setSession(started);
                setRemaining(started.remainingSeconds);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Sınav başlatılamadı');
                navigate('/app/exams');
            } finally {
                if (!cancelled) setIsStarting(false);
            }
        };
        void start();
        return () => {
            cancelled = true;
        };
    }, [id, navigate]);

    useEffect(() => {
        if (!session) return;
        const timer = window.setInterval(() => {
            setRemaining((value) => {
                if (value <= 1) {
                    window.clearInterval(timer);
                    void submit(session.sessionId);
                    return 0;
                }
                return value - 1;
            });
        }, 1000);
        return () => window.clearInterval(timer);
    }, [session, submit]);

    const persistAnswer = (questionId: string, value: string) => {
        if (!session) return;
        window.clearTimeout(saveTimers.current[questionId]);
        saveTimers.current[questionId] = window.setTimeout(() => {
            void examService.saveAnswer(session.sessionId, questionId, value).catch(() => {
                toast.error('Cevap kaydedilemedi');
            });
        }, 400);
    };

    const updateAnswer = (question: Question, value: string) => {
        setAnswers((prev) => ({ ...prev, [question.id]: value }));
        persistAnswer(question.id, value);
    };

    if (isStarting || !session) {
        return (
            <div className="page">
                <div className="exams-loading">
                    <div className="exams-loading-spinner" />
                    <span>Sınav hazırlanıyor...</span>
                </div>
            </div>
        );
    }

    const question = session.questions[index];
    const currentAnswer = question ? answers[question.id] ?? '' : '';

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">Sınav</h1>
                    <p className="page-subtitle">
                        Soru {index + 1} / {session.questions.length}
                    </p>
                </div>
                <div aria-live="polite">
                    <strong>Kalan süre: {formatRemaining(remaining)}</strong>
                </div>
            </div>

            {question && (
                <Card variant="default" padding="lg">
                    <p><strong>{question.points} puan</strong></p>
                    <h2>{question.content}</h2>
                    {question.type === 'MultipleChoice' && (question.options ?? []).map((option) => (
                        <label key={option} style={{ display: 'block', margin: '8px 0' }}>
                            <input
                                type="radio"
                                name={question.id}
                                value={option}
                                checked={currentAnswer === option}
                                onChange={() => updateAnswer(question, option)}
                            />
                            {' '}{option}
                        </label>
                    ))}
                    {question.type === 'TrueFalse' && ['Doğru', 'Yanlış'].map((option) => (
                        <label key={option} style={{ display: 'block', margin: '8px 0' }}>
                            <input
                                type="radio"
                                name={question.id}
                                value={option}
                                checked={currentAnswer === option}
                                onChange={() => updateAnswer(question, option)}
                            />
                            {' '}{option}
                        </label>
                    ))}
                    {question.type === 'FillInBlank' && (
                        <Input
                            label="Cevabınız"
                            value={currentAnswer}
                            onChange={(event) => updateAnswer(question, event.target.value)}
                        />
                    )}
                </Card>
            )}

            <div className="exam-actions" style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <Button variant="outline" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>
                    Önceki
                </Button>
                <Button
                    variant="outline"
                    disabled={index >= session.questions.length - 1}
                    onClick={() => setIndex((value) => value + 1)}
                >
                    Sonraki
                </Button>
                <Button variant="primary" isLoading={isSubmitting} onClick={() => void submit(session.sessionId)}>
                    Sınavı Teslim Et
                </Button>
            </div>
        </div>
    );
};

export default ExamTakePage;
