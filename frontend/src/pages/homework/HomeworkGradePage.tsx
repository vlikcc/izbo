import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, Input } from '../../components/ui';
import { homeworkService } from '../../services/homework.service';
import { toast } from '../../lib/toast';
import type { Homework, Submission } from '../../types';
import './Homework.css';

export const HomeworkGradePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [homework, setHomework] = useState<Homework | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [scores, setScores] = useState<Record<string, string>>({});
    const [feedback, setFeedback] = useState<Record<string, string>>({});
    const [savingId, setSavingId] = useState<string | null>(null);

    const reload = async (homeworkId: string) => {
        const [item, list] = await Promise.all([
            homeworkService.getHomework(homeworkId),
            homeworkService.getSubmissions(homeworkId),
        ]);
        setHomework(item);
        setSubmissions(list);
        setScores(Object.fromEntries(list.map((row) => [row.id, row.score?.toString() ?? ''])));
        setFeedback(Object.fromEntries(list.map((row) => [row.id, row.feedback ?? ''])));
    };

    useEffect(() => {
        if (!id) return;
        void reload(id).catch((error: unknown) => {
            toast.error(error instanceof Error ? error.message : 'Teslimler yüklenemedi');
        });
    }, [id]);

    const grade = async (submission: Submission) => {
        const score = Number(scores[submission.id]);
        if (Number.isNaN(score)) {
            toast.error('Geçerli bir puan girin');
            return;
        }
        setSavingId(submission.id);
        try {
            await homeworkService.gradeSubmission(submission.id, score, feedback[submission.id]);
            toast.success('Not kaydedildi');
            if (id) await reload(id);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Notlandırılamadı');
        } finally {
            setSavingId(null);
        }
    };

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">{homework?.title ?? 'Teslimler'}</h1>
                    <p className="page-subtitle">{homework?.classroomName}</p>
                </div>
            </div>

            {submissions.length === 0 ? (
                <Card variant="default" padding="lg">
                    <p>Henüz teslim yok.</p>
                </Card>
            ) : submissions.map((submission) => (
                <Card key={submission.id} variant="default" padding="md" className="homework-card">
                    <h3>{submission.studentName || submission.studentId}</h3>
                    <p>{submission.content || 'Metin yok'}</p>
                    {submission.fileUrl && (
                        <p><a href={submission.fileUrl} target="_blank" rel="noreferrer">Ek dosya</a></p>
                    )}
                    <Input
                        label="Puan"
                        type="number"
                        value={scores[submission.id] ?? ''}
                        onChange={(event) => setScores((prev) => ({ ...prev, [submission.id]: event.target.value }))}
                    />
                    <Input
                        label="Geri bildirim"
                        value={feedback[submission.id] ?? ''}
                        onChange={(event) => setFeedback((prev) => ({ ...prev, [submission.id]: event.target.value }))}
                    />
                    <Button
                        variant="primary"
                        size="sm"
                        isLoading={savingId === submission.id}
                        onClick={() => void grade(submission)}
                    >
                        Kaydet
                    </Button>
                </Card>
            ))}
        </div>
    );
};

export default HomeworkGradePage;
