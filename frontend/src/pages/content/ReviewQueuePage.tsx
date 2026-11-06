import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Modal } from '../../components/ui';
import { ContentViewer } from '../../components/content/ContentViewer';
import { QuestionView } from '../../components/questions/QuestionView';
import contentService from '../../services/content.service';
import assessmentService from '../../services/assessment.service';
import { toast } from '../../lib/toast';
import type { ContentItem } from '../../types/content';
import type { BankQuestion } from '../../types/assessment';
import { CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS, formatDuration } from '../../utils/content';
import { DIFFICULTY_LABELS } from '../../utils/questions';
import { MathText } from '../../components/math/MathText';
import '../../components/content/Content.css';
import '../../components/questions/Questions.css';

type Tab = 'content' | 'questions';

/** The note box and the two verdict buttons shared by both queues. */
const Verdict: React.FC<{ busy: boolean; onDecide: (approve: boolean, note: string) => void }> = ({ busy, onDecide }) => {
    const [note, setNote] = useState('');
    return (
        <>
            <div className="input-wrapper">
                <label className="input-label" htmlFor="review-note">Not (reddederken zorunlu)</label>
                <textarea id="review-note" className="field-textarea" value={note} onChange={e => setNote(e.target.value)} maxLength={2000} />
            </div>
            <div className="modal-actions">
                <Button variant="danger" isLoading={busy} onClick={() => {
                    if (!note.trim()) {
                        toast.error('Reddederken öğretmene bir gerekçe yazın');
                        return;
                    }
                    onDecide(false, note.trim());
                }}>Reddet</Button>
                <Button variant="primary" isLoading={busy} onClick={() => onDecide(true, note.trim())}>Onayla ve yayınla</Button>
            </div>
        </>
    );
};

/** A queue that loads itself and reviews one entry at a time. */
function useQueue<T extends { id: string }>(load: () => Promise<T[]>, review: (id: string, approve: boolean, note?: string) => Promise<unknown>) {
    const [queue, setQueue] = useState<T[] | null>(null);
    const [current, setCurrent] = useState<T | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        try {
            setQueue(await load());
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Onay kuyruğu yüklenemedi');
            setQueue([]);
        }
    }, [load]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const decide = async (approve: boolean, note: string) => {
        if (!current) return;
        setBusy(true);
        try {
            await review(current.id, approve, note || undefined);
            toast.success(approve ? 'Yayınlandı' : 'Öğretmene geri gönderildi');
            setCurrent(null);
            await refresh();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Karar kaydedilemedi');
        } finally {
            setBusy(false);
        }
    };

    return { queue, current, setCurrent, busy, decide };
}

const loadContent = async () => (await contentService.getReviewQueue(1, 100)).items;
const loadQuestions = async () => (await assessmentService.getQuestionReviewQueue(1, 100)).items;

