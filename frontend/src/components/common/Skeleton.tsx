import React from 'react';

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
            className={`animate-pulse bg-gradient-to-r from-rose-100 via-rose-50 to-rose-100 ${className}`}
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
    <div className="bg-white rounded-xl border border-rose-100 overflow-hidden">
        <Skeleton height={160} borderRadius="0" />
        <div className="p-4">
            <Skeleton height={24} width="70%" className="mb-3" />
            <Skeleton height={16} width="100%" className="mb-2" />
            <Skeleton height={16} width="80%" className="mb-4" />
            <div className="flex items-center justify-between">
                <Skeleton height={14} width="30%" />
                <Skeleton height={14} width="30%" />
            </div>
        </div>
    </div>
);

export const ListItemSkeleton: React.FC = () => (
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-rose-100">
        <Skeleton width={48} height={48} borderRadius="50%" />
        <div className="flex-1">
            <Skeleton height={18} width="60%" className="mb-2" />
            <Skeleton height={14} width="40%" />
        </div>
        <Skeleton width={60} height={24} borderRadius="12px" />
    </div>
);

export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
    <tr>
        {Array.from({ length: columns }).map((_, i) => (
            <td key={i} className="px-4 py-3">
                <Skeleton height={16} width={i === 0 ? '80%' : '60%'} />
            </td>
        ))}
    </tr>
);

export const StatCardSkeleton: React.FC = () => (
    <div className="flex items-center gap-4 p-5 bg-white rounded-xl border border-rose-100">
        <Skeleton width={48} height={48} borderRadius="12px" />
        <div className="flex-1">
            <Skeleton height={32} width="50%" className="mb-2" />
            <Skeleton height={14} width="70%" />
        </div>
    </div>
);

export const PageHeaderSkeleton: React.FC = () => (
    <div className="flex items-center justify-between mb-8">
        <div>
            <Skeleton height={32} width="200px" className="mb-2" />
            <Skeleton height={16} width="300px" />
        </div>
        <Skeleton width={120} height={44} borderRadius="12px" />
    </div>
);

// Classroom page skeleton
export const ClassroomGridSkeleton: React.FC = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
        ))}
    </div>
);

// Dashboard skeleton
export const DashboardSkeleton: React.FC = () => (
    <div className="space-y-8">
        <PageHeaderSkeleton />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} />
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-rose-100 p-6">
                <Skeleton height={24} width="150px" className="mb-4" />
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <ListItemSkeleton key={i} />
                    ))}
                </div>
            </div>
            <div className="bg-white rounded-xl border border-rose-100 p-6">
                <Skeleton height={24} width="150px" className="mb-4" />
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <ListItemSkeleton key={i} />
                    ))}
                </div>
            </div>
        </div>
    </div>
);
