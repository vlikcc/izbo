import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '../../components/ui';
import { AttemptList } from '../../components/test/AttemptList';
import assessmentService from '../../services/assessment.service';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../lib/toast';
import { levelSlugsForUser } from '../../utils/content';
import { formatDateTime } from '../../utils/questions';
import type { AssessmentSummary, AttemptSummary } from '../../types/assessment';
import '../../components/content/Content.css';
import '../../components/test/Test.css';

const STATE_LABELS = { Open: 'Şu an açık', Upcoming: 'Yaklaşan', Closed: 'Kapandı' } as const;

/** /app/denemeler — mock exams and placement tests for the student's levels, and their recent tests. */
export const MockExamsPage: React.FC = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [assessments, setAssessments] = useState<AssessmentSummary[] | null>(null);
    const [attempts, setAttempts] = useState<AttemptSummary[] | null>(null);
    const [starting, setStarting] = useState('');
    const slugs = levelSlugsForUser(user).join(',');

    useEffect(() => {
        assessmentService.listAssessments(slugs ? slugs.split(',') : [])
            .then(setAssessments)
            .catch(() => setAssessments([]));
        assessmentService.getMyAttempts(10)
            .then(setAttempts)
            .catch(() => setAttempts([]));
    }, [slugs]);

    const start = async (a: AssessmentSummary) => {
        if (a.myAttemptId) {
            navigate(a.myAttemptStatus === 'InProgress' ? `/app/test/${a.myAttemptId}` : `/app/test/${a.myAttemptId}/sonuc`);
            return;
        }
        const message = a.kind === 'MockExam' && a.state === 'Open'
            ? `${a.durationMinutes} dakikan olacak ve deneme tek seferlik. Başlamak istiyor musun?`
            : `${a.durationMinutes} dakikan olacak ve sınav tek seferlik. Başlamak istiyor musun?`;
        if (!window.confirm(message)) return;

        setStarting(a.id);
        try {
            const attempt = await assessmentService.startAssessment(a.id);
            navigate(`/app/test/${attempt.summary.id}`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Sınav başlatılamadı');
            setStarting('');
        }
    };

    const mockExams = (assessments ?? []).filter(a => a.kind === 'MockExam');
    const placements = (assessments ?? []).filter(a => a.kind === 'Placement');

    const card = (a: AssessmentSummary) => {
        const done = a.myAttemptId && a.myAttemptStatus !== 'InProgress';
        const label = done ? 'Sonucu gör'
            : a.myAttemptStatus === 'InProgress' ? 'Devam et'
                : a.state === 'Upcoming' ? 'Henüz başlamadı'
                    : a.state === 'Closed' ? 'Sıralamasız çöz' : 'Başla';
        return (
            <Card key={a.id} variant="default" padding="md">
                <div className="exam-card">
                    {a.kind === 'MockExam' && <span className={`exam-state exam-state-${a.state}`}>{STATE_LABELS[a.state]}</span>}
                    <h3 className="unit-title" style={{ margin: 0 }}>{a.title}</h3>
                    {a.description && <p className="content-muted">{a.description}</p>}
                    <p className="content-muted">{a.levelName} · {a.questionCount} soru · {a.durationMinutes} dakika</p>
                    {a.kind === 'MockExam' && a.windowStart && a.windowEnd && (
                        <p className="content-muted">{formatDateTime(a.windowStart)} – {formatDateTime(a.windowEnd)}</p>
                    )}
                    {a.state === 'Closed' && !a.myAttemptId && (
                        <p className="content-muted">Pencere kapandı; şimdi çözersen sonucunu hemen görürsün ama sıralamaya girmezsin.</p>
                    )}
                    <div className="exam-card-actions">
                        <Button variant={done ? 'secondary' : 'primary'} disabled={!a.myAttemptId && a.state === 'Upcoming'}
                            isLoading={starting === a.id} onClick={() => void start(a)}>{label}</Button>
                    </div>
                </div>
            </Card>
        );
    };

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">🏆 Denemeler</h1>
                    <p className="page-subtitle">Takvimli deneme sınavları, seviye belirleme ve çözdüğün testler</p>
                </div>
            </div>

            {assessments === null ? <p className="content-muted">Yükleniyor...</p> : (
                <>
                    {placements.some(p => !p.myAttemptId) && (
                        <section className="unit-block">
                            <h2 className="unit-title">🧭 Seviye belirleme</h2>
                            <div className="exam-cards">{placements.map(card)}</div>
                        </section>
                    )}

                    <section className="unit-block">
                        <h2 className="unit-title">📅 Deneme sınavları</h2>
                        {mockExams.length === 0
                            ? <Card variant="default" padding="lg"><p className="content-muted">Şu an seviyene uygun deneme yok.</p></Card>
                            : <div className="exam-cards">{mockExams.map(card)}</div>}
                    </section>

                    {placements.length > 0 && placements.every(p => p.myAttemptId) && (
                        <section className="unit-block">
                            <h2 className="unit-title">🧭 Seviye belirleme</h2>
                            <div className="exam-cards">{placements.map(card)}</div>
                        </section>
                    )}
                </>
            )}

            <section className="unit-block">
                <h2 className="unit-title">📝 Son testlerim</h2>
                <Card variant="default" padding="md">
                    {attempts === null
                        ? <p className="content-muted">Yükleniyor...</p>
                        : <AttemptList attempts={attempts} emptyText="Henüz test çözmedin. Bir konunun sayfasından konu testi başlatabilirsin." />}
                </Card>
            </section>
        </div>
    );
};

export default MockExamsPage;
