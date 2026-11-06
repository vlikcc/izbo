import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui';
import guardianService, { type StudentHomework } from '../../services/guardian.service';
import type { Child, Classroom, ClassSession, ExamSession } from '../../types';
import { EXAM_LABELS, gradeLabel } from '../../utils/roles';
import { missedHomework, pendingHomework } from '../../utils/homework';
import contentService from '../../services/content.service';
import type { StudentContentActivity } from '../../types/content';
import assessmentService from '../../services/assessment.service';
import type { AttemptSummary, Mastery } from '../../types/assessment';
import { Link } from 'react-router-dom';
import { formatNet } from '../../utils/questions';
import { ChildPackageStatus } from './ChildPackageStatus';
import './Parent.css';

interface Summary {
    activity: StudentContentActivity | null;
    classrooms: Classroom[];
    sessions: ClassSession[];
    homework: StudentHomework[];
    exams: ExamSession[];
    attempts: AttemptSummary[];
    mastery: Mastery | null;
}

const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

/** One child's week at a glance on the parent dashboard. Each part loads on its own, so one outage hides one list. */
export const ChildSummaryCard: React.FC<{ child: Child }> = ({ child }) => {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const settle = <T,>(p: Promise<T>, fallback: T) => p.catch(() => {
            if (!cancelled) setFailed(true);
            return fallback;
        });

        void Promise.all([
            settle(guardianService.getChildClassrooms(child.id), [] as Classroom[]),
            settle(guardianService.getChildUpcomingSessions(child.id), [] as ClassSession[]),
            settle(guardianService.getChildHomework(child.id), [] as StudentHomework[]),
            settle(guardianService.getChildExamSessions(child.id), [] as ExamSession[]),
            settle(contentService.getStudentActivity(child.id, 7), null as StudentContentActivity | null),
            settle(assessmentService.getStudentAttempts(child.id, 5), [] as AttemptSummary[]),
            settle(assessmentService.getStudentMastery(child.id), null as Mastery | null),
        ]).then(([classrooms, sessions, homework, exams, activity, attempts, mastery]) => {
            if (!cancelled) setSummary({ classrooms, sessions, homework, exams, activity, attempts, mastery });
        });

        return () => {
            cancelled = true;
        };
    }, [child.id]);

    const pending = summary ? pendingHomework(summary.homework) : [];
    const missed = summary ? missedHomework(summary.homework) : [];
    const finishedExams = (summary?.exams ?? [])
        .filter(e => e.submittedAt)
        .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
        .slice(0, 3);

    return (
        <Card variant="default" padding="md" className="child-card">
            <div className="child-card-header">
                <div className="child-avatar" aria-hidden="true">{child.firstName.charAt(0)}</div>
                <div>
                    <h3 className="child-name">{child.firstName} {child.lastName}</h3>
                    <span className="child-meta">
                        {gradeLabel(child.gradeLevel)}
                        {child.examTarget && child.examTarget !== 'None' ? ` · ${EXAM_LABELS[child.examTarget]} hazırlık` : ''}
                    </span>
                </div>
            </div>

            <ChildPackageStatus childId={child.id} />

            {!summary ? (
                <p className="child-muted">Yükleniyor...</p>
            ) : (
                <>
                    <div className="child-stats">
                        <div className="child-stat"><strong>{summary.classrooms.length}</strong><span>Sınıf</span></div>
                        <div className="child-stat"><strong>{summary.sessions.length}</strong><span>Yaklaşan ders</span></div>
                        <div className="child-stat"><strong>{pending.length}</strong><span>Bekleyen ödev</span></div>
                        <div className={`child-stat${missed.length ? ' child-stat-alert' : ''}`}>
                            <strong>{missed.length}</strong><span>Kaçırılan ödev</span>
                        </div>
                    </div>

                    <div className="child-section">
                        <h4>Bu hafta çalıştıkları</h4>
                        {!summary.activity || summary.activity.itemsStudied === 0 ? (
                            <p className="child-muted">Bu hafta konu anlatımı izlemedi</p>
                        ) : (
                            <>
                                <p className="child-muted">
                                    {summary.activity.itemsStudied} içerik çalıştı, {summary.activity.itemsCompleted} tanesini bitirdi
                                </p>
                                <ul className="child-list">
                                    {summary.activity.recent.slice(0, 3).map(r => (
                                        <li key={r.item.id}>
                                            <span>{r.item.title}</span>
                                            <span className="child-muted">{r.item.progress?.completed ? '✓ bitti' : r.subjectName}</span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>

                    <div className="child-section">
                        <h4>Son testleri</h4>
                        {summary.attempts.filter(a => a.status !== 'InProgress').length === 0 ? (
                            <p className="child-muted">Henüz test çözmedi</p>
                        ) : (
                            <ul className="child-list">
                                {summary.attempts.filter(a => a.status !== 'InProgress').slice(0, 3).map(a => (
                                    <li key={a.id}>
                                        <Link to={`/app/test/${a.id}/sonuc`}>{a.title}</Link>
                                        <span className="child-muted">
                                            {a.resultsVisible ? `${formatNet(a.net)} net · %${formatNet(a.percent)}` : 'Sonuç bekleniyor'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {summary.mastery && summary.mastery.weak.length > 0 && (
                        <div className="child-section">
                            <h4>Tekrar etmesi gereken konular</h4>
                            <ul className="child-list">
                                {summary.mastery.weak.slice(0, 3).map(t => (
                                    <li key={t.topicId}>
                                        <span>{t.topicName}</span>
                                        <span className="child-fail">%{Math.round(t.percent)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="child-section">
                        <h4>Yaklaşan dersler</h4>
                        {summary.sessions.length === 0 ? (
                            <p className="child-muted">Planlanmış ders yok</p>
                        ) : (
                            <ul className="child-list">
                                {summary.sessions.slice(0, 3).map(s => (
                                    <li key={s.id}><span>{s.title}</span><span className="child-muted">{formatDateTime(s.scheduledStartTime)}</span></li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="child-section">
                        <h4>Bekleyen ödevler</h4>
                        {pending.length === 0 ? (
                            <p className="child-muted">Bekleyen ödev yok</p>
                        ) : (
                            <ul className="child-list">
                                {pending.slice(0, 3).map(i => (
                                    <li key={i.homework.id}><span>{i.homework.title}</span><span className="child-muted">Son gün {formatDate(i.homework.dueDate)}</span></li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="child-section">
                        <h4>Son sınav sonuçları</h4>
                        {finishedExams.length === 0 ? (
                            <p className="child-muted">Henüz tamamlanan sınav yok</p>
                        ) : (
                            <ul className="child-list">
                                {finishedExams.map(e => (
                                    <li key={e.id}>
                                        <span>{e.examTitle}</span>
                                        <span className={e.isPassed ? 'child-pass' : 'child-fail'}>
                                            {e.percentage !== undefined && e.percentage !== null ? `%${Math.round(e.percentage)}` : '—'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {failed && <p className="child-muted">Bazı bilgiler şu an yüklenemedi.</p>}
                </>
            )}
        </Card>
    );
};

export default ChildSummaryCard;
