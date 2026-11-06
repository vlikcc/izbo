import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui';
import assessmentService from '../../services/assessment.service';
import { toast } from '../../lib/toast';

interface StartPracticeButtonProps {
    target: { topicId: string } | { unitId: string };
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    /** When the test is homework, its result is handed in as the submission once finished. */
    homeworkId?: string;
}

/** Starts (or resumes) a generated topic or unit test from the bank and opens it. */
export const StartPracticeButton: React.FC<StartPracticeButtonProps> = ({ target, children, variant = 'primary', size = 'md', homeworkId }) => {
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);

    const start = async () => {
        setBusy(true);
        try {
            const attempt = await assessmentService.startPractice(target);
            navigate(`/app/test/${attempt.summary.id}${homeworkId ? `?odev=${encodeURIComponent(homeworkId)}` : ''}`);
        } catch (e) {
            const status = (e as { response?: { status?: number } }).response?.status;
            setBusy(false);
            // 402: the package modal is already open.
            if (status === 402) return;
            toast.error(status === 400 ? 'Bu konu için henüz soru eklenmedi.' : e instanceof Error ? e.message : 'Test başlatılamadı');
            setBusy(false);
        }
    };

    return <Button variant={variant} size={size} isLoading={busy} onClick={() => void start()}>{children}</Button>;
};

export default StartPracticeButton;