const ContentQueue: React.FC = () => {
    const { queue, current, setCurrent, busy, decide } = useQueue<ContentItem>(loadContent, contentService.review);

    return (
        <>
            {queue === null ? (
                <p className="content-muted">Yükleniyor...</p>
            ) : queue.length === 0 ? (
                <Card variant="default" padding="lg"><p className="content-muted">Onay bekleyen içerik yok.</p></Card>
            ) : (
                <Card variant="default" padding="none">
                    <table className="content-table">
                        <thead><tr><th>İçerik</th><th>Konu</th><th>Gönderilme</th><th>Süre</th><th /></tr></thead>
                        <tbody>
                            {queue.map(i => (
                                <tr key={i.id}>
                                    <td>
                                        <span aria-hidden="true">{CONTENT_TYPE_ICONS[i.type]}</span> <strong>{i.title}</strong>
                                        <div className="content-muted">{CONTENT_TYPE_LABELS[i.type]}{i.accessTier === 'Premium' ? ' · Premium' : ''}</div>
                                    </td>
                                    <td>{i.topicName}</td>
                                    <td>{i.submittedAt ? new Date(i.submittedAt).toLocaleString('tr-TR') : '—'}</td>
                                    <td>{formatDuration(i.durationSeconds) || '—'}</td>
                                    <td><Button size="sm" variant="primary" onClick={() => setCurrent(i)}>İncele</Button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            <Modal isOpen={current !== null} onClose={() => setCurrent(null)} title={current?.title ?? ''} size="lg">
                {current && (
                    <div className="modal-form">
                        <p className="content-muted">{current.topicName}</p>
                        {current.description && <p>{current.description}</p>}
                        <ContentViewer item={current} trackProgress={false} />
                        {current.outcomes.length > 0 && (
                            <ul className="outcome-list">
                                {current.outcomes.map(o => <li key={o.id}><span className="outcome-code">{o.code}</span> {o.description}</li>)}
                            </ul>
                        )}
                        <Verdict key={current.id} busy={busy} onDecide={(approve, note) => void decide(approve, note)} />
                    </div>
                )}
            </Modal>
        </>
    );
};

const QuestionQueue: React.FC = () => {
    const { queue, current, setCurrent, busy, decide } = useQueue<BankQuestion>(loadQuestions, assessmentService.reviewQuestion);

    return (
        <>
            {queue === null ? (
                <p className="content-muted">Yükleniyor...</p>
            ) : queue.length === 0 ? (
                <Card variant="default" padding="lg"><p className="content-muted">Onay bekleyen soru yok.</p></Card>
            ) : (
                <Card variant="default" padding="none">
                    <table className="content-table">
                        <thead><tr><th>Soru</th><th>Konu</th><th>Zorluk</th><th>Gönderilme</th><th /></tr></thead>
                        <tbody>
                            {queue.map(q => (
                                <tr key={q.id}>
                                    <td><span className="bank-stem">{q.stem ? <MathText text={q.stem} /> : '(görselli soru)'}</span></td>
                                    <td>{q.topicName}<div className="content-muted">{q.levelName} · {q.subjectName}</div></td>
                                    <td>{DIFFICULTY_LABELS[q.difficulty]}</td>
                                    <td>{q.submittedAt ? new Date(q.submittedAt).toLocaleString('tr-TR') : '—'}</td>
                                    <td><Button size="sm" variant="primary" onClick={() => setCurrent(q)}>İncele</Button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            <Modal isOpen={current !== null} onClose={() => setCurrent(null)} title={current ? `${current.subjectName} · ${current.topicName}` : ''} size="lg">
                {current && (
                    <div className="modal-form">
                        {current.outcome && <p className="content-muted"><span className="outcome-code">{current.outcome.code}</span> {current.outcome.description}</p>}
                        <QuestionView stem={current.stem} stemAssetId={current.stemAssetId} options={current.options} correctKey={current.correctKey} />
                        {current.explanation && <p><strong>Çözüm:</strong> {current.explanation}</p>}
                        {current.solutionVideoTitle && <p className="content-muted">🎬 Çözüm videosu: {current.solutionVideoTitle}</p>}
                        <Verdict key={current.id} busy={busy} onDecide={(approve, note) => void decide(approve, note)} />
                    </div>
                )}
            </Modal>
        </>
    );
};

/** Teachers' content and questions waiting for an administrator: preview, then approve or reject with a reason. */
export const ReviewQueuePage: React.FC = () => {
    const [tab, setTab] = useState<Tab>('content');

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">✅ Onay kuyruğu</h1>
                    <p className="page-subtitle">Öğretmenlerin gönderdiği içerik ve sorular, yayına girmeden önce</p>
                </div>
            </div>

            <div className="level-tabs" role="tablist" aria-label="Kuyruk">
                <button type="button" role="tab" aria-selected={tab === 'content'} className={`level-tab ${tab === 'content' ? 'level-tab-active' : ''}`}
                    onClick={() => setTab('content')}>İçerikler</button>
                <button type="button" role="tab" aria-selected={tab === 'questions'} className={`level-tab ${tab === 'questions' ? 'level-tab-active' : ''}`}
                    onClick={() => setTab('questions')}>Sorular</button>
            </div>

            {tab === 'content' ? <ContentQueue /> : <QuestionQueue />}
        </div>
    );
};

export default ReviewQueuePage;
