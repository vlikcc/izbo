import React from 'react';

interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onPageChange }) => {
    if (totalPages <= 1) {
        return null;
    }

    return (
        <nav className="pagination" aria-label="Sayfalama">
            <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                Önceki
            </button>
            <span>
                {page} / {totalPages}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                Sonraki
            </button>
        </nav>
    );
};
