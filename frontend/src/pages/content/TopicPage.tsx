import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui';
import { ContentViewer } from '../../components/content/ContentViewer';
import contentService from '../../services/content.service';
import { useAuthStore } from '../../stores/authStore';
import type { ContentItem, TopicDetail } from '../../types/content';
import { CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS, formatDuration } from '../../utils/content';
import { isStudent } from '../../utils/roles';
import '../../components/content/Content.css';

/** One topic: its learning outcomes, its content list, and the selected item playing beside it. */
export const TopicPage: React.FC = () => {
    const { topicId = '' } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuthStore();
    const student = isStudent(user);

    // Kept even when the route moves on; the derived values below ignore stale ones.
    const [loadedTopic, setTopic] = useState<TopicDetail | null>(null);
    const [loadedItem, setItem] = useState<ContentItem | null>(null);
    const topic = loadedTopic?.id === topicId ? loadedTopic : null;
    const [error, setError] = useState('');

    const selectedId = searchParams.get('item') ?? topic?.items[0]?.id ?? null;

    const loadTopic = useCallback(() => {
        contentService.getTopic(topicId)
            .then(setTopic)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Konu yüklenemedi'));
    }, [topicId]);

    useEffect(() => {
        loadTopic();
    }, [loadTopic]);

    const item = loadedItem?.id === selectedId ? loadedItem : null;

    useEffect(() => {
        if (!selectedId) return;
        contentService.getItem(selectedId)
            .then(setItem)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'İçerik yüklenemedi'));
    }, [selectedId]);

    // Refresh the check marks once an item counts as finished.
    const onCompleted = useCallback(() => loadTopic(), [loadTopic]);

    if (error) return <div className="page"><p className="form-error" role="alert">{error}</p></div>;
    if (!topic) return <div className="page"><p className="content-muted">Yükleniyor...</p></div>;

    return (
        <div className="page animate-fadeIn">
            <Link to={`/app/dersler/${topic.subjectId}`} className="content-muted">← {topic.subjectName}</Link>
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">{topic.name}</h1>
                    <p className="page-subtitle">{topic.unitName}</p>
                </div>
            </div>

            {topic.items.length === 0 ? (
                <Card variant="default" padding="lg"><p className="content-muted">Bu konuya henüz içerik eklenmedi.</p></Card>
            ) : (
                <div className="topic-layout">
                    <div>
                        {item ? (
                            <>
                                <ContentViewer key={item.id} item={item} trackProgress={student} onCompleted={onCompleted} />
                                <h2 className="unit-title" style={{ marginTop: 16 }}>{item.title}</h2>
                                {item.description && <p className="content-muted">{item.description}</p>}
                            </>
                        ) : (
                            <p className="content-muted">Yükleniyor...</p>
                        )}
                    </div>

                    <aside>
                        <Card variant="default" padding="md" className="section-gap">
                            <h3 className="unit-title">İçerikler</h3>
                            <ul className="item-list">
                                {topic.items.map(i => (
                                    <li key={i.id}>
                                        <button
                                            type="button"
                                            className={`item-button${i.id === selectedId ? ' item-button-active' : ''}`}
                                            onClick={() => setSearchParams({ item: i.id })}
                                        >
                                            <span aria-hidden="true">{CONTENT_TYPE_ICONS[i.type]}</span>
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ display: 'block', fontWeight: 600 }}>{i.title}</span>
                                                <span className="content-muted">
                                                    {CONTENT_TYPE_LABELS[i.type]}
                                                    {i.durationSeconds ? ` · ${formatDuration(i.durationSeconds)}` : ''}
                                                </span>
                                            </span>
                                            {i.accessTier === 'Premium' && <span className="badge badge-Premium">Premium</span>}
                                            {i.progress?.completed && <span className="item-done" aria-label="Tamamlandı">✓</span>}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </Card>

                        {topic.outcomes.length > 0 && (
                            <Card variant="default" padding="md">
                                <h3 className="unit-title">Kazanımlar</h3>
                                <ul className="outcome-list">
                                    {topic.outcomes.map(o => (
                                        <li key={o.id}><span className="outcome-code">{o.code}</span> {o.description}</li>
                                    ))}
                                </ul>
                            </Card>
                        )}
                    </aside>
                </div>
            )}
        </div>
    );
};

export default TopicPage;
