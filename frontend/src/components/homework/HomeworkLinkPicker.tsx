import React, { useEffect, useState } from 'react';
import { TopicPicker } from '../content/TopicPicker';
import contentService from '../../services/content.service';
import type { HomeworkLinkKind } from '../../types';
import type { TopicDetail } from '../../types/content';
import { CONTENT_TYPE_LABELS } from '../../utils/content';
import { NO_LINK, type HomeworkLink } from '../../utils/homework';
import '../content/Content.css';

/** Optionally points a homework at a lesson from the catalog or a topic test from the question bank. */
export const HomeworkLinkPicker: React.FC<{ onChange: (link: HomeworkLink) => void }> = ({ onChange }) => {
    const [kind, setKind] = useState<HomeworkLinkKind>('None');
    const [topicId, setTopicId] = useState('');
    const [loaded, setLoaded] = useState<TopicDetail | null>(null);
    const [itemId, setItemId] = useState('');

    useEffect(() => {
        if (!topicId) return;
        let cancelled = false;
        contentService.getTopic(topicId)
            .then(detail => { if (!cancelled) setLoaded(detail); })
            .catch(() => { if (!cancelled) setLoaded(null); });
        return () => { cancelled = true; };
    }, [topicId]);

    const topic = loaded?.id === topicId ? loaded : null;

    // Report the link whenever the choice or the loaded topic changes.
    useEffect(() => {
        if (kind === 'None') onChange(NO_LINK);
        else if (kind === 'TopicTest') onChange(topic ? { kind, targetId: topic.id, title: topic.name } : NO_LINK);
        else {
            const item = topic?.items.find(i => i.id === itemId);
            onChange(item ? { kind, targetId: item.id, title: item.title } : NO_LINK);
        }
    }, [kind, topic, itemId, onChange]);

    return (
        <div className="form-group">
            <label className="form-label" htmlFor="hw-link-kind">
                <span className="form-label-icon">🔗</span>
                Bağlantı (isteğe bağlı)
            </label>
            <select id="hw-link-kind" className="form-select" value={kind} onChange={e => { setKind(e.target.value as HomeworkLinkKind); setItemId(''); }}>
                <option value="None">Yok</option>
                <option value="ContentItem">Ders içeriği izlet / okut</option>
                <option value="TopicTest">Konu testi çözdür</option>
            </select>

            {kind !== 'None' && (
                <div style={{ marginTop: 12 }}>
                    <TopicPicker value={topicId} onChange={id => { setTopicId(id); setItemId(''); }} />
                    {kind === 'ContentItem' && topic && (
                        <div className="input-wrapper" style={{ marginTop: 8 }}>
                            <label className="input-label" htmlFor="hw-link-item">İçerik</label>
                            <select id="hw-link-item" className="field-select" value={itemId} onChange={e => setItemId(e.target.value)}
                                disabled={!topic.items.length}>
                                <option value="">{topic.items.length ? 'Seçin' : 'Bu konuda içerik yok'}</option>
                                {topic.items.map(i => <option key={i.id} value={i.id}>{i.title} · {CONTENT_TYPE_LABELS[i.type]}</option>)}
                            </select>
                        </div>
                    )}
                    {kind === 'TopicTest' && (
                        <p className="content-muted" style={{ marginTop: 8 }}>
                            Öğrenci bu konudan 10 soruluk bir test çözer; bitirince sonucu (doğru, yanlış, net) teslim olarak size gelir.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default HomeworkLinkPicker;
