import React from 'react';
import './UsageBar.css';

export interface UsageBarProps {
    label: string;
    used: number;
    limit: number; // -1 = unlimited
    unit?: string;
}

export const UsageBar: React.FC<UsageBarProps> = ({ label, used, limit, unit = '' }) => {
    const isUnlimited = limit < 0;
    const percent = isUnlimited ? 0 : Math.min(100, limit === 0 ? 100 : (used / limit) * 100);
    const isNearLimit = !isUnlimited && percent >= 80;
    const isAtLimit = !isUnlimited && percent >= 100;

    return (
        <div className="usage-bar">
            <div className="usage-bar-header">
                <span className="usage-bar-label">{label}</span>
                <span className="usage-bar-value">
                    {used}
                    {unit} / {isUnlimited ? 'Sınırsız' : `${limit}${unit}`}
                </span>
            </div>
            {!isUnlimited && (
                <div className="usage-bar-track">
                    <div
                        className={`usage-bar-fill ${isAtLimit ? 'at-limit' : isNearLimit ? 'near-limit' : ''}`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            )}
        </div>
    );
};

export default UsageBar;
