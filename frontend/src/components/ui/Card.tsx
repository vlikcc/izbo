import React from 'react';
import './Card.css';

export interface CardProps {
    children: React.ReactNode;
    variant?: 'default' | 'outlined' | 'glass';
    hoverable?: boolean;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
    children,
    variant = 'default',
    hoverable = false,
    padding = 'md',
    className = '',
    style,
    onClick,
}) => {
    const classNames = [
        'card',
        `card-${variant}`,
        `card-padding-${padding}`,
        hoverable ? 'card-hoverable' : '',
        onClick ? 'card-clickable' : '',
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={classNames} style={style} onClick={onClick} role={onClick ? 'button' : undefined}>
            {children}
        </div>
    );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = ''
}) => (
    <div className={`card-header ${className}`}>{children}</div>
);

export const CardBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = ''
}) => (
    <div className={`card-body ${className}`}>{children}</div>
);

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = ''
}) => (
    <div className={`card-footer ${className}`}>{children}</div>
);

export default Card;
