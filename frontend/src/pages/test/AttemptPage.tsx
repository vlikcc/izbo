import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { TestPlayer } from '../../components/test/TestPlayer';
import assessmentService from '../../services/assessment.service';
import type { Attempt } from '../../types/assessment';
import '../../components/content/Content.css';

/** /app/test/:attemptId — the running test; a finished one goes straight to its results. */
export const AttemptPage: React.FC = () => {
    const { attemptId = '' } = useParams();
    const navigate = useNavigate();
    const [loaded, setLoaded] = useState<Attempt | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        assessmentService.getAttempt(attemptId)
            .then(setLoaded)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Test yüklenemedi'));
    }, [attemptId]);

    const finished = useCallback(() => navigate(`/app/test/${attemptId}/sonuc`, { replace: true }), [navigate, attemptId]);

    const attempt = loaded?.summary.id === attemptId ? loaded : null;

    if (error) return <div className="page"><p className="form-error" role="alert">{error}</p></div>;
    if (!attempt) return <div className="page"><p className="content-muted">Yükleniyor...</p></div>;
    if (attempt.summary.status !== 'InProgress') return <Navigate to={`/app/test/${attemptId}/sonuc`} replace />;

    return (
        <div className="page animate-fadeIn">
            <TestPlayer key={attempt.summary.id} attempt={attempt} onFinished={finished} />
        </div>
    );
};

export default AttemptPage;
