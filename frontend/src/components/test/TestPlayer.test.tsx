import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TestPlayer } from './TestPlayer';
import type { Attempt, AttemptSummary } from '../../types/assessment';

const { saveAnswer, submitAttempt } = vi.hoisted(() => ({
    saveAnswer: vi.fn(),
    submitAttempt: vi.fn(),
}));

vi.mock('../../services/assessment.service', () => ({
    default: { saveAnswer, submitAttempt, assetUrl: (id: string) => `/assets/${id}` },
}));

vi.mock('../../lib/toast', () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }));

const START = new Date('2026-11-06T09:00:00Z');

const summary: AttemptSummary = {
    id: 'a1', scope: 'Topic', assessmentKind: null, assessmentId: null, topicId: 't1', unitId: null,
    title: 'Bölme — konu testi', status: 'InProgress', scoringRule: 'Plain',
    startedAt: START.toISOString(), deadline: new Date(START.getTime() + 3 * 60_000).toISOString(), submittedAt: null,
    questionCount: 2, answeredCount: 0, resultsVisible: false, resultsAt: null,
    correct: null, wrong: null, blank: null, net: null, percent: null,
    isRanked: false, rank: null, participantCount: null, topPercent: null,
};

const attempt: Attempt = {
    summary,
    serverNow: START.toISOString(),
    questions: [1, 2].map(order => ({
        order, questionId: `q${order}`, sectionTitle: null, type: 'MultipleChoice' as const,
        stem: `Soru ${order}`, stemAssetId: null, selectedKey: null,
        options: ['A', 'B', 'C', 'D'].map(key => ({ key, text: `${key} şıkkı`, assetId: null })),
    })),
};

describe('TestPlayer', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
        vi.setSystemTime(START);
        saveAnswer.mockReset().mockResolvedValue(undefined);
        submitAttempt.mockReset().mockResolvedValue({ ...summary, status: 'Submitted' });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('saves each choice at once and marks the question answered', async () => {
        render(<TestPlayer attempt={attempt} onFinished={vi.fn()} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('radio', { name: /C şıkkı/ }));
        });

        expect(saveAnswer).toHaveBeenCalledWith('a1', 1, 'C');
        expect(screen.getByRole('button', { name: 'Soru 1, cevaplandı' })).toBeInTheDocument();
        expect(screen.getByText('1/2 cevaplandı')).toBeInTheDocument();
    });

    it('finishes the test by itself when the time runs out', async () => {
        const onFinished = vi.fn();
        render(<TestPlayer attempt={attempt} onFinished={onFinished} />);
        expect(screen.getByRole('timer')).toHaveTextContent('3:00');

        await act(async () => {
            vi.advanceTimersByTime(3 * 60_000 + 1000);
        });

        expect(submitAttempt).toHaveBeenCalledTimes(1);
        expect(onFinished).toHaveBeenCalledWith(expect.objectContaining({ status: 'Submitted' }));
    });

    it('treats a refused answer after the deadline as the end of the test', async () => {
        saveAnswer.mockRejectedValue(Object.assign(new Error('Time is up'), { response: { status: 409 } }));
        const onFinished = vi.fn();
        render(<TestPlayer attempt={attempt} onFinished={onFinished} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('radio', { name: /A şıkkı/ }));
        });

        expect(submitAttempt).toHaveBeenCalledTimes(1);
        expect(onFinished).toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Soru 1, boş' })).toBeInTheDocument();
    });
});
