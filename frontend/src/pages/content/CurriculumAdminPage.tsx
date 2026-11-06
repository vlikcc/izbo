import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card } from '../../components/ui';
import contentService from '../../services/content.service';
import { toast } from '../../lib/toast';
import type { CurriculumImportResult, Level, Subject, SubjectTree } from '../../types/content';
import { sortLevels } from '../../utils/content';
import '../../components/content/Content.css';

/** A one-line "add" form used at every level of the tree. */
const AddInline: React.FC<{ placeholder: string; onAdd: (name: string) => Promise<void> }> = ({ placeholder, onAdd }) => {
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    return (
        <form
            className="inline-form"
            onSubmit={e => {
                e.preventDefault();
                if (!name.trim()) return;
                setBusy(true);
                onAdd(name.trim()).then(() => setName('')).finally(() => setBusy(false));
            }}
        >
            <input value={name} onChange={e => setName(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
            <Button type="submit" size="sm" variant="secondary" isLoading={busy}>Ekle</Button>
        </form>
    );
};

/**
 * Curriculum administration: import a ministry curriculum spreadsheet (dry run first), or edit the
 * level → subject → unit → topic tree by hand.
 */
export const CurriculumAdminPage: React.FC = () => {
    const [levels, setLevels] = useState<Level[]>([]);
    const [levelSlug, setLevelSlug] = useState('');
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [subjectId, setSubjectId] = useState('');
    const [tree, setTree] = useState<SubjectTree | null>(null);

    const [importFile, setImportFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<CurriculumImportResult | null>(null);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        contentService.getLevels().then(l => {
            const sorted = sortLevels(l);
            setLevels(sorted);
            setLevelSlug(prev => prev || sorted[0]?.slug || '');
        }).catch(() => setLevels([]));
    }, []);

    const loadSubjects = useCallback(async () => {
        if (!levelSlug) return;
        const list = await contentService.getSubjects(levelSlug);
        setSubjects(list);
        setSubjectId(prev => (list.some(s => s.id === prev) ? prev : list[0]?.id ?? ''));
    }, [levelSlug]);

    const loadTree = useCallback(async () => {
        setTree(subjectId ? await contentService.getSubjectTree(subjectId) : null);
    }, [subjectId]);

    useEffect(() => { void loadSubjects().catch(() => setSubjects([])); }, [loadSubjects]);
    useEffect(() => { void loadTree().catch(() => setTree(null)); }, [loadTree]);

    const run = async (label: string, action: () => Promise<unknown>) => {
        try {
            await action();
            toast.success(label);
            await loadSubjects();
            await loadTree();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
        }
    };

    const remove = (kind: 'subjects' | 'units' | 'topics', id: string, name: string) => {
        if (!window.confirm(`"${name}" ve altındaki her şey silinsin mi?`)) return;
        void run('Silindi', () => contentService.deleteCurriculumNode(kind, id));
    };

    const doImport = async (dryRun: boolean) => {
        if (!importFile) return;
        setImporting(true);
        try {
            const result = await contentService.importCurriculum(importFile, dryRun);
            setPreview(result);
            if (!dryRun && result.errors.length === 0) {
                toast.success('Müfredat içe aktarıldı');
                setImportFile(null);
                setPreview(null);
                await loadSubjects();
                await loadTree();
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'İçe aktarma başarısız');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">🗂️ Müfredat</h1>
                    <p className="page-subtitle">Seviye → ders → ünite → konu → kazanım</p>
                </div>
            </div>

            <Card variant="default" padding="md" className="section-gap">
                <h3 className="unit-title">Excel / CSV'den içe aktar</h3>
                <p className="content-muted">
                    Sütunlar: <strong>Seviye, Ders, Ünite, Konu, Kazanım Kodu, Açıklama</strong>. Seviye, sistemdeki
                    adı ya da kısa adıyla yazılır (ör. "5. Sınıf" veya "5-sinif"). Aynı dosyayı tekrar yüklemek bir şey değiştirmez.
                </p>
                <div className="row-actions" style={{ margin: '12px 0' }}>
                    <input type="file" accept=".xlsx,.csv" aria-label="Müfredat dosyası"
                        onChange={e => { setImportFile(e.target.files?.[0] ?? null); setPreview(null); }} />
                    <Button size="sm" variant="secondary" disabled={!importFile} isLoading={importing} onClick={() => void doImport(true)}>Önizle</Button>
                    <Button size="sm" variant="primary" disabled={!importFile || !preview || preview.errors.length > 0} isLoading={importing}
                        onClick={() => void doImport(false)}>İçe aktar</Button>
                </div>
                {preview && (
                    <div>
                        <div className="import-summary">
                            <span className="badge">{preview.rowCount} satır</span>
                            <span className="badge">{preview.subjectsCreated} yeni ders</span>
                            <span className="badge">{preview.unitsCreated} yeni ünite</span>
                            <span className="badge">{preview.topicsCreated} yeni konu</span>
                            <span className="badge">{preview.outcomesCreated} yeni kazanım</span>
                            <span className="badge">{preview.outcomesUpdated} güncellenen kazanım</span>
                        </div>
                        {preview.errors.length > 0 && (
                            <>
                                <p className="form-error" style={{ marginTop: 12 }}>Dosyada hatalı satırlar var; hiçbiri içe aktarılmadı.</p>
                                <ul className="import-errors">
                                    {preview.errors.map(e => <li key={`${e.row}-${e.message}`}>Satır {e.row}: {e.message}</li>)}
                                </ul>
                            </>
                        )}
                    </div>
                )}
            </Card>

            <Card variant="default" padding="md">
                <div className="form-grid section-gap">
                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="adm-level">Seviye</label>
                        <select id="adm-level" className="field-select" value={levelSlug} onChange={e => setLevelSlug(e.target.value)}>
                            {levels.map(l => <option key={l.slug} value={l.slug}>{l.name}</option>)}
                        </select>
                    </div>
                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="adm-subject">Ders</label>
                        <select id="adm-subject" className="field-select" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="tree-admin">
                    <AddInline placeholder="Yeni ders adı" onAdd={name => run('Ders eklendi', () => {
                        const level = levels.find(l => l.slug === levelSlug);
                        return level ? contentService.createSubject(level.id, name) : Promise.reject(new Error('Seviye seçin'));
                    })} />

                    {tree && (
                        <>
                            <div className="tree-node">
                                <strong style={{ color: tree.subject.color }}>{tree.subject.name}</strong>
                                <Button size="sm" variant="ghost" onClick={() => remove('subjects', tree.subject.id, tree.subject.name)}>Dersi sil</Button>
                            </div>
                            <div className="tree-children">
                                {tree.units.map(u => (
                                    <div key={u.id} className="tree-admin">
                                        <div className="tree-node">
                                            <span>{u.order}. {u.name}</span>
                                            <Button size="sm" variant="ghost" onClick={() => remove('units', u.id, u.name)}>Sil</Button>
                                        </div>
                                        <div className="tree-children">
                                            {u.topics.map(t => (
                                                <div key={t.id} className="tree-node">
                                                    <span>{t.name} <span className="content-muted">· {t.itemCount} içerik</span></span>
                                                    <Button size="sm" variant="ghost" onClick={() => remove('topics', t.id, t.name)}>Sil</Button>
                                                </div>
                                            ))}
                                            <AddInline placeholder="Yeni konu" onAdd={name => run('Konu eklendi', () => contentService.createTopic(u.id, name))} />
                                        </div>
                                    </div>
                                ))}
                                <AddInline placeholder="Yeni ünite" onAdd={name => run('Ünite eklendi', () => contentService.createUnit(tree.subject.id, name))} />
                            </div>
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default CurriculumAdminPage;
