import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, Input, Modal } from '../../components/ui';
import { TopicPicker } from '../../components/content/TopicPicker';
import { ContentViewer } from '../../components/content/ContentViewer';
import contentService from '../../services/content.service';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../lib/toast';
import type { ContentAccessTier, ContentItem, ContentItemSummary, ContentItemType } from '../../types/content';
import {
    CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS, PROCESSING_LABELS, STATUS_LABELS, acceptFor, formatDuration,
} from '../../utils/content';
import { isAdmin } from '../../utils/roles';
import '../../components/content/Content.css';

const TYPES: ContentItemType[] = ['Video', 'SolvedQuestionVideo', 'Pdf', 'Worksheet', 'EBook', 'Embed'];

const emptyForm = {
    topicId: '',
    type: 'Video' as ContentItemType,
    title: '',
    description: '',
    accessTier: 'Free' as ContentAccessTier,
    embedUrl: '',
};

/**
 * A teacher's (or the platform's) own content: create, upload, preview, send for review. Teachers'
 * content goes live only after an administrator approves it; administrators publish directly.
 */
export const MyContentPage: React.FC = () => {
    const { user } = useAuthStore();
    const admin = isAdmin(user);
    const [items, setItems] = useState<ContentItemSummary[] | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [file, setFile] = useState<File | null>(null);
    const [uploadPercent, setUploadPercent] = useState<number | null>(null);
    const [formError, setFormError] = useState('');
    const [busy, setBusy] = useState(false);
    const [detail, setDetail] = useState<ContentItem | null>(null);
    const uploadTarget = useRef<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        try {
            setItems((await contentService.getMine(1, 100)).items);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'İçerikler yüklenemedi');
            setItems([]);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    // Videos convert in the background; refresh while any is still in the queue.
    const converting = items?.some(i => i.processingStatus === 'Queued' || i.processingStatus === 'Processing');
    useEffect(() => {
        if (!converting) return;
        const timer = window.setInterval(() => void load(), 10_000);
        return () => window.clearInterval(timer);
    }, [converting, load]);

    const closeCreate = () => {
        setShowCreate(false);
        setForm(emptyForm);
        setFile(null);
        setFormError('');
        setUploadPercent(null);
    };

    const uploadFile = async (id: string, f: File) => {
        setUploadPercent(0);
        try {
            await contentService.upload(id, f, setUploadPercent);
        } finally {
            setUploadPercent(null);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        if (!form.topicId) return setFormError('Lütfen bir konu seçin');
        if (form.type === 'Embed' && !/^https:\/\//i.test(form.embedUrl.trim())) {
            return setFormError('Etkileşimli içerik için https:// ile başlayan bir bağlantı girin');
        }
        if (form.type !== 'Embed' && !file) return setFormError('Lütfen bir dosya seçin');

        setBusy(true);
        try {
            const created = await contentService.createItem({
                topicId: form.topicId,
                type: form.type,
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                accessTier: form.accessTier,
                embedUrl: form.type === 'Embed' ? form.embedUrl.trim() : undefined,
            });
            if (file && form.type !== 'Embed') {
                await uploadFile(created.id, file);
            }
            toast.success(admin ? 'İçerik oluşturuldu' : 'İçerik taslak olarak kaydedildi; onaya gönderebilirsiniz');
            closeCreate();
            await load();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'İçerik oluşturulamadı');
        } finally {
            setBusy(false);
        }
    };

    const act = async (label: string, run: () => Promise<unknown>, refreshDetail = true) => {
        try {
            await run();
            toast.success(label);
            await load();
            if (detail && refreshDetail) setDetail(await contentService.getItem(detail.id));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'İşlem başarısız');
        }
    };

    const pickReplacement = (id: string) => {
        uploadTarget.current = id;
        fileInput.current?.click();
    };

    const onReplacementChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        const id = uploadTarget.current;
        if (!f || !id) return;
        await act('Dosya yüklendi', () => uploadFile(id, f));
    };

    const canSubmit = (i: { status: string; processingStatus: string; type: ContentItemType }) =>
        !admin && (i.status === 'Draft' || i.status === 'Rejected') && (i.type === 'Embed' || i.processingStatus === 'Ready');

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">🎬 İçeriklerim</h1>
                    <p className="page-subtitle">
                        {admin ? 'Platform içerikleri doğrudan yayınlanır.' : 'İçerikleriniz yönetici onayından sonra öğrencilere açılır.'}
                    </p>
                </div>
                <Button variant="primary" onClick={() => setShowCreate(true)}>+ Yeni içerik</Button>
            </div>

            <input ref={fileInput} type="file" hidden onChange={e => void onReplacementChosen(e)} />

            {items === null ? (
                <p className="content-muted">Yükleniyor...</p>
            ) : items.length === 0 ? (
                <Card variant="default" padding="lg"><p className="content-muted">Henüz içerik yok. "Yeni içerik" ile başlayın.</p></Card>
            ) : (
                <Card variant="default" padding="none">
                    <table className="content-table">
                        <thead>
                            <tr><th>İçerik</th><th>Durum</th><th>Dosya</th><th>Süre</th><th /></tr>
                        </thead>
                        <tbody>
                            {items.map(i => (
                                <tr key={i.id}>
                                    <td>
                                        <span aria-hidden="true">{CONTENT_TYPE_ICONS[i.type]}</span>{' '}
                                        <strong>{i.title}</strong>
                                        <div className="content-muted">{CONTENT_TYPE_LABELS[i.type]}{i.accessTier === 'Premium' ? ' · Premium' : ''}</div>
                                    </td>
                                    <td><span className={`badge badge-${i.status}`}>{STATUS_LABELS[i.status]}</span></td>
                                    <td>{i.type === 'Embed' ? '—' : <span className={`badge badge-${i.processingStatus}`}>{PROCESSING_LABELS[i.processingStatus]}</span>}</td>
                                    <td>{formatDuration(i.durationSeconds) || '—'}</td>
                                    <td>
                                        <div className="row-actions">
                                            <Button size="sm" variant="ghost" onClick={() => void contentService.getItem(i.id).then(setDetail)}>Aç</Button>
                                            {canSubmit(i) && (
                                                <Button size="sm" variant="secondary" onClick={() => void act('Onaya gönderildi', () => contentService.submit(i.id))}>Onaya gönder</Button>
                                            )}
                                            {admin && i.status !== 'Published' && (i.type === 'Embed' || i.processingStatus === 'Ready') && (
                                                <Button size="sm" variant="secondary" onClick={() => void act('Yayınlandı', () => contentService.publish(i.id))}>Yayınla</Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            <Modal isOpen={showCreate} onClose={closeCreate} title="Yeni içerik" size="lg">
                <form className="modal-form" onSubmit={e => void handleCreate(e)}>
                    {formError && <p className="form-error" role="alert">{formError}</p>}
                    <TopicPicker value={form.topicId} onChange={topicId => setForm(f => ({ ...f, topicId }))} />
                    <div className="form-grid">
                        <div className="input-wrapper">
                            <label className="input-label" htmlFor="content-type">Tür</label>
                            <select id="content-type" className="field-select" value={form.type}
                                onChange={e => { setForm(f => ({ ...f, type: e.target.value as ContentItemType })); setFile(null); }}>
                                {TYPES.map(t => <option key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</option>)}
                            </select>
                        </div>
                        <div className="input-wrapper">
                            <label className="input-label" htmlFor="content-tier">Erişim</label>
                            <select id="content-tier" className="field-select" value={form.accessTier}
                                onChange={e => setForm(f => ({ ...f, accessTier: e.target.value as ContentAccessTier }))}>
                                <option value="Free">Ücretsiz</option>
                                <option value="Premium">Premium (paket sahiplerine)</option>
                            </select>
                        </div>
                    </div>
                    <Input label="Başlık" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required maxLength={200} />
                    <div className="input-wrapper">
                        <label className="input-label" htmlFor="content-desc">Açıklama</label>
                        <textarea id="content-desc" className="field-textarea" value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    {form.type === 'Embed' ? (
                        <Input label="Bağlantı" type="url" placeholder="https://..." value={form.embedUrl}
                            onChange={e => setForm(f => ({ ...f, embedUrl: e.target.value }))}
                            helperText="Etkileşimli etkinlik, simülasyon ya da video bağlantısı" />
                    ) : (
                        <div className="input-wrapper">
                            <label className="input-label" htmlFor="content-file">Dosya</label>
                            <input id="content-file" type="file" accept={acceptFor(form.type)} onChange={e => setFile(e.target.files?.[0] ?? null)} />
                            <span className="content-muted">
                                {form.type === 'Video' || form.type === 'SolvedQuestionVideo'
                                    ? 'MP4, WebM veya MOV. Yüklemeden sonra video otomatik olarak dönüştürülür.'
                                    : 'PDF dosyası.'}
                            </span>
                        </div>
                    )}
                    {uploadPercent !== null && (
                        <div className="upload-progress" aria-live="polite">
                            <span className="content-muted">Yükleniyor… %{uploadPercent}</span>
                            <span className="progress-bar"><span style={{ width: `${uploadPercent}%` }} /></span>
                        </div>
                    )}
                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={closeCreate} disabled={busy}>Vazgeç</Button>
                        <Button type="submit" variant="primary" isLoading={busy}>Kaydet</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={detail !== null} onClose={() => setDetail(null)} title={detail?.title ?? ''} size="lg">
                {detail && (
                    <div className="modal-form">
                        <div className="row-actions">
                            <span className={`badge badge-${detail.status}`}>{STATUS_LABELS[detail.status]}</span>
                            {detail.type !== 'Embed' && <span className={`badge badge-${detail.processingStatus}`}>{PROCESSING_LABELS[detail.processingStatus]}</span>}
                            <span className="content-muted">{detail.topicName}</span>
                        </div>
                        {detail.status === 'Rejected' && detail.reviewNote && (
                            <p className="form-error">Red gerekçesi: {detail.reviewNote}</p>
                        )}
                        {detail.processingStatus === 'Failed' && (
                            <p className="form-error">Dönüştürme hatası: {detail.processingError ?? 'bilinmiyor'}</p>
                        )}
                        <ContentViewer item={detail} trackProgress={false} />
                        <div className="modal-actions">
                            {detail.type !== 'Embed' && (detail.status === 'Draft' || detail.status === 'Rejected' || admin) && (
                                <Button variant="ghost" onClick={() => pickReplacement(detail.id)}>
                                    {detail.processingStatus === 'None' ? 'Dosya yükle' : 'Dosyayı değiştir'}
                                </Button>
                            )}
                            {detail.processingStatus === 'Failed' && (
                                <Button variant="secondary" onClick={() => void act('Yeniden sıraya alındı', () => contentService.retryProcessing(detail.id))}>Tekrar dene</Button>
                            )}
                            {canSubmit(detail) && (
                                <Button variant="primary" onClick={() => void act('Onaya gönderildi', () => contentService.submit(detail.id))}>Onaya gönder</Button>
                            )}
                            {admin && detail.status === 'Published' && (
                                <Button variant="secondary" onClick={() => void act('Yayından kaldırıldı', () => contentService.unpublish(detail.id))}>Yayından kaldır</Button>
                            )}
                            {(detail.status !== 'Published' || admin) && (
                                <Button variant="danger" onClick={() => {
                                    if (!window.confirm('İçerik silinsin mi?')) return;
                                    void act('İçerik silindi', () => contentService.deleteItem(detail.id), false).then(() => setDetail(null));
                                }}>Sil</Button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default MyContentPage;
