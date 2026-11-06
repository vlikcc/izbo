import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import learnerService from '../../services/learner.service';
import type { LearnerAccess } from '../../types/learner';
import { daysLeft, formatDay, tierName } from '../../utils/learner';
import '../packages/Packages.css';

/** A child's package on the parent dashboard, with a warning in its last week. */
export const ChildPackageStatus: React.FC<{ childId: string }> = ({ childId }) => {
    const [access, setAccess] = useState<LearnerAccess | null>(null);

    useEffect(() => {
        let cancelled = false;
        learnerService.getAccess(childId)
            .then(a => { if (!cancelled) setAccess(a); })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [childId]);

    if (!access) return null;

    const left = daysLeft(access);
    const expiring = left !== null && left <= 7;

    if (access.tier === 0) {
        return (
            <div className="child-package">
                <span>Paket yok · ücretsiz içerikler açık</span>
                <Link to="/app/paketler">{access.trialAvailable ? '7 gün ücretsiz dene →' : 'Paket al →'}</Link>
            </div>
        );
    }

    return (
        <div className={`child-package${expiring ? ' expiring' : ''}`}>
            <span>
                ⭐ {access.packageName ?? tierName(access.tier)}
                {access.endsAt ? ` · bitiş: ${formatDay(access.endsAt)}` : ''}
                {expiring ? ` · ${left} gün kaldı` : ''}
            </span>
            {expiring && <Link to="/app/paketler">Süreyi uzat →</Link>}
        </div>
    );
};

export default ChildPackageStatus;
