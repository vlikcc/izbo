import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui';
import { QuestionView } from '../questions/QuestionView';
import assessmentService from '../../services/assessment.service';
import { toast } from '../../lib/toast';
import type { Attempt, AttemptSummary } from '../../types/assessment';
import { formatClock } from '../../utils/questions';
import './Test.css';

interface TestPlayerProps {
    attempt: Attempt;
    /** Called once the server has graded the attempt (finished by the student or by the clock). */
    onFinished: (summary: AttemptSummary) => void;
}

/**
 * Takes a test one question at a time. Every choice is saved at once, so closing the tab loses nothing; the
 * timer follows the server's deadline (corrected for the device clock) and finishes the test at zero.
 */
export const TestPlayer: React.FC<TestPlayerProps> = ({ attempt, onFinished }) => {
    const { summary, questions } = attempt;
    const [answers, setAnswers] = useState<Record<number, string | null>>(
        () => Object.fromEntries(questions.map(q => [q.order, q.selectedKey])));
    const [index, setIndex] = useState(0);
    const [flagged, setFlagged] = useState<Set<number>>(() => new Set());
    // Server time minus device time, measured once, so a wrong device clock does not skew the countdown.
    const [offset] = useState(() => new Date(attempt.serverNow).getTime() - Date.now());
    const deadline = new Date(summary.deadline).getTime();
    const [now, setNow] = useState(() => Date.now() + offset);
    const [finishing, setFinishing] = useState(false);
    const finishingRef = useRef(false);

    const finish = useCallback(async (automatic: boolean) => {
        if (finishingRef.current) return;
        finishingRef.current = true;
        setFinishing(true);
        try {
            const result = await assessmentService.submitAttempt(summary.id);
            if (automatic) toast.info('Süre doldu; test kaydedilen cevaplarla bitirildi.');
            onFinished(result);
        } catch (e) {
            finishingRef.current = false;
            setFinishing(false);
            toast.error(e instanceof Error ? e.message : 'Test bitirilemedi');
        }
    }, [summary.id, onFinished]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            const current = Date.now() + offset;
            setNow(current);
            if (current >= deadline) void finish(true);
        }, 1000);
        return () => window.clearInterval(timer);
    }, [offset, deadline, finish]);

    const question = questions[index];
    const remaining = Math.max(0, deadline - now);
    const answered = questions.filter(q => answers[q.order]).length;
    const blank = questions.length - answered;

    const choose = async (order: number, key: string | null) => {
        const previous = answers[order] ?? null;
        setAnswers(a => ({ ...a, [order]: key }));
        try {
            await assessmentService.saveAnswer(summary.id, order, key);
        } catch (e) {
            setAnswers(a => ({ ...a, [order]: previous }));
            const status = (e as { response?: { status?: number } }).response?.status;
            if (status === 409) {
                // Time ran out or the test was finished elsewhere: the server has already graded it.
                void finish(true);
                return;
            }
            toast.error(e instanceof Error ? e.message : 'Cevap kaydedilemedi');
        }
    };

    const toggleFlag = (order: number) => setFlagged(set => {
        const next = new Set(set);
        if (next.has(order)) next.delete(order);
        else next.add(order);
        return next;
    });

    const askToFinish = () => {
        const message = blank > 0
            ? `${blank} soru boş. Testi bitirmek istiyor musun?`
            : 'Testi bitirmek istiyor musun?';
        if (window.confirm(message)) void finish(false);
    };

    const sectionChanged = index === 0 || questions[index - 1].sectionTitle !== question.sectionTitle;

    return (
        <div className="test-player">
            <div className="test-bar">
                <div>
                    <h1 className="test-title">{summary.title}</h1>
                    <span className="content-muted">{answered}/{questions.length} cevaplandı</span>
                </div>
                <div className={`test-timer ${remaining < 60_000 ? 'test-timer-low' : ''}`} role="timer" aria-live="off" aria-label="Kalan süre">
                    ⏱ {formatClock(remaining)}
                </div>
                <Button variant="primary" isLoading={finishing} onClick={askToFinish}>Testi bitir</Button>
            </div>

            <div className="test-body">
                <section className="test-question" aria-label={`Soru ${question.order}`}>
                    {question.sectionTitle && sectionChanged && <p className="test-section">{question.sectionTitle}</p>}
                    <QuestionView
                        number={question.order}
                        stem={question.stem}
                        stemAssetId={question.stemAssetId}
                        options={question.options}
                        selectedKey={answers[question.order] ?? null}
                        onSelect={key => void choose(question.order, key)}
                        disabled={finishing} />

                    <div className="test-nav">
                        <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>← Önceki</Button>
                        <Button variant={flagged.has(question.order) ? 'primary' : 'ghost'} aria-pressed={flagged.has(question.order)}
                            onClick={() => toggleFlag(question.order)}>🚩 Sonra bak</Button>
                        {index < questions.length - 1
                            ? <Button variant="secondary" onClick={() => setIndex(i => i + 1)}>Sonraki →</Button>
                            : <Button variant="primary" isLoading={finishing} onClick={askToFinish}>Bitir</Button>}
                    </div>
                </section>

                <nav className="test-grid" aria-label="Sorular">
                    {questions.map((q, i) => (
                        <button
                            key={q.order}
                            type="button"
                            className={[
                                'test-cell',
                                answers[q.order] ? 'test-cell-answered' : '',
                                flagged.has(q.order) ? 'test-cell-flagged' : '',
                                i === index ? 'test-cell-current' : '',
                            ].filter(Boolean).join(' ')}
                            aria-current={i === index ? 'step' : undefined}
                            aria-label={`Soru ${q.order}${answers[q.order] ? ', cevaplandı' : ', boş'}${flagged.has(q.order) ? ', işaretli' : ''}`}
                            onClick={() => setIndex(i)}
                        >
                            {q.order}
                        </button>
                    ))}
                </nav>
            </div>
        </div>
    );
};

export default TestPlayer;
