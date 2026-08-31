import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card } from '../../components/ui';
import { examService } from '../../services/exam.service';
import { toast } from '../../lib/toast';
import type { ExamResult } from '../../types/examSession';
import './Exams.css';

export const ExamResultPage: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const [result, setResult] = useState<ExamResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!sessionId) return;
        let cancelled = false;
        const load = async () => {
            try {
                const data = await examService.getResult(sessionId);
                if (!cancelled) setResult(data);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Sonuç yüklenemedi');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [sessionId]);

    if (loading) {
        return (
            <div className="page">
                <div className="exams-loading">
                    <div className="exams-loading-spinner" />
                    <span>Sonuçlar yükleniyor...</span>
                </div>
            </div>
        );
    }

    if (!result) {
        return (
            <div className="page">
                <Card variant="default" padding="lg">
                    <p>Sonuç henüz hazır değil veya bu oturumu görme yetkiniz yok.</p>
                    <Link to="/app/exams"><Button variant="primary">Sınavlara dön</Button></Link>
                </Card>
            </div>
        );
    }

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">{result.examTitle}</h1>
                    <p className="page-subtitle">Sınav sonucu</p>
                </div>
            </div>

            <Card variant="default" padding="lg">
                <p>
                    Puan: <strong>{result.totalScore} / {result.maxScore}</strong>
                    {' '}({result.percentage.toFixed(0)}%)
                </p>
                <p>{result.isPassed ? 'Geçti' : 'Kaldi'}</p>
                <p>Teslim: {new Date(result.submittedAt).toLocaleString('tr-TR')}</p>
            </Card>

            {result.questionResults?.map((item) => (
                <Card key={item.questionId} variant="default" padding="md" className="exam-card">
                    <h3>{item.content}</h3>
                    <p>Cevabınız: {item.yourAnswer || '—'}</p>
                    {item.correctAnswer && <p>Doğru cevap: {item.correctAnswer}</p>}
                    <p>{item.isCorrect ? 'Doğru' : 'Yanlış'} · {item.pointsAwarded}/{item.maxPoints} puan</p>
                    {item.explanation && <p>{item.explanation}</p>}
                </Card>
            ))}

            <Link to="/app/exams">
                <Button variant="outline">Sınav listesine dön</Button>
            </Link>
        </div>
    );
};

export default ExamResultPage;
