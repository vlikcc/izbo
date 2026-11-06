import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui';
import { StartPracticeButton } from '../../components/test/StartPracticeButton';
import contentService from '../../services/content.service';
import assessmentService from '../../services/assessment.service';
import { useAuthStore } from '../../stores/authStore';
import type { SubjectTree } from '../../types/content';
import type { Mastery } from '../../types/assessment';
import { percent } from '../../utils/content';
import { isStudent } from '../../utils/roles';
import '../../components/content/Content.css';
import '../../components/test/Test.css';

const masteryTone = (value: number) => (value < 50 ? 'low' : value < 75 ? 'mid' : 'high');

/** A subject's units and topics, with how much of each topic the learner has finished. */
export const SubjectPage: React.FC = () => {
    const { subjectId = '' } = useParams();
    const [loadedTree, setTree] = useState<SubjectTree | null>(null);
    const [error, setError] = useState('');
    const { user } = useAuthStore();
    const student = isStudent(user);
    const [loadedMastery, setMastery] = useState<{ subjectId: string; data: Mastery } | null>(null);

    useEffect(() => {
        if (!student) return;
        assessmentService.getMyMastery(subjectId)
            .then(data => setMastery({ subjectId, data }))
            .catch(() => setMastery(null));
    }, [student, subjectId]);

    const mastery = loadedMastery?.subjectId === subjectId ? loadedMastery.data : null;
    const topicMastery = new Map((mastery?.topics ?? []).map(t => [t.topicId, t]));

    useEffect(() => {
        contentService.getSubjectTree(subjectId)
            .then(setTree)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Ders yüklenemedi'));
    }, [subjectId]);

    const tree = loadedTree?.subject.id === subjectId ? loadedTree : null;

    if (error) return <div className="page"><p className="form-error" role="alert">{error}</p></div>;
    if (!tree) return <div className="page"><p className="content-muted">Yükleniyor...</p></div>;

    const totals = tree.units.flatMap(u => u.topics).reduce(
        (acc, t) => ({ items: acc.items + t.itemCount, done: acc.done + t.completedCount }), { items: 0, done: 0 });

    return (
        <div className="page animate-fadeIn">
            <Link to="/app/dersler" className="content-muted">← Derslerim</Link>
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">{tree.subject.name}</h1>
                    <p className="page-subtitle">
                        {tree.level.name} · {totals.items} içerik · %{percent(totals.done, totals.items)} tamamlandı
                    </p>
                </div>
            </div>

            {tree.units.length === 0 ? (
                <Card variant="default" padding="lg"><p className="content-muted">Bu derse henüz ünite eklenmedi.</p></Card>
            ) : tree.units.map(unit => (
                <section key={unit.id} className="unit-block">
                    <div className="row-actions" style={{ justifyContent: 'space-between' }}>
                        <h2 className="unit-title">{unit.order}. {unit.name}</h2>
                        {student && unit.topics.length > 0 && (
                            <StartPracticeButton target={{ unitId: unit.id }} variant="secondary" size="sm">Ünite testi</StartPracticeButton>
                        )}
                    </div>
                    <ul className="topic-list">
                        {unit.topics.map(topic => {
                            const done = percent(topic.completedCount, topic.itemCount);
                            const score = topicMastery.get(topic.id);
                            return (
                                <li key={topic.id}>
                                    <Link to={`/app/konu/${topic.id}`} className="topic-row">
                                        <span>{topic.name}</span>
                                        <span className="progress-bar" aria-label={`%${done} tamamlandı`}>
                                            <span style={{ width: `${done}%` }} />
                                        </span>
                                        <span className="content-muted">
                                            {topic.itemCount === 0 ? 'Yakında' : `${topic.completedCount}/${topic.itemCount}`}
                                        </span>
                                        {score && (
                                            <span className={`mastery-chip mastery-chip-${masteryTone(score.percent)}`}
                                                title={`Testlerde ${score.total} sorudan ${score.correct} doğru`}>
                                                %{Math.round(score.percent)}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
};

export default SubjectPage;
