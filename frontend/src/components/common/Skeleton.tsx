import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = '20px',
    borderRadius = '8px',
    className = ''
}) => {
    return (
        <div
            className={`skeleton ${className}`}
            style={{
                width: typeof width === 'number' ? `${width}px` : width,
                height: typeof height === 'number' ? `${height}px` : height,
                borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius
            }}
        />
    );
};

// Pre-built skeleton layouts
export const CardSkeleton: React.FC = () => (
    <div className="skeleton-card">
        <Skeleton height={160} borderRadius="20px 20px 0 0" />
        <div className="skeleton-card-body">
            <Skeleton height={24} width="70%" />
            <Skeleton height={16} width="100%" className="mt-2" />
            <Skeleton height={16} width="80%" className="mt-1" />
            <div className="skeleton-card-footer">
                <Skeleton height={14} width="30%" />
                <Skeleton height={14} width="30%" />
            </div>
        </div>
    </div>
);

export const ListItemSkeleton: React.FC = () => (
    <div className="skeleton-list-item">
        <Skeleton width={48} height={48} borderRadius="50%" />
        <div className="skeleton-list-content">
            <Skeleton height={18} width="60%" />
            <Skeleton height={14} width="40%" className="mt-1" />
        </div>
        <Skeleton width={60} height={24} borderRadius="12px" />
    </div>
);

export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
    <tr className="skeleton-table-row">
        {Array.from({ length: columns }).map((_, i) => (
            <td key={i}>
                <Skeleton height={16} width={i === 0 ? '80%' : '60%'} />
            </td>
        ))}
    </tr>
);

export const StatCardSkeleton: React.FC = () => (
    <div className="skeleton-stat-card">
        <Skeleton width={48} height={48} borderRadius="12px" />
        <div className="skeleton-stat-content">
            <Skeleton height={32} width="50%" />
            <Skeleton height={14} width="70%" className="mt-1" />
        </div>
    </div>
);

export const PageHeaderSkeleton: React.FC = () => (
    <div className="skeleton-page-header">
        <div className="skeleton-header-content">
            <Skeleton height={32} width="200px" />
            <Skeleton height={16} width="300px" className="mt-2" />
        </div>
        <Skeleton width={120} height={44} borderRadius="12px" />
    </div>
);

// Classroom page skeleton
export const ClassroomGridSkeleton: React.FC = () => (
    <div className="skeleton-classroom-grid">
        {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
        ))}
    </div>
);

// Dashboard skeleton
export const DashboardSkeleton: React.FC = () => (
    <div className="skeleton-dashboard">
        <PageHeaderSkeleton />
        <div className="skeleton-stats-grid">
            {Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} />
            ))}
        </div>
        <div className="skeleton-sections">
            <div className="skeleton-section">
                <Skeleton height={24} width="150px" className="mb-3" />
                <div className="skeleton-list">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <ListItemSkeleton key={i} />
                    ))}
                </div>
            </div>
        </div>
    </div>
);
