import React, { useId } from 'react';
import './Select.css';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

/**
 * Native select wearing the same chrome as <Input>: label above the control, matching height,
 * border and focus ring. The browser's default arrow is replaced with a chevron drawn in CSS so the
 * control looks the same across platforms.
 */
export const Select: React.FC<SelectProps> = ({
    label,
    error,
    helperText,
    className = '',
    id,
    children,
    ...props
}) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const hasError = Boolean(error);

    return (
        <div className={`select-wrapper ${className}`}>
            {label && (
                <label htmlFor={selectId} className="select-label">
                    {label}
                </label>
            )}
            <div className={`select-container ${hasError ? 'select-error' : ''}`}>
                <select id={selectId} className="select-field" {...props}>
                    {children}
                </select>
            </div>
            {(error || helperText) && (
                <span className={`select-helper ${hasError ? 'select-helper-error' : ''}`}>
                    {error || helperText}
                </span>
            )}
        </div>
    );
};

export default Select;
