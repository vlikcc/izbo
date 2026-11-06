import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TestPlayer } from '../../components/test/TestPlayer';
import assessmentService from '../../services/assessment.service';
import { homeworkService } from '../../services/homework.service';
import { toast } from '../../lib/toast';
import { homeworkResultText } from '../../utils/questions';
import type { Attempt, AttemptSummary } from '../../types/assessment';
import '../../components/content/Content.css';

/** /app/test/:attemptId — the running test; a finished one goes straight to its results. */
export const AttemptPage: React.FC = () => {
    const { attemptId = '' } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const homeworkId = searchParams.get('odev');
    const [loaded, setLoaded] = useState<Attempt | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        assessmentService.getAttempt(attemptId)
            .then(setLoaded)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Test yüklenemedi'));
    }, [attemptId]);

    const finished = useCallback(async (summary: AttemptSummary) => {
        // A test given as homework hands its result in as the submission.
        if (homeworkId) {
            try {
                await homeworkService.submitHomework(homeworkId, { content: homeworkResultText(summary) });
                toast.success('Sonucun ödev olarak teslim edildi');
            } catch (e) {
                toast.error(e instanceof Error ? `Ödev teslim edilemedi: ${e.message}` : 'Ödev teslim edilemedi');
            }
        }
        navigate(`/app/test/${attemptId}/sonuc`, { replace: true });
    }, [navigate, attemptId, homeworkId]);

    const attempt = loaded?.summary.id === attemptId ? loaded : null;

    if (error) return <div className="page"><p className="form-error" role="alert">{error}</p></div>;
    if (!attempt) return <div className="page"><p className="content-muted">Yükleniyor...</p></div>;
    if (attempt.summary.status !== 'InProgress') return <Navigate to={`/app/test/${attemptId}/sonuc`} replace />;

    return (
        <div className="page animate-fadeIn">
            <TestPlayer key={attempt.summary.id} attempt={attempt} onFinished={summary => void finished(summary)} />
        </div>
    );
};

export default AttemptPage;
