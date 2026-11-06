import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '../../components/ui';
import assessmentService from '../../services/assessment.service';
import { toast } from '../../lib/toast';
import type { QuestionImportResult } from '../../types/assessment';
import '../../components/content/Content.css';

/** Bulk question import into the existing curriculum: preview first, then write. */
export const QuestionImportPage: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<QuestionImportResult | null>(null);
    const [busy, setBusy] = useState(false);

    const run = async (dryRun: boolean) => {
        if (!file) return;
        setBusy(true);
        try {
            const result = await assessmentService.importQuestions(file, dryRun);
            setPreview(result);
            if (!dryRun && result.errors.length === 0) {
                toast.success(`${result.created} soru eklendi, ${result.updated} soru güncellendi`);
                setFile(null);
                setPreview(null);
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'İçe aktarma başarısız');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">📥 Soru aktar</h1>
                    <p className="page-subtitle">Excel veya CSV'den soru bankasına toplu soru</p>
                </div>
                <Link to="/app/sorular"><Button variant="secondary">Soru bankasına dön</Button></Link>
            </div>

            <Card variant="default" padding="md">
                <p className="content-muted">
                    Sütunlar: <strong>Seviye, Ders, Ünite, Konu, Kazanım Kodu, Soru, A, B, C, D, E, Doğru, Zorluk, Açıklama</strong>.
                    Konu ve kazanım müfredatta önceden bulunmalı. Doğru sütununa şık harfi (A–E) yazılır; şıkları boş bırakıp
                    "Doğru" ya da "Yanlış" yazarsanız soru doğru/yanlış olur. Zorluk: Kolay, Orta veya Zor. Formüller $ işaretleri
                    arasına yazılır. Aktarılan sorular hemen yayına girer; aynı dosyayı tekrar yüklemek soruları kopyalamaz,
                    günceller. Görselleri aktarımdan sonra soru bankasından ekleyebilirsiniz.
                </p>
                <div className="row-actions" style={{ margin: '12px 0' }}>
                    <input type="file" accept=".xlsx,.csv" aria-label="Soru dosyası"
                        onChange={e => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
                    <Button size="sm" variant="secondary" disabled={!file} isLoading={busy} onClick={() => void run(true)}>Önizle</Button>
                    <Button size="sm" variant="primary" disabled={!file || !preview || preview.errors.length > 0} isLoading={busy}
                        onClick={() => void run(false)}>İçe aktar</Button>
                </div>

                {preview && (
                    <div>
                        <div className="import-summary">
                            <span className="badge">{preview.rowCount} geçerli satır</span>
                            <span className="badge">{preview.created} yeni soru</span>
                            <span className="badge">{preview.updated} güncellenecek</span>
                            <span className="badge">{preview.unchanged} değişmeyen</span>
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
        </div>
    );
};

export default QuestionImportPage;
