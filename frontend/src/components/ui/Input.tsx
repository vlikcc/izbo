import React from 'react';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    className = '',
    id,
    ...props
}) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = Boolean(error);

    return (
        <div className={`input-wrapper ${className}`}>
            {label && (
                <label htmlFor={inputId} className="input-label">
                    {label}
                </label>
            )}
            <div className={`input-container ${hasError ? 'input-error' : ''}`}>
                {leftIcon && <span className="input-icon input-icon-left">{leftIcon}</span>}
                <input
                    id={inputId}
                    className={`input-field ${leftIcon ? 'has-left-icon' : ''} ${rightIcon ? 'has-right-icon' : ''}`}
                    {...props}
                />
                {rightIcon && <span className="input-icon input-icon-right">{rightIcon}</span>}
            </div>
            {(error || helperText) && (
                <span className={`input-helper ${hasError ? 'input-helper-error' : ''}`}>
                    {error || helperText}
                </span>
            )}
        </div>
    );
};

export default Input;
