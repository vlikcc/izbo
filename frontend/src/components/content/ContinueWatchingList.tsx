import React from 'react';
import { Link } from 'react-router-dom';
import type { ContinueWatching } from '../../types/content';
import { CONTENT_TYPE_ICONS, formatDuration, percent } from '../../utils/content';
import './Content.css';

/** "Kaldığın yerden devam": recently started lessons with how far the learner got. */
export const ContinueWatchingList: React.FC<{ items: ContinueWatching[]; emptyText?: string }> = ({ items, emptyText }) => {
    if (items.length === 0) {
        return emptyText ? <p className="content-muted">{emptyText}</p> : null;
    }

    return (
        <ul className="continue-list">
            {items.map(c => {
                const total = c.item.durationSeconds ?? 0;
                const done = c.item.progress?.completed ? 100 : percent(c.positionSeconds, total);
                return (
                    <li key={c.item.id}>
                        <Link to={`/app/konu/${c.item.topicId}?item=${c.item.id}`} className="continue-item">
                            <span className="continue-icon" aria-hidden="true">{CONTENT_TYPE_ICONS[c.item.type]}</span>
                            <span className="continue-text">
                                <span className="continue-title">{c.item.title}</span>
                                <span className="content-muted">{c.subjectName} · {c.topicName}</span>
                                {total > 0 && (
                                    <span className="progress-bar" aria-label={`%${done} izlendi`}>
                                        <span style={{ width: `${done}%` }} />
                                    </span>
                                )}
                            </span>
                            <span className="content-muted">{formatDuration(total)}</span>
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
};

export default ContinueWatchingList;
