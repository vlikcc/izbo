import React, { useEffect, useState } from 'react';
import { Button } from '../ui';
import { TopicPicker } from '../content/TopicPicker';
import { MathText } from '../math/MathText';
import assessmentService from '../../services/assessment.service';
import contentService from '../../services/content.service';
import { toast } from '../../lib/toast';
import { DIFFICULTY_LABELS } from '../../utils/questions';
import type { BankQuestion } from '../../types/assessment';
import '../content/Content.css';
import './Questions.css';

interface QuestionPickerProps {
    /** Questions already in the test; they are not offered again. */
    exclude: string[];
    onAdd: (questions: BankQuestion[]) => void;
    /** Random draws use an administrator-only endpoint; teachers pick by hand. */
    allowRandom?: boolean;
    /** Label of the confirm button; "{n}" is replaced with the number picked. */
    addLabel?: string;
}

/** Choose published bank questions by hand, or draw a random set from a topic or a whole subject. */
export const QuestionPicker: React.FC<QuestionPickerProps> = ({ exclude, onAdd, allowRandom = true, addLabel = '{n} soruyu ekle' }) => {
    const [topicId, setTopicId] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [loaded, setLoaded] = useState<{ key: string; items: BankQuestion[] } | null>(null);
    const [picked, setPicked] = useState<Set<string>>(() => new Set());
    const [count, setCount] = useState(10);
    const [drawing, setDrawing] = useState(false);
    const key = `${subjectId}|${topicId}`;

    useEffect(() => {
        if (!subjectId && !topicId) return;
        let cancelled = false;
        assessmentService.listQuestions({ subjectId: subjectId || undefined, topicId: topicId || undefined, status: 'Published', pageSize: 100 })
            .then(r => { if (!cancelled) setLoaded({ key, items: r.items }); })
            .catch(() => { if (!cancelled) setLoaded({ key, items: [] }); });
        return () => { cancelled = true; };
    }, [subjectId, topicId, key]);

    const items = (loaded?.key === key ? loaded.items : []).filter(q => !exclude.includes(q.id));

    const toggle = (id: string) => setPicked(set => {
        const next = new Set(set);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    const draw = async () => {
        setDrawing(true);
        try {
            const topicIds = topicId
                ? [topicId]
                : (await contentService.getSubjectTree(subjectId)).units.flatMap(u => u.topics.map(t => t.id));
            const ids = await assessmentService.suggestQuestions(topicIds, count, exclude);
            if (ids.length === 0) {
                toast.error('Bu seçimde kullanılabilir soru yok');
                return;
            }
            onAdd(await Promise.all(ids.map(id => assessmentService.getQuestion(id))));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Soru çekilemedi');
        } finally {
            setDrawing(false);
        }
    };

    return (
        <div className="modal-form">
            <TopicPicker value={topicId} emptyLabel="Tümü" onChange={setTopicId}
                onContext={c => { setSubjectId(c.subjectId); setPicked(new Set()); }} />

            {allowRandom && subjectId && (
                <div className="row-actions">
                    <span>Rastgele</span>
                    <input type="number" min={1} max={50} className="field-select" style={{ width: 80 }} value={count}
                        onChange={e => setCount(Number(e.target.value))} aria-label="Rastgele soru sayısı" />
                    <span>soru</span>
                    <Button size="sm" variant="secondary" isLoading={drawing} onClick={() => void draw()}>
                        {topicId ? 'Bu konudan ekle' : 'Bu dersten ekle'}
                    </Button>
                </div>
            )}

            {!subjectId ? (
                <p className="content-muted">Önce seviye ve ders seçin.</p>
            ) : items.length === 0 ? (
                <p className="content-muted">{loaded?.key === key ? 'Yayında, kullanılabilir soru yok.' : 'Yükleniyor...'}</p>
            ) : (
                <ul className="picker-list">
                    {items.map(q => (
                        <li key={q.id}>
                            <label>
                                <input type="checkbox" checked={picked.has(q.id)} onChange={() => toggle(q.id)} />
                                <span className="bank-stem">{q.stem ? <MathText text={q.stem} /> : '(görselli soru)'}</span>
                                <span className="content-muted">{q.topicName} · {DIFFICULTY_LABELS[q.difficulty]}</span>
                            </label>
                        </li>
                    ))}
                </ul>
            )}

            <div className="modal-actions">
                <Button variant="primary" disabled={picked.size === 0}
                    onClick={() => onAdd(items.filter(q => picked.has(q.id)))}>
                    {picked.size ? addLabel.replace('{n}', String(picked.size)) : 'Soru seçin'}
                </Button>
            </div>
        </div>
    );
};

export default QuestionPicker;
