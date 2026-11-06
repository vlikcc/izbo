import React, { useEffect, useState } from 'react';
import { Button } from '../../components/ui';
import contentService from '../../services/content.service';
import type { AssessmentKind, AssessmentSummary, SaveAssessmentRequest, ScoringRule } from '../../types/assessment';
import type { ContentAccessTier, Level } from '../../types/content';
import { sortLevels } from '../../utils/content';
import { SCORING_RULE_LABELS } from '../../utils/questions';
import '../../components/content/Content.css';

/** ISO (UTC) → the value a datetime-local input shows in the browser's time zone. */
const toLocalInput = (iso: string | null) => {
    if (!iso) return '';
    const date = new Date(iso);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
};

const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

interface Props {
    initial: AssessmentSummary | null;
    disabled?: boolean;
    submitLabel: string;
    onSubmit: (request: SaveAssessmentRequest) => Promise<void>;
}

/** Settings of a mock exam or placement test. Mock exams need a window; placement tests have none. */
export const AssessmentSettingsForm: React.FC<Props> = ({ initial, disabled = false, submitLabel, onSubmit }) => {
    const [levels, setLevels] = useState<Level[]>([]);
    const [kind, setKind] = useState<AssessmentKind>(initial?.kind ?? 'MockExam');
    const [title, setTitle] = useState(initial?.title ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [levelId, setLevelId] = useState(initial?.levelId ?? '');
    const [duration, setDuration] = useState(initial?.durationMinutes ?? 80);
    const [rule, setRule] = useState<ScoringRule | ''>(initial?.scoringRule ?? '');
    const [start, setStart] = useState(toLocalInput(initial?.windowStart ?? null));
    const [end, setEnd] = useState(toLocalInput(initial?.windowEnd ?? null));
    const [tier, setTier] = useState<ContentAccessTier>(initial?.accessTier ?? 'Free');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        contentService.getLevels().then(l => setLevels(sortLevels(l))).catch(() => setLevels([]));
    }, []);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            await onSubmit({
                kind,
                title: title.trim(),
                description: description.trim() || null,
                levelId,
                durationMinutes: duration,
                scoringRule: rule || null,
                windowStart: kind === 'MockExam' ? fromLocalInput(start) : null,
                windowEnd: kind === 'MockExam' ? fromLocalInput(end) : null,
                accessTier: tier,
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="modal-form" onSubmit={e => void submit(e)}>
            <fieldset disabled={disabled} className="editor-fieldset" style={{ display: 'contents' }}>
                <div className="form-grid">
                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="as-kind">Tür</label>
                        <select id="as-kind" className="field-select" value={kind} onChange={e => setKind(e.target.value as AssessmentKind)}>
                            <option value="MockExam">Deneme sınavı (takvimli, sıralamalı)</option>
                            <option value="Placement">Seviye belirleme</option>
                        </select>
                    </div>
                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="as-level">Seviye</label>
                        <select id="as-level" className="field-select" value={levelId} onChange={e => setLevelId(e.target.value)} required>
                            <option value="">Seçin</option>
                            {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>
                    <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
                        <label className="input-label" htmlFor="as-title">Başlık</label>
                        <input id="as-title" className="field-select" value={title} onChange={e => setTitle(e.target.value)} maxLength={255} required
                            placeholder="LGS Kasım Denemesi" />
                    </div>
                    <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
                        <label className="input-label" htmlFor="as-desc">Açıklama</label>
                        <textarea id="as-desc" className="field-textarea" value={description} onChange={e => setDescription(e.target.value)} maxLength={4000} />
                    </div>
                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="as-duration">Süre (dakika)</label>
                        <input id="as-duration" type="number" min={5} max={300} className="field-select" value={duration}
                            onChange={e => setDuration(Number(e.target.value))} required />
                    </div>
                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="as-rule">Puanlama</label>
                        <select id="as-rule" className="field-select" value={rule} onChange={e => setRule(e.target.value as ScoringRule | '')}>
                            <option value="">Seviyeye göre</option>
                            {(Object.keys(SCORING_RULE_LABELS) as ScoringRule[]).map(r => <option key={r} value={r}>{SCORING_RULE_LABELS[r]}</option>)}
                        </select>
                    </div>
                    {kind === 'MockExam' && (
                        <>
                            <div className="input-wrapper">
                                <label className="input-label" htmlFor="as-start">Başlangıç</label>
                                <input id="as-start" type="datetime-local" className="field-select" value={start} onChange={e => setStart(e.target.value)} required />
                            </div>
                            <div className="input-wrapper">
                                <label className="input-label" htmlFor="as-end">Bitiş</label>
                                <input id="as-end" type="datetime-local" className="field-select" value={end} onChange={e => setEnd(e.target.value)} required />
                            </div>
                        </>
                    )}
                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="as-tier">Erişim</label>
                        <select id="as-tier" className="field-select" value={tier} onChange={e => setTier(e.target.value as ContentAccessTier)}>
                            <option value="Free">Ücretsiz</option>
                            <option value="Premium">Premium</option>
                        </select>
                    </div>
                </div>
                {kind === 'MockExam' && (
                    <p className="content-muted">Pencere içinde başlayanlar sıralamaya girer; sonuçlar ve cevap anahtarı pencere kapanınca açılır.</p>
                )}
                {!disabled && (
                    <div className="modal-actions">
                        <Button type="submit" variant="primary" isLoading={busy}>{submitLabel}</Button>
                    </div>
                )}
            </fieldset>
        </form>
    );
};

export default AssessmentSettingsForm;
