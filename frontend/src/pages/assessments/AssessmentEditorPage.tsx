import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Modal } from '../../components/ui';
import { MathText } from '../../components/math/MathText';
import { AssessmentSettingsForm } from './AssessmentSettingsForm';
import { QuestionPicker } from './QuestionPicker';
import assessmentService from '../../services/assessment.service';
import contentService from '../../services/content.service';
import { toast } from '../../lib/toast';
import { DIFFICULTY_LABELS, formatDateTime } from '../../utils/questions';
import type { AssessmentDetail, BankQuestion } from '../../types/assessment';
import type { Subject } from '../../types/content';
import '../../components/content/Content.css';
import '../../components/questions/Questions.css';
import '../../components/test/Test.css';

interface DraftSection {
    key: string;
    subjectId: string | null;
    title: string;
    questions: BankQuestion[];
}

const toDraft = (detail: AssessmentDetail): DraftSection[] => detail.sections.map(s => ({
    key: s.id, subjectId: s.subjectId, title: s.title, questions: s.questions,
}));

/** /app/admin/denemeler/:id — settings, sections and questions of one test; publish when ready. */
export const AssessmentEditorPage: React.FC = () => {
    const { assessmentId = '' } = useParams();
    const navigate = useNavigate();
    const [detail, setDetail] = useState<AssessmentDetail | null>(null);
    const [sections, setSections] = useState<DraftSection[]>([]);
    const [dirty, setDirty] = useState(false);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [pickerFor, setPickerFor] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const apply = (next: AssessmentDetail) => {
        setDetail(next);
        setSections(toDraft(next));
        setDirty(false);
    };

    useEffect(() => {
        assessmentService.getAssessmentDetail(assessmentId)
            .then(next => { setDetail(next); setSections(toDraft(next)); setDirty(false); })
            .catch(e => toast.error(e instanceof Error ? e.message : 'Sınav yüklenemedi'));
    }, [assessmentId]);

    const levelSlug = detail?.summary.levelSlug ?? '';
    useEffect(() => {
        if (levelSlug) contentService.getSubjects(levelSlug).then(setSubjects).catch(() => setSubjects([]));
    }, [levelSlug]);

    if (!detail || detail.summary.id !== assessmentId) return <div className="page"><p className="content-muted">Yükleniyor...</p></div>;

    const { summary } = detail;
    const draft = summary.status === 'Draft';
    const total = sections.reduce((n, s) => n + s.questions.length, 0);
    const allIds = sections.flatMap(s => s.questions.map(q => q.id));

    const edit = (update: (list: DraftSection[]) => DraftSection[]) => {
        setSections(update);
        setDirty(true);
    };

    const addSection = (subjectId: string) => {
        const subject = subjects.find(s => s.id === subjectId);
        edit(list => [...list, { key: crypto.randomUUID(), subjectId: subjectId || null, title: subject?.name ?? `Bölüm ${list.length + 1}`, questions: [] }]);
    };

    const run = async (label: string, action: () => Promise<AssessmentDetail | void>) => {
        setBusy(true);
        try {
            const result = await action();
            if (result) apply(result);
            toast.success(label);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
        } finally {
            setBusy(false);
        }
    };

    const saveSections = () => run('Sorular kaydedildi', () => assessmentService.saveSections(assessmentId, sections.map(s => ({
        subjectId: s.subjectId, title: s.title, questionIds: s.questions.map(q => q.id),
    }))));

    return (
        <div className="page animate-fadeIn">
            <Link to="/app/admin/denemeler" className="content-muted">← Deneme sınavları</Link>
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">{summary.title}</h1>
                    <p className="page-subtitle">
                        {summary.kind === 'MockExam' ? 'Deneme' : 'Seviye belirleme'} · {summary.levelName} · {total} soru · {summary.durationMinutes} dk
                        {summary.windowStart && summary.windowEnd ? ` · ${formatDateTime(summary.windowStart)} – ${formatDateTime(summary.windowEnd)}` : ''}
                    </p>
                </div>
                <div className="row-actions">
                    {draft ? (
                        <>
                            <Button variant="ghost" disabled={busy || detail.attemptCount > 0} onClick={() => {
                                if (window.confirm('Sınav silinsin mi?')) {
                                    void run('Sınav silindi', async () => {
                                        await assessmentService.deleteAssessment(assessmentId);
                                        navigate('/app/admin/denemeler');
                                    });
                                }
                            }}>Sil</Button>
                            <Button variant="primary" isLoading={busy} disabled={dirty || total === 0}
                                onClick={() => void run('Yayınlandı', () => assessmentService.publishAssessment(assessmentId))}>Yayınla</Button>
                        </>
                    ) : (
                        <Button variant="secondary" isLoading={busy} disabled={detail.attemptCount > 0}
                            onClick={() => void run('Taslağa alındı', () => assessmentService.unpublishAssessment(assessmentId))}>Yayından kaldır</Button>
                    )}
                </div>
            </div>

            {!draft && (
                <Card variant="default" padding="md" className="section-gap">
                    <p className="content-muted">
                        Yayında. {detail.attemptCount} öğrenci girdi{detail.rankedAt ? `; sıralama ${formatDateTime(detail.rankedAt)} tarihinde hesaplandı` : ''}.
                        {detail.attemptCount > 0 ? ' Giriş yapılmış bir sınav değiştirilemez.' : ' Değiştirmek için önce yayından kaldırın.'}
                    </p>
                </Card>
            )}

            <Card variant="default" padding="md" className="section-gap">
                <h2 className="unit-title">Ayarlar</h2>
                <AssessmentSettingsForm key={summary.id + summary.status} initial={summary} disabled={!draft} submitLabel="Ayarları kaydet"
                    onSubmit={request => run('Ayarlar kaydedildi', () => assessmentService.updateAssessment(assessmentId, request))} />
            </Card>

            {sections.map((section, index) => (
                <Card key={section.key} variant="default" padding="md" className="section-gap">
                    <div className="row-actions" style={{ justifyContent: 'space-between' }}>
                        <input className="field-select" style={{ maxWidth: 320, fontWeight: 700 }} value={section.title} disabled={!draft}
                            aria-label="Bölüm adı" onChange={e => edit(list => list.map((s, i) => (i === index ? { ...s, title: e.target.value } : s)))} />
                        <span className="content-muted">{section.questions.length} soru</span>
                        {draft && (
                            <div className="row-actions">
                                <Button size="sm" variant="secondary" onClick={() => setPickerFor(section.key)}>Soru ekle</Button>
                                <Button size="sm" variant="ghost" onClick={() => edit(list => list.filter((_, i) => i !== index))}>Bölümü sil</Button>
                            </div>
                        )}
                    </div>
                    {section.questions.length > 0 && (
                        <ol className="picker-list" style={{ marginTop: 12 }}>
                            {section.questions.map(q => (
                                <li key={q.id}>
                                    <span className="bank-stem">{q.stem ? <MathText text={q.stem} /> : '(görselli soru)'}</span>
                                    <span className="content-muted">{q.topicName} · {DIFFICULTY_LABELS[q.difficulty]}</span>
                                    {draft && (
                                        <Button size="sm" variant="ghost" aria-label="Soruyu çıkar"
                                            onClick={() => edit(list => list.map((s, i) => (i === index ? { ...s, questions: s.questions.filter(x => x.id !== q.id) } : s)))}>✕</Button>
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
                </Card>
            ))}

            {draft && (
                <Card variant="default" padding="md" className="section-gap">
                    <div className="row-actions">
                        <select className="field-select" style={{ maxWidth: 260 }} value="" aria-label="Bölüm ekle"
                            onChange={e => { if (e.target.value !== '') addSection(e.target.value === '-' ? '' : e.target.value); }}>
                            <option value="">+ Bölüm ekle (ders seçin)</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            <option value="-">Derssiz bölüm</option>
                        </select>
                        <Button variant="primary" isLoading={busy} disabled={!dirty} onClick={() => void saveSections()}>Soruları kaydet</Button>
                        {dirty && <span className="content-muted">Kaydedilmemiş değişiklik var; yayınlamadan önce kaydedin.</span>}
                    </div>
                </Card>
            )}

            <Modal isOpen={pickerFor !== null} onClose={() => setPickerFor(null)} title="Bankadan soru ekle" size="lg">
                {pickerFor && (
                    <QuestionPicker exclude={allIds} onAdd={questions => {
                        edit(list => list.map(s => (s.key === pickerFor ? { ...s, questions: [...s.questions, ...questions.filter(q => !allIds.includes(q.id))] } : s)));
                        setPickerFor(null);
                    }} />
                )}
            </Modal>
        </div>
    );
};

export default AssessmentEditorPage;
