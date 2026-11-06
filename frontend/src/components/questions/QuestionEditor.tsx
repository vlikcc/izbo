import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../ui';
import { TopicPicker } from '../content/TopicPicker';
import { QuestionView } from './QuestionView';
import assessmentService from '../../services/assessment.service';
import contentService from '../../services/content.service';
import { toast } from '../../lib/toast';
import type { BankQuestion, BankQuestionType, QuestionDifficulty, SaveBankQuestionRequest } from '../../types/assessment';
import type { TopicDetail } from '../../types/content';
import { DIFFICULTY_LABELS, OPTION_KEYS, TRUE_FALSE_OPTIONS } from '../../utils/questions';
import '../content/Content.css';
import './Questions.css';

interface DraftOption {
    text: string;
    assetId: string | null;
}

interface QuestionEditorProps {
    /** The question to edit, or null for a new one. Mount the editor afresh (with a key) for each question. */
    question: BankQuestion | null;
    onSaved: (question: BankQuestion) => void;
    onCancel: () => void;
}

const emptyOptions = (): DraftOption[] => Array.from({ length: 4 }, () => ({ text: '', assetId: null }));

/** Writes or edits a bank question with a live preview. Formulas go between $ signs. */
export const QuestionEditor: React.FC<QuestionEditorProps> = ({ question, onSaved, onCancel }) => {
    const [topicId, setTopicId] = useState(question?.topicId ?? '');
    const [changingTopic, setChangingTopic] = useState(!question);
    const [topic, setTopic] = useState<TopicDetail | null>(null);
    const [outcomeId, setOutcomeId] = useState(question?.outcome?.id ?? '');
    const [type, setType] = useState<BankQuestionType>(question?.type ?? 'MultipleChoice');
    const [stem, setStem] = useState(question?.stem ?? '');
    const [stemAssetId, setStemAssetId] = useState<string | null>(question?.stemAssetId ?? null);
    const [options, setOptions] = useState<DraftOption[]>(
        question?.type === 'MultipleChoice'
            ? question.options.map(o => ({ text: o.text, assetId: o.assetId }))
            : emptyOptions());
    const [correctKey, setCorrectKey] = useState(question?.correctKey ?? '');
    const [difficulty, setDifficulty] = useState<QuestionDifficulty>(question?.difficulty ?? 'Medium');
    const [explanation, setExplanation] = useState(question?.explanation ?? '');
    const [videoId, setVideoId] = useState(question?.solutionVideoItemId ?? '');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const uploadTarget = useRef<'stem' | number>('stem');

    useEffect(() => {
        if (!topicId) return;
        let cancelled = false;
        contentService.getTopic(topicId)
            .then(detail => { if (!cancelled) setTopic(detail); })
            .catch(() => { if (!cancelled) setTopic(null); });
        return () => { cancelled = true; };
    }, [topicId]);

    // The loaded topic only counts while it is the selected one.
    const currentTopic = topic && topic.id === topicId ? topic : null;
    const videos = currentTopic?.items.filter(i => i.type === 'SolvedQuestionVideo' || i.type === 'Video') ?? [];

    const chooseTopic = (id: string) => {
        setTopicId(id);
        setOutcomeId('');
        setVideoId('');
    };

    const chooseType = (next: BankQuestionType) => {
        setType(next);
        setCorrectKey('');
    };

    const updateOption = (index: number, patch: Partial<DraftOption>) =>
        setOptions(list => list.map((o, i) => (i === index ? { ...o, ...patch } : o)));

    const removeOption = (index: number) => {
        setOptions(list => list.filter((_, i) => i !== index));
        // Keys follow position, so the answer moves with the options after the removed one.
        const removedKey = OPTION_KEYS[index];
        setCorrectKey(key => {
            const at = OPTION_KEYS.indexOf(key);
            if (key === removedKey) return '';
            return at > index ? OPTION_KEYS[at - 1] : key;
        });
    };

    const pickImage = (target: 'stem' | number) => {
        uploadTarget.current = target;
        fileInput.current?.click();
    };

    const uploadImage = async (file: File) => {
        const target = uploadTarget.current;
        setUploading(String(target));
        try {
            const asset = await assessmentService.uploadQuestionImage(file);
            if (target === 'stem') setStemAssetId(asset.id);
            else updateOption(target, { assetId: asset.id });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Görsel yüklenemedi');
        } finally {
            setUploading(null);
            if (fileInput.current) fileInput.current.value = '';
        }
    };

    const previewOptions = type === 'TrueFalse'
        ? TRUE_FALSE_OPTIONS
        : options.map((o, i) => ({ key: OPTION_KEYS[i], text: o.text, assetId: o.assetId }));

    const validate = (): string | null => {
        if (!topicId) return 'Bir konu seçin';
        if (!stem.trim() && !stemAssetId) return 'Soru metni ya da görseli gerekli';
        if (type === 'MultipleChoice') {
            if (options.length < 2) return 'En az iki seçenek gerekli';
            const empty = options.findIndex(o => !o.text.trim() && !o.assetId);
            if (empty >= 0) return `${OPTION_KEYS[empty]} seçeneği boş`;
        }
        if (!correctKey) return 'Doğru cevabı işaretleyin';
        return null;
    };

    const save = async () => {
        const error = validate();
        if (error) {
            toast.error(error);
            return;
        }

        const request: SaveBankQuestionRequest = {
            topicId,
            learningOutcomeId: outcomeId || null,
            type,
            stem: stem.trim(),
            stemAssetId,
            options: type === 'MultipleChoice' ? options.map(o => ({ text: o.text.trim(), assetId: o.assetId })) : null,
            correctKey,
            difficulty,
            explanation: explanation.trim() || null,
            solutionVideoItemId: videoId || null,
        };

        setSaving(true);
        try {
            const saved = question
                ? await assessmentService.updateQuestion(question.id, request)
                : await assessmentService.createQuestion(request);
            toast.success('Soru kaydedildi');
            onSaved(saved);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Soru kaydedilemedi');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-form">
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden aria-hidden="true"
                onChange={e => { const file = e.target.files?.[0]; if (file) void uploadImage(file); }} />

            <div className="editor-layout">
                <div>
                    {changingTopic ? (
                        <TopicPicker value={topicId} onChange={chooseTopic} />
                    ) : (
                        <div className="row-actions section-gap">
                            <span><strong>{question?.subjectName}</strong> · {question?.unitName} · {question?.topicName}</span>
                            <Button size="sm" variant="ghost" onClick={() => setChangingTopic(true)}>Konuyu değiştir</Button>
                        </div>
                    )}

                    <div className="form-grid">
                        <div className="input-wrapper">
                            <label className="input-label" htmlFor="q-outcome">Kazanım</label>
                            <select id="q-outcome" className="field-select" value={outcomeId} onChange={e => setOutcomeId(e.target.value)}
                                disabled={!currentTopic?.outcomes.length}>
                                <option value="">{currentTopic && !currentTopic.outcomes.length ? 'Bu konuda kazanım yok' : 'Seçilmedi'}</option>
                                {currentTopic?.outcomes.map(o => <option key={o.id} value={o.id}>{o.code} — {o.description}</option>)}
                            </select>
                        </div>
                        <div className="input-wrapper">
                            <label className="input-label" htmlFor="q-type">Soru tipi</label>
                            <select id="q-type" className="field-select" value={type} onChange={e => chooseType(e.target.value as BankQuestionType)}>
                                <option value="MultipleChoice">Çoktan seçmeli</option>
                                <option value="TrueFalse">Doğru / Yanlış</option>
                            </select>
                        </div>
                        <div className="input-wrapper">
                            <label className="input-label" htmlFor="q-difficulty">Zorluk</label>
                            <select id="q-difficulty" className="field-select" value={difficulty} onChange={e => setDifficulty(e.target.value as QuestionDifficulty)}>
                                {(Object.keys(DIFFICULTY_LABELS) as QuestionDifficulty[]).map(d => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="q-stem">Soru</label>
                        <textarea id="q-stem" className="field-textarea" value={stem} onChange={e => setStem(e.target.value)} maxLength={8000}
                            placeholder="Formülleri $ işaretleri arasına yazın: $\frac{3}{4} + \frac{1}{2}$" />
                        <div className="row-actions">
                            {stemAssetId ? (
                                <span className="image-chip">
                                    <img src={assessmentService.assetUrl(stemAssetId)} alt="" />
                                    <Button size="sm" variant="ghost" onClick={() => setStemAssetId(null)}>Görseli kaldır</Button>
                                </span>
                            ) : (
                                <Button size="sm" variant="secondary" isLoading={uploading === 'stem'} onClick={() => pickImage('stem')}>Görsel ekle</Button>
                            )}
                            <span className="hint">PNG, JPEG veya WebP, en fazla 2 MB</span>
                        </div>
                    </div>

                    <fieldset className="input-wrapper editor-fieldset">
                        <legend className="input-label">Seçenekler — doğru olanı işaretleyin</legend>
                        {type === 'TrueFalse' ? (
                            <div className="row-actions">
                                {TRUE_FALSE_OPTIONS.map(o => (
                                    <Button key={o.key} size="sm" variant={correctKey === o.key ? 'primary' : 'outline'}
                                        aria-pressed={correctKey === o.key} onClick={() => setCorrectKey(o.key)}>{o.text}</Button>
                                ))}
                            </div>
                        ) : (
                            <>
                                {options.map((option, index) => {
                                    const key = OPTION_KEYS[index];
                                    return (
                                        <div key={key} className="option-editor">
                                            <button type="button" className={`correct-toggle ${correctKey === key ? 'correct-toggle-active' : ''}`}
                                                aria-pressed={correctKey === key} aria-label={`${key} doğru cevap`} onClick={() => setCorrectKey(key)}>
                                                {key}
                                            </button>
                                            <div>
                                                <textarea className="field-textarea" value={option.text} maxLength={1000} aria-label={`${key} seçeneği`}
                                                    onChange={e => updateOption(index, { text: e.target.value })} />
                                                {option.assetId ? (
                                                    <span className="image-chip">
                                                        <img src={assessmentService.assetUrl(option.assetId)} alt="" />
                                                        <Button size="sm" variant="ghost" onClick={() => updateOption(index, { assetId: null })}>Görseli kaldır</Button>
                                                    </span>
                                                ) : (
                                                    <Button size="sm" variant="ghost" isLoading={uploading === String(index)} onClick={() => pickImage(index)}>Görsel</Button>
                                                )}
                                            </div>
                                            <Button size="sm" variant="ghost" disabled={options.length <= 2} aria-label={`${key} seçeneğini sil`}
                                                onClick={() => removeOption(index)}>✕</Button>
                                        </div>
                                    );
                                })}
                                {options.length < OPTION_KEYS.length && (
                                    <Button size="sm" variant="secondary" onClick={() => setOptions(list => [...list, { text: '', assetId: null }])}>
                                        Seçenek ekle
                                    </Button>
                                )}
                            </>
                        )}
                    </fieldset>

                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="q-explanation">Çözüm / açıklama</label>
                        <textarea id="q-explanation" className="field-textarea" value={explanation} onChange={e => setExplanation(e.target.value)} maxLength={8000} />
                    </div>

                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="q-video">Çözüm videosu</label>
                        <select id="q-video" className="field-select" value={videoId} onChange={e => setVideoId(e.target.value)} disabled={!videos.length}>
                            <option value="">{currentTopic && !videos.length ? 'Bu konuda video yok' : 'Yok'}</option>
                            {videos.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
                        </select>
                    </div>
                </div>

                <div className="editor-preview" aria-label="Önizleme">
                    <p className="content-muted section-gap">Önizleme</p>
                    <QuestionView stem={stem} stemAssetId={stemAssetId} options={previewOptions} correctKey={correctKey || null} />
                    {explanation.trim() && (
                        <p className="content-muted" style={{ marginTop: 16 }}><strong>Çözüm:</strong> {explanation}</p>
                    )}
                </div>
            </div>

            <div className="modal-actions">
                <Button variant="ghost" onClick={onCancel}>Vazgeç</Button>
                <Button variant="primary" isLoading={saving} onClick={() => void save()}>Kaydet</Button>
            </div>
        </div>
    );
};

export default QuestionEditor;
