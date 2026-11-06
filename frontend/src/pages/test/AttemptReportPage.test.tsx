import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AttemptReportPage } from './AttemptReportPage';
import type { AttemptReport, AttemptSummary } from '../../types/assessment';

const { getReport } = vi.hoisted(() => ({ getReport: vi.fn() }));

vi.mock('../../services/assessment.service', () => ({
    default: { getReport, startPractice: vi.fn(), assetUrl: (id: string) => `/assets/${id}` },
}));
vi.mock('../../services/content.service', () => ({ default: { getItem: vi.fn() } }));
vi.mock('../../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u1', role: 'Student' } }) }));

const summary: AttemptSummary = {
    id: 'a1', scope: 'Assessment', assessmentKind: 'MockExam', assessmentId: 'x1', topicId: null, unitId: null,
    title: 'LGS Deneme 1', status: 'Submitted', scoringRule: 'NetThird',
    startedAt: '2026-11-06T09:00:00Z', deadline: '2026-11-06T10:00:00Z', submittedAt: '2026-11-06T09:40:00Z',
    questionCount: 4, answeredCount: 4, resultsVisible: true, resultsAt: '2026-11-06T11:00:00Z',
    correct: 3, wrong: 1, blank: 0, net: 2.67, percent: 66.75,
    isRanked: true, rank: 2, participantCount: 40, topPercent: 5,
};

const report: AttemptReport = {
    summary,
    sections: [{ title: 'Matematik', subjectId: 's1', correct: 3, wrong: 1, blank: 0, net: 2.67 }],
    topics: [],
    outcomes: [],
    weak: [{ topicId: 't1', topicName: 'Bölme', outcomeId: 'o1', outcomeCode: 'M.8.1.1.2', outcomeDescription: 'EBOB ve EKOK hesaplar.', correct: 0, total: 2, percent: 0 }],
    recommendations: [{
        item: { id: 'i1', topicId: 't1', type: 'Video', title: 'EBOB anlatımı', durationSeconds: 600, accessTier: 'Free', status: 'Published', processingStatus: 'Ready', hasThumbnail: false, order: 1, progress: null },
        topicId: 't1', topicName: 'Bölme', outcomeCode: 'M.8.1.1.2',
    }],
    questions: [],
};

const renderAt = () => render(
    <MemoryRouter initialEntries={['/app/test/a1/sonuc']}>
        <Routes><Route path="/app/test/:attemptId/sonuc" element={<AttemptReportPage />} /></Routes>
    </MemoryRouter>);

describe('AttemptReportPage', () => {
    beforeEach(() => getReport.mockReset());

    it('shows the net, the rank, the weak outcome and a link to the lesson that teaches it', async () => {
        getReport.mockResolvedValue(report);
        renderAt();

        expect(await screen.findByText('2,67', { selector: '.result-tile-main strong' })).toBeInTheDocument();
        expect(screen.getByText('2.')).toBeInTheDocument();
        expect(screen.getByText(/40 kişi içinde · ilk %5/)).toBeInTheDocument();
        expect(screen.getByText('EBOB ve EKOK hesaplar.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /EBOB anlatımı/ })).toHaveAttribute('href', '/app/konu/t1?item=i1');
    });

    it('keeps the results back until the mock exam closes', async () => {
        getReport.mockResolvedValue({
            ...report,
            summary: { ...summary, resultsVisible: false, net: null, correct: null, wrong: null, blank: null, percent: null, rank: null },
            sections: [], weak: [], recommendations: [],
        });
        renderAt();

        expect(await screen.findByText(/Cevapların kaydedildi/)).toBeInTheDocument();
        expect(screen.getByText(/kapandıktan sonra açıklanacak/)).toBeInTheDocument();
        expect(screen.queryByText('net')).not.toBeInTheDocument();
    });
});
