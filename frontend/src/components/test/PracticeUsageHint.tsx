import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import learnerService from '../../services/learner.service';
import type { PracticeUsage } from '../../types/learner';

/** "Bugün 2/3 ücretsiz test" beside a start button; nothing when the package is unlimited or the call fails. */
export const PracticeUsageHint: React.FC = () => {
    const [usage, setUsage] = useState<PracticeUsage | null>(null);

    useEffect(() => {
        let cancelled = false;
        learnerService.getPracticeUsage()
            .then(u => { if (!cancelled) setUsage(u); })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, []);

    if (!usage || usage.dailyLimit < 0) return null;

    const left = Math.max(0, usage.dailyLimit - usage.usedToday);
    return (
        <span className="practice-usage">
            {left > 0
                ? `Bugün ${left}/${usage.dailyLimit} test hakkın kaldı`
                : <>Bugünkü test hakkın bitti · <Link to="/app/paketler">sınırsız test</Link></>}
        </span>
    );
};

export default PracticeUsageHint;
