import React from 'react';
import { Link } from 'react-router-dom';
import type { AttemptSummary } from '../../types/assessment';
import { ATTEMPT_STATUS_LABELS, formatNet } from '../../utils/questions';
import './Test.css';

const when = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

/** Recent tests with their score, each linking to its result (or back into the test while it runs). */
export const AttemptList: React.FC<{ attempts: AttemptSummary[]; emptyText: string }> = ({ attempts, emptyText }) => {
    if (attempts.length === 0) return <p className="content-muted">{emptyText}</p>;

    return (
        <ul className="attempt-list">
            {attempts.map(a => {
                const running = a.status === 'InProgress';
                return (
                    <li key={a.id}>
                        <Link to={running ? `/app/test/${a.id}` : `/app/test/${a.id}/sonuc`}>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <strong style={{ display: 'block' }}>{a.title}</strong>
                                <span className="content-muted">{when(a.startedAt)} · {a.questionCount} soru</span>
                            </span>
                            <span className="content-muted" style={{ textAlign: 'right' }}>
                                {running
                                    ? ATTEMPT_STATUS_LABELS.InProgress
                                    : a.resultsVisible
                                        ? <><strong>{formatNet(a.net)} net</strong><br />%{formatNet(a.percent)}</>
                                        : 'Sonuç bekleniyor'}
                            </span>
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
};

export default AttemptList;
