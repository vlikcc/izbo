import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Modal } from '../../components/ui';
import { ContentViewer } from '../../components/content/ContentViewer';
import { QuestionView } from '../../components/questions/QuestionView';
import { MasteryBar } from '../../components/test/MasteryBar';
import { MathText } from '../../components/math/MathText';
import assessmentService from '../../services/assessment.service';
import contentService from '../../services/content.service';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../lib/toast';
import { isParent, isStudent } from '../../utils/roles';
import { CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS, formatDuration } from '../../utils/content';
import { SCORING_RULE_LABELS, formatDateTime, formatNet, formatTopPercent } from '../../utils/questions';
import type { AttemptReport, RecommendedContent, ReviewQuestion } from '../../types/assessment';
import type { ContentItem } from '../../types/content';
import '../../components/content/Content.css';
import '../../components/test/Test.css';

type ReviewFilter = 'all' | 'wrong' | 'blank';

/**
 * /app/test/:attemptId/sonuc — the result of a test: score, nets per subject, success per outcome, the
 * outcomes to revisit with the lessons that teach them, and every question with its solution.
 */
export const AttemptReportPage: React.FC = () => {
    const { attemptId = '' } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const student = isStudent(user);
    // Parents follow the results; the lesson pages themselves are for learners.
    const parent = isParent(user);
    const [loaded, setLoaded] = useState<AttemptReport | null>(null);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<ReviewFilter>('all');
    const [video, setVideo] = useState<ContentItem | null>(null);
    const [retrying, setRetrying] = useState(false);

    useEffect(() => {
        assessmentService.getReport(attemptId)
            .then(setLoaded)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Sonuç yüklenemedi'));
    }, [attemptId]);

    const report = loaded?.summary.id === attemptId ? loaded : null;

    if (error) return <div className="page"><p className="form-error" role="alert">{error}</p></div>;
    if (!report) return <div className="page"><p className="content-muted">Yükleniyor...</p></div>;

    const { summary } = report;

    const openVideo = async (id: string) => {
        try {
            setVideo(await contentService.getItem(id));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Video açılamadı');
        }
    };

    const retry = async () => {
        if (!summary.topicId && !summary.unitId) return;
        setRetrying(true);
        try {
            const next = await assessmentService.startPractice(
                summary.scope === 'Unit' ? { unitId: summary.unitId! } : { topicId: summary.topicId! });
            navigate(`/app/test/${next.summary.id}`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Test başlatılamadı');
            setRetrying(false);
        }
    };

    const header = (
        <div className="page-header">
            <div className="page-header-content">
                <h1 className="page-title">{summary.title}</h1>
                <p className="page-subtitle">
                    {summary.submittedAt ? formatDateTime(summary.submittedAt) : ''}
                    {summary.status === 'Expired' ? ' · süre dolduğunda bitti' : ''}
                </p>
            </div>
            {student && summary.scope !== 'Assessment' && (
                <Button variant="secondary" isLoading={retrying} onClick={() => void retry()}>Yeni test çöz</Button>
            )}
        </div>
    );

    if (!summary.resultsVisible) {
        return (
            <div className="page animate-fadeIn">
                {header}
                <Card variant="default" padding="lg">
                    <h2 className="unit-title">Cevapların kaydedildi 🎉</h2>
                    <p className="content-muted">
                        {summary.resultsAt
                            ? `Sonuçlar, deneme ${formatDateTime(summary.resultsAt)} tarihinde kapandıktan sonra açıklanacak. Netin, sıralaman ve soruların çözümleri o zaman burada olacak.`
                            : 'Sonuçlar henüz açıklanmadı.'}
                    </p>
                    <p className="content-muted" style={{ marginTop: 8 }}>{summary.answeredCount}/{summary.questionCount} soruyu cevapladın.</p>
                </Card>
            </div>
        );
    }

    const shown = report.questions.filter(q =>
        filter === 'all' || (filter === 'wrong' ? q.isCorrect === false : q.selectedKey === null));

    return (
        <div className="page animate-fadeIn">
            {header}

            <div className="result-tiles section-gap">
                <div className="result-tile result-tile-main">
                    <strong>{formatNet(summary.net)}</strong><span>net</span>
                </div>
                <div className="result-tile result-correct"><strong>{summary.correct}</strong><span>doğru</span></div>
                <div className="result-tile result-wrong"><strong>{summary.wrong}</strong><span>yanlış</span></div>
                <div className="result-tile"><strong>{summary.blank}</strong><span>boş</span></div>
                <div className="result-tile"><strong>%{formatNet(summary.percent)}</strong><span>başarı</span></div>
                {summary.rank !== null && (
                    <div className="result-tile result-rank">
                        <strong>{summary.rank}.</strong>
                        <span>{summary.participantCount} kişi içinde · {formatTopPercent(summary.topPercent)}</span>
                    </div>
                )}
            </div>
            <p className="content-muted section-gap">{SCORING_RULE_LABELS[summary.scoringRule]}{summary.isRanked && summary.rank === null ? ' · Sıralama birkaç dakika içinde hesaplanır.' : ''}</p>

            {report.sections.length > 0 && (
                <Card variant="default" padding="none" className="section-gap">
                    <table className="content-table">
                        <thead><tr><th>Ders</th><th>Doğru</th><th>Yanlış</th><th>Boş</th><th>Net</th></tr></thead>
                        <tbody>
                            {report.sections.map(s => (
                                <tr key={s.title}><td><strong>{s.title}</strong></td><td>{s.correct}</td><td>{s.wrong}</td><td>{s.blank}</td><td>{formatNet(s.net)}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            <div className="report-grid section-gap">
                <Card variant="default" padding="md">
                    <h2 className="unit-title">🎯 Tekrar etmen gerekenler</h2>
                    {report.weak.length === 0 ? (
                        <p className="content-muted">Eksik kazanım görünmüyor. Harika iş! 💪</p>
                    ) : (
                        <ul className="mastery-list">
                            {report.weak.map(w => (
                                <li key={`${w.topicId}-${w.outcomeId ?? 'topic'}`}>
                                    <div>
                                        {w.outcomeCode && <span className="outcome-code">{w.outcomeCode}</span>}{' '}
                                        {w.outcomeDescription ?? w.topicName}
                                    </div>
                                    <MasteryBar percent={w.percent} label={`${w.correct}/${w.total}`} />
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card variant="default" padding="md">
                    <h2 className="unit-title">📚 Önerilen içerikler</h2>
                    {report.recommendations.length === 0 ? (
                        <p className="content-muted">{report.weak.length ? 'Bu kazanımlar için henüz içerik yok.' : 'Şimdilik önerimiz yok.'}</p>
                    ) : (
                        <ul className="item-list">
                            {report.recommendations.map(r => (
                                <li key={r.item.id}>
                                    {parent ? (
                                        <div className="item-button"><Recommendation r={r} /></div>
                                    ) : (
                                        <Link className="item-button" to={`/app/konu/${r.topicId}?item=${r.item.id}`}><Recommendation r={r} /></Link>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            {(report.outcomes.length > 0 || report.topics.length > 1) && (
                <Card variant="default" padding="md" className="section-gap">
                    <h2 className="unit-title">Kazanım bazında başarı</h2>
                    <ul className="mastery-list">
                        {(report.outcomes.length > 0 ? report.outcomes : report.topics).map(row => (
                            <li key={`${row.topicId}-${row.outcomeId ?? 'topic'}`}>
                                <div>
                                    {row.outcomeCode && <span className="outcome-code">{row.outcomeCode}</span>}{' '}
                                    {row.outcomeDescription ?? row.topicName}
                                </div>
                                <MasteryBar percent={row.percent} label={`${row.correct}/${row.total}`} />
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            <section>
                <div className="row-actions section-gap">
                    <h2 className="unit-title" style={{ margin: 0 }}>Sorular</h2>
                    <div className="level-tabs" role="tablist" aria-label="Soru filtresi" style={{ margin: 0 }}>
                        {([['all', 'Tümü'], ['wrong', 'Yanlışlar'], ['blank', 'Boşlar']] as [ReviewFilter, string][]).map(([value, label]) => (
                            <button key={value} type="button" role="tab" aria-selected={filter === value}
                                className={`level-tab ${filter === value ? 'level-tab-active' : ''}`} onClick={() => setFilter(value)}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                {shown.length === 0 && <p className="content-muted">Bu filtrede soru yok.</p>}
                {shown.map(q => <ReviewCard key={q.order} question={q} onVideo={id => void openVideo(id)} />)}
            </section>

            <Modal isOpen={video !== null} onClose={() => setVideo(null)} title={video?.title ?? ''} size="lg">
                {video && <ContentViewer key={video.id} item={video} trackProgress={student} />}
            </Modal>
        </div>
    );
};

const Recommendation: React.FC<{ r: RecommendedContent }> = ({ r }) => (
    <>
        <span aria-hidden="true">{CONTENT_TYPE_ICONS[r.item.type]}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 600 }}>{r.item.title}</span>
            <span className="content-muted">
                {r.topicName} · {CONTENT_TYPE_LABELS[r.item.type]}
                {r.item.durationSeconds ? ` · ${formatDuration(r.item.durationSeconds)}` : ''}
            </span>
        </span>
        {r.outcomeCode && <span className="outcome-code">{r.outcomeCode}</span>}
    </>
);

const ReviewCard: React.FC<{ question: ReviewQuestion; onVideo: (id: string) => void }> = ({ question, onVideo }) => (
    <Card variant="default" padding="md" className="section-gap">
        <div className="review-meta">
            {question.sectionTitle && <span>{question.sectionTitle}</span>}
            <span>{question.topicName}{question.outcomeCode ? ` · ${question.outcomeCode}` : ''}</span>
            <span className={`review-verdict review-${question.isCorrect === null ? 'blank' : question.isCorrect ? 'correct' : 'wrong'}`}>
                {question.isCorrect === null ? 'Boş' : question.isCorrect ? 'Doğru' : 'Yanlış'}
            </span>
        </div>
        <QuestionView number={question.order} stem={question.stem} stemAssetId={question.stemAssetId} options={question.options}
            selectedKey={question.selectedKey} correctKey={question.correctKey} />
        {question.explanation && (
            <p className="review-explanation"><strong>Çözüm: </strong><MathText text={question.explanation} /></p>
        )}
        {question.solutionVideoItemId && (
            <Button size="sm" variant="secondary" onClick={() => onVideo(question.solutionVideoItemId!)}>🎬 Çözüm videosunu izle</Button>
        )}
    </Card>
);

export default AttemptReportPage;
