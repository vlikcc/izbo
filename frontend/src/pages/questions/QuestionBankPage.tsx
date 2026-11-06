import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Modal } from '../../components/ui';
import { Pagination } from '../../components/ui/Pagination';
import { TopicPicker } from '../../components/content/TopicPicker';
import { QuestionEditor } from '../../components/questions/QuestionEditor';
import { QuestionView } from '../../components/questions/QuestionView';
import assessmentService from '../../services/assessment.service';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../lib/toast';
import { isAdmin } from '../../utils/roles';
import { STATUS_LABELS } from '../../utils/content';
import { DIFFICULTY_LABELS } from '../../utils/questions';
import { MathText } from '../../components/math/MathText';
import type { PagedResponse } from '../../types';
import type { BankQuestion, QuestionDifficulty, QuestionListQuery } from '../../types/assessment';
import type { ContentStatus } from '../../types/content';
import '../../components/content/Content.css';
import '../../components/questions/Questions.css';

const PAGE_SIZE = 20;

/**
 * The question bank. Teachers write questions and send them for review; administrators publish directly
 * and approve teachers' questions. Everyone here sees published questions to reuse in their own exams.
 */
export const QuestionBankPage: React.FC = () => {
    const user = useAuthStore(s => s.user);
    const admin = isAdmin(user);

    const [context, setContext] = useState({ levelId: '', subjectId: '' });
    const [topicId, setTopicId] = useState('');
    const [difficulty, setDifficulty] = useState<QuestionDifficulty | ''>('');
    const [status, setStatus] = useState<ContentStatus | ''>('');
    const [mine, setMine] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState<{ key: string; data: PagedResponse<BankQuestion> } | null>(null);

    const [editing, setEditing] = useState<{ question: BankQuestion | null; session: number } | null>(null);
    const [viewing, setViewing] = useState<BankQuestion | null>(null);

    const query: QuestionListQuery = useMemo(() => ({
        levelId: context.levelId || undefined,
        subjectId: context.subjectId || undefined,
        topicId: topicId || undefined,
        difficulty: difficulty || undefined,
        status: status || undefined,
        mine,
        search: search.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
    }), [context, topicId, difficulty, status, mine, search, page]);
    const key = `${JSON.stringify(query)}#${reload}`;

    useEffect(() => {
        let cancelled = false;
        const timer = window.setTimeout(() => {
            assessmentService.listQuestions(query)
                .then(data => { if (!cancelled) setResult({ key, data }); })
                .catch(e => {
                    if (cancelled) return;
                    toast.error(e instanceof Error ? e.message : 'Sorular yüklenemedi');
                    setResult({ key, data: { items: [], page: 1, pageSize: PAGE_SIZE, totalCount: 0, totalPages: 0 } });
                });
        }, 250);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [query, key]);

    const loading = result?.key !== key;
    const refresh = useCallback(() => setReload(n => n + 1), []);

    const filter = <T,>(setter: (value: T) => void) => (value: T) => {
        setter(value);
        setPage(1);
    };

    const act = async (label: string, action: () => Promise<unknown>) => {
        try {
            await action();
            toast.success(label);
            refresh();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
        }
    };

    const canEdit = (q: BankQuestion) => admin || q.ownerId === user?.id;

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">❓ Soru bankası</h1>
                    <p className="page-subtitle">Kazanıma bağlı sorular: konu testleri, denemeler ve sınavlarınız için</p>
                </div>
                <div className="row-actions">
                    {admin && <Link to="/app/admin/soru-aktar"><Button variant="secondary">Excel'den aktar</Button></Link>}
                    <Button variant="primary" onClick={() => setEditing(prev => ({ question: null, session: (prev?.session ?? 0) + 1 }))}>Yeni soru</Button>
                </div>
            </div>

            <Card variant="default" padding="md" className="section-gap">
                <TopicPicker value={topicId} emptyLabel="Tümü"
                    onChange={filter(setTopicId)}
                    onContext={filter(setContext)} />
                <div className="bank-filters" style={{ marginTop: 12 }}>
                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="f-difficulty">Zorluk</label>
                        <select id="f-difficulty" className="field-select" value={difficulty} onChange={e => filter(setDifficulty)(e.target.value as QuestionDifficulty | '')}>
                            <option value="">Tümü</option>
                            {(Object.keys(DIFFICULTY_LABELS) as QuestionDifficulty[]).map(d => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                        </select>
                    </div>
                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="f-status">Durum</label>
                        <select id="f-status" className="field-select" value={status} onChange={e => filter(setStatus)(e.target.value as ContentStatus | '')}>
                            <option value="">Tümü</option>
                            {(Object.keys(STATUS_LABELS) as ContentStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                        </select>
                    </div>
                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="f-search">Ara</label>
                        <input id="f-search" className="field-select" value={search} onChange={e => filter(setSearch)(e.target.value)} placeholder="Soru metninde ara" />
                    </div>
                    <label className="row-actions">
                        <input type="checkbox" checked={mine} onChange={e => filter(setMine)(e.target.checked)} /> Yalnızca benimkiler
                    </label>
                </div>
            </Card>

            {loading && !result ? (
                <p className="content-muted">Yükleniyor...</p>
            ) : !result || result.data.items.length === 0 ? (
                <Card variant="default" padding="lg"><p className="content-muted">{loading ? 'Yükleniyor...' : 'Bu ölçütlere uyan soru yok.'}</p></Card>
            ) : (
                <Card variant="default" padding="none">
                    <table className="content-table">
                        <thead><tr><th>Soru</th><th>Konu</th><th>Zorluk</th><th>Durum</th><th /></tr></thead>
                        <tbody>
                            {result.data.items.map(q => (
                                <tr key={q.id}>
                                    <td>
                                        <button type="button" className="link-button bank-stem" onClick={() => setViewing(q)}>
                                            {q.stem ? <MathText text={q.stem} /> : '(görselli soru)'}
                                        </button>
                                        {q.outcome && <div className="content-muted">{q.outcome.code}</div>}
                                    </td>
                                    <td>
                                        {q.topicName}
                                        <div className="content-muted">{q.levelName} · {q.subjectName}</div>
                                    </td>
                                    <td>{DIFFICULTY_LABELS[q.difficulty]}</td>
                                    <td>
                                        <span className={`badge badge-${q.status}`}>{STATUS_LABELS[q.status]}</span>
                                        {q.status === 'Rejected' && q.reviewNote && <div className="content-muted">{q.reviewNote}</div>}
                                    </td>
                                    <td>
                                        <div className="row-actions">
                                            {canEdit(q) && <Button size="sm" variant="secondary" onClick={() => setEditing(prev => ({ question: q, session: (prev?.session ?? 0) + 1 }))}>Düzenle</Button>}
                                            {!admin && q.ownerId === user?.id && (q.status === 'Draft' || q.status === 'Rejected') && (
                                                <Button size="sm" variant="primary" onClick={() => void act('Onaya gönderildi', () => assessmentService.submitQuestion(q.id))}>Onaya gönder</Button>
                                            )}
                                            {admin && q.status !== 'Published' && (
                                                <Button size="sm" variant="primary" onClick={() => void act('Yayınlandı', () => assessmentService.publishQuestion(q.id))}>Yayınla</Button>
                                            )}
                                            {admin && q.status === 'Published' && (
                                                <Button size="sm" variant="ghost" onClick={() => void act('Yayından kaldırıldı', () => assessmentService.unpublishQuestion(q.id))}>Kaldır</Button>
                                            )}
                                            {canEdit(q) && (
                                                <Button size="sm" variant="ghost" onClick={() => {
                                                    if (window.confirm('Soru silinsin mi?')) void act('Soru silindi', () => assessmentService.deleteQuestion(q.id));
                                                }}>Sil</Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ padding: 12 }}>
                        <span className="content-muted">{result.data.totalCount} soru</span>
                        {result.data.totalPages > 1 && <Pagination page={page} totalPages={result.data.totalPages} onPageChange={setPage} />}
                    </div>
                </Card>
            )}

            <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing?.question ? 'Soruyu düzenle' : 'Yeni soru'} size="lg">
                {editing && (
                    <QuestionEditor
                        key={editing.session}
                        question={editing.question}
                        onCancel={() => setEditing(null)}
                        onSaved={() => { setEditing(null); refresh(); }} />
                )}
            </Modal>

            <Modal isOpen={viewing !== null} onClose={() => setViewing(null)} title={viewing ? `${viewing.subjectName} · ${viewing.topicName}` : ''} size="lg">
                {viewing && (
                    <div className="modal-form">
                        <QuestionView stem={viewing.stem} stemAssetId={viewing.stemAssetId} options={viewing.options} correctKey={viewing.correctKey} />
                        {viewing.explanation && <p><strong>Çözüm:</strong> {viewing.explanation}</p>}
                        {viewing.solutionVideoTitle && <p className="content-muted">🎬 Çözüm videosu: {viewing.solutionVideoTitle}</p>}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default QuestionBankPage;
