import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Modal } from '../../components/ui';
import { ContentViewer } from '../../components/content/ContentViewer';
import contentService from '../../services/content.service';
import { toast } from '../../lib/toast';
import type { ContentItem } from '../../types/content';
import { CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS, formatDuration } from '../../utils/content';
import '../../components/content/Content.css';

/** Teachers' content waiting for an administrator: preview, then approve or reject with a reason. */
export const ReviewQueuePage: React.FC = () => {
    const [queue, setQueue] = useState<ContentItem[] | null>(null);
    const [current, setCurrent] = useState<ContentItem | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            setQueue((await contentService.getReviewQueue(1, 100)).items);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Onay kuyruğu yüklenemedi');
            setQueue([]);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const decide = async (approve: boolean) => {
        if (!current) return;
        if (!approve && !note.trim()) {
            toast.error('Reddederken öğretmene bir gerekçe yazın');
            return;
        }
        setBusy(true);
        try {
            await contentService.review(current.id, approve, note.trim() || undefined);
            toast.success(approve ? 'İçerik yayınlandı' : 'İçerik öğretmene geri gönderildi');
            setCurrent(null);
            setNote('');
            await load();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Karar kaydedilemedi');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">✅ İçerik onayı</h1>
                    <p className="page-subtitle">Öğretmenlerin gönderdiği içerikler, yayına girmeden önce</p>
                </div>
            </div>

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
                                    <td><Button size="sm" variant="primary" onClick={() => { setCurrent(i); setNote(''); }}>İncele</Button></td>
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
                        <div className="input-wrapper">
                            <label className="input-label" htmlFor="review-note">Not (reddederken zorunlu)</label>
                            <textarea id="review-note" className="field-textarea" value={note} onChange={e => setNote(e.target.value)} maxLength={2000} />
                        </div>
                        <div className="modal-actions">
                            <Button variant="danger" isLoading={busy} onClick={() => void decide(false)}>Reddet</Button>
                            <Button variant="primary" isLoading={busy} onClick={() => void decide(true)}>Onayla ve yayınla</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default ReviewQueuePage;
