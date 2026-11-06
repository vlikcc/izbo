import React, { useEffect, useState } from 'react';
import contentService from '../../services/content.service';
import type { Level, Subject, SubjectTree } from '../../types/content';
import { sortLevels } from '../../utils/content';
import './Content.css';

interface TopicPickerProps {
    value: string;
    onChange: (topicId: string) => void;
}

/** Level → subject → topic, for attaching content to the curriculum. */
export const TopicPicker: React.FC<TopicPickerProps> = ({ value, onChange }) => {
    const [levels, setLevels] = useState<Level[]>([]);
    const [levelSlug, setLevelSlug] = useState('');
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [subjectId, setSubjectId] = useState('');
    const [tree, setTree] = useState<SubjectTree | null>(null);

    useEffect(() => {
        contentService.getLevels().then(l => setLevels(sortLevels(l))).catch(() => setLevels([]));
    }, []);

    useEffect(() => {
        if (levelSlug) contentService.getSubjects(levelSlug).then(setSubjects).catch(() => setSubjects([]));
    }, [levelSlug]);

    useEffect(() => {
        if (subjectId) contentService.getSubjectTree(subjectId).then(setTree).catch(() => setTree(null));
    }, [subjectId]);

    const chooseLevel = (slug: string) => {
        setLevelSlug(slug);
        setSubjects([]);
        setSubjectId('');
        setTree(null);
        onChange('');
    };

    const chooseSubject = (id: string) => {
        setSubjectId(id);
        setTree(null);
        onChange('');
    };

    const topicCount = tree?.units.reduce((n, u) => n + u.topics.length, 0) ?? 0;

    return (
        <div className="form-grid">
            <div className="input-wrapper">
                <label className="input-label" htmlFor="pick-level">Seviye</label>
                <select id="pick-level" className="field-select" value={levelSlug} onChange={e => chooseLevel(e.target.value)}>
                    <option value="">Seçin</option>
                    {levels.map(l => <option key={l.slug} value={l.slug}>{l.name}</option>)}
                </select>
            </div>
            <div className="input-wrapper">
                <label className="input-label" htmlFor="pick-subject">Ders</label>
                <select id="pick-subject" className="field-select" value={subjectId} onChange={e => chooseSubject(e.target.value)} disabled={!subjects.length}>
                    <option value="">Seçin</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
            <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
                <label className="input-label" htmlFor="pick-topic">Konu</label>
                <select id="pick-topic" className="field-select" value={value} onChange={e => onChange(e.target.value)} disabled={!topicCount}>
                    <option value="">{subjectId && tree && !topicCount ? 'Bu derste henüz konu yok' : 'Seçin'}</option>
                    {tree?.units.map(u => (
                        <optgroup key={u.id} label={u.name}>
                            {u.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </optgroup>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default TopicPicker;
