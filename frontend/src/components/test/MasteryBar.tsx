import React from 'react';
import './Test.css';

/** A success bar coloured by level: red below half, amber below three quarters, green above. */
export const MasteryBar: React.FC<{ percent: number; label?: string }> = ({ percent, label }) => {
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    const tone = value < 50 ? 'low' : value < 75 ? 'mid' : 'high';
    return (
        <div className="mastery-bar-row">
            <span className={`mastery-bar mastery-${tone}`} role="img" aria-label={`%${value} başarı`}>
                <span style={{ width: `${value}%` }} />
            </span>
            <span className="mastery-value">%{value}{label ? ` · ${label}` : ''}</span>
        </div>
    );
};

export default MasteryBar;
