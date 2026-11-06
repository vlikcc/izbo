import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Input } from '../../components/ui';
import { homeworkService } from '../../services/homework.service';
import { fileService } from '../../services/file.service';
import { toast } from '../../lib/toast';
import type { Homework, Submission } from '../../types';
import { StartPracticeButton } from '../../components/test/StartPracticeButton';
import contentService from '../../services/content.service';
import './Homework.css';

export const HomeworkSubmitPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [homework, setHomework] = useState<Homework | null>(null);
    const [existing, setExisting] = useState<Submission | null>(null);
    const [content, setContent] = useState('');
    const [fileUrl, setFileUrl] = useState<string | undefined>();
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        const load = async () => {
            try {
                const [item, submission] = await Promise.all([
                    homeworkService.getHomework(id),
                    homeworkService.getMySubmission(id),
                ]);
                if (cancelled) return;
                setHomework(item);
                setExisting(submission);
                setContent(submission?.content ?? '');
                setFileUrl(submission?.fileUrl);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Ödev yüklenemedi');
                navigate('/app/homework');
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [id, navigate]);

    const openLinkedItem = async (itemId: string) => {
        try {
            const item = await contentService.getItem(itemId);
            navigate(`/app/konu/${item.topicId}?item=${item.id}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'İçerik açılamadı');
        }
    };

    const handleFile = async (file: File | undefined) => {
        if (!file || !id) return;
        setIsUploading(true);
        try {
            const uploaded = await fileService.upload(file, 'Homework', id);
            setFileUrl(`/api/files/${uploaded.id}`);
            toast.success('Dosya yüklendi');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Dosya yüklenemedi');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!id) return;
        setIsSaving(true);
        try {
            await homeworkService.submitHomework(id, { content, fileUrl });
            toast.success('Ödev teslim edildi');
            navigate('/app/homework');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Teslim edilemedi');
        } finally {
            setIsSaving(false);
        }
    };

    if (!homework) {
        return (
            <div className="page">
                <div className="homework-loading">
                    <div className="homework-loading-spinner" />
                    <span>Ödev yükleniyor...</span>
                </div>
            </div>
        );
    }

    const graded = existing?.status === 'Graded';

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">{homework.title}</h1>
                    <p className="page-subtitle">{homework.classroomName}</p>
                </div>
            </div>

            <Card variant="default" padding="lg">
                <p>{homework.description}</p>
                <p>Son teslim: {new Date(homework.dueDate).toLocaleString('tr-TR')}</p>
                {homework.linkKind === 'TopicTest' && homework.linkTargetId && !graded && (
                    <div className="homework-link">
                        <span>📝 Bu ödev bir konu testi: <strong>{homework.linkTitle}</strong>. Testi bitirince sonucun otomatik teslim edilir.</span>
                        <StartPracticeButton target={{ topicId: homework.linkTargetId }} homeworkId={homework.id}>Testi çöz</StartPracticeButton>
                    </div>
                )}
                {homework.linkKind === 'ContentItem' && homework.linkTargetId && (
                    <div className="homework-link">
                        <span>🎬 Çalışılacak içerik: <strong>{homework.linkTitle}</strong></span>
                        <Button variant="secondary" onClick={() => void openLinkedItem(homework.linkTargetId!)}>İçeriği aç</Button>
                    </div>
                )}
                {graded ? (
                    <div>
                        <p>Bu ödev notlandırıldı; yeniden teslim edilemez.</p>
                        <p>Puan: {existing?.score} / {homework.maxScore}</p>
                        {existing?.feedback && <p>Geri bildirim: {existing.feedback}</p>}
                    </div>
                ) : (
                    <form onSubmit={(event) => void handleSubmit(event)}>
                        <label htmlFor="homework-content">Cevap metni</label>
                        <textarea
                            id="homework-content"
                            className="input"
                            rows={8}
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                            style={{ width: '100%', marginBottom: 16 }}
                        />
                        <Input
                            label="Dosya ekle"
                            type="file"
                            onChange={(event) => void handleFile(event.target.files?.[0])}
                        />
                        {isUploading && <p>Dosya yükleniyor...</p>}
                        {fileUrl && <p>Ekli dosya hazır.</p>}
                        <Button type="submit" variant="primary" isLoading={isSaving}>
                            Teslim Et
                        </Button>
                    </form>
                )}
            </Card>
        </div>
    );
};

export default HomeworkSubmitPage;
