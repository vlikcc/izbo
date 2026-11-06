import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui';
import { AttemptList } from '../../components/test/AttemptList';
import { MasteryBar } from '../../components/test/MasteryBar';
import assessmentService from '../../services/assessment.service';
import { useAuthStore } from '../../stores/authStore';
import { levelSlugsForUser } from '../../utils/content';
import type { AssessmentSummary, AttemptSummary, Mastery } from '../../types/assessment';
import '../../components/test/Test.css';

interface Progress {
    mastery: Mastery | null;
    attempts: AttemptSummary[];
    assessments: AssessmentSummary[];
}

/** The student's side of the dashboard: what to revisit, recent tests and open mock exams. */
export const StudentProgressPanel: React.FC = () => {
    const { user } = useAuthStore();
    const slugs = levelSlugsForUser(user).join(',');
    const [progress, setProgress] = useState<Progress | null>(null);

    useEffect(() => {
        let cancelled = false;
        void Promise.all([
            assessmentService.getMyMastery().catch(() => null),
            assessmentService.getMyAttempts(5).catch(() => [] as AttemptSummary[]),
            assessmentService.listAssessments(slugs ? slugs.split(',') : []).catch(() => [] as AssessmentSummary[]),
        ]).then(([mastery, attempts, assessments]) => {
            if (!cancelled) setProgress({ mastery, attempts, assessments });
        });
        return () => { cancelled = true; };
    }, [slugs]);

    if (!progress) return null;

    const placement = progress.assessments.find(a => a.kind === 'Placement' && !a.myAttemptId);
    const openExams = progress.assessments.filter(a => a.kind === 'MockExam' && a.state !== 'Closed' && !a.myAttemptId);

    return (
        <>
            {(placement || openExams.length > 0) && (
                <Card variant="default" padding="md" className="dashboard-section" style={{ marginBottom: 24 }}>
                    <div className="dashboard-section-header">
                        <h3 className="dashboard-section-title">🏆 Seni bekleyenler</h3>
                        <Link to="/app/denemeler">Denemeler →</Link>
                    </div>
                    <ul className="attempt-list">
                        {placement && (
                            <li><Link to="/app/denemeler"><span style={{ flex: 1 }}><strong>🧭 {placement.title}</strong><br />
                                <span className="content-muted">Nereden başlaman gerektiğini görmek için seviye belirleme sınavını çöz.</span></span></Link></li>
                        )}
                        {openExams.slice(0, 3).map(a => (
                            <li key={a.id}><Link to="/app/denemeler"><span style={{ flex: 1 }}><strong>{a.title}</strong><br />
                                <span className="content-muted">{a.state === 'Open' ? 'Şu an açık' : `${new Date(a.windowStart!).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} başlıyor`}</span></span></Link></li>
                        ))}
                    </ul>
                </Card>
            )}

            <div className="dashboard-grid" style={{ marginBottom: 24 }}>
                <Card variant="default" padding="md" className="dashboard-section">
                    <div className="dashboard-section-header">
                        <h3 className="dashboard-section-title">🎯 Eksik konuların</h3>
                    </div>
                    {!progress.mastery || progress.mastery.topics.length === 0 ? (
                        <p className="content-muted">Konu testleri çözdükçe eksik konuların burada görünür.</p>
                    ) : progress.mastery.weak.length === 0 ? (
                        <p className="content-muted">Son testlerinde eksik konu görünmüyor. Böyle devam! 💪</p>
                    ) : (
                        <ul className="mastery-list">
                            {progress.mastery.weak.map(t => (
                                <li key={t.topicId}>
                                    <Link to={`/app/konu/${t.topicId}`}>{t.topicName}</Link>{' '}
                                    <span className="content-muted">· {t.subjectName}</span>
                                    <MasteryBar percent={t.percent} label={`${t.correct}/${t.total}`} />
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card variant="default" padding="md" className="dashboard-section">
                    <div className="dashboard-section-header">
                        <h3 className="dashboard-section-title">📝 Son testlerin</h3>
                        <Link to="/app/denemeler">Tümü →</Link>
                    </div>
                    <AttemptList attempts={progress.attempts} emptyText="Bir konunun sayfasından ilk konu testini çöz." />
                </Card>
            </div>
        </>
    );
};

export default StudentProgressPanel;
