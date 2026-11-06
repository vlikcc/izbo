import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContentViewer } from './ContentViewer';
import type { ContentItem } from '../../types/content';

vi.mock('../../services/content.service', () => ({ default: { saveProgress: vi.fn() } }));

const item: ContentItem = {
    id: 'i1', topicId: 't1', topicName: 'Bölme', type: 'Embed', title: 'Etkinlik', description: '', durationSeconds: null,
    accessTier: 'Premium', status: 'Published', reviewNote: null, ownerId: 'x', ownerKind: 'Platform', order: 1,
    processingStatus: 'None', processingError: null, originalFileName: null, fileSize: null, hasThumbnail: false,
    embedUrl: 'https://www.youtube.com/embed/abc', outcomes: [], createdAt: '', updatedAt: '', submittedAt: null, publishedAt: null,
    progress: null,
};

describe('ContentViewer', () => {
    it('shows a lock and the way to a package instead of a locked item', () => {
        const { container } = render(<MemoryRouter><ContentViewer item={{ ...item, locked: true, embedUrl: null }} trackProgress /></MemoryRouter>);

        expect(screen.getByText('Bu içerik paketlere dahil')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Paketleri gör' })).toBeInTheDocument();
        expect(container.querySelector('iframe')).toBeNull();
    });

    it('plays an unlocked premium item', () => {
        const { container } = render(<MemoryRouter><ContentViewer item={item} trackProgress={false} /></MemoryRouter>);
        expect(container.querySelector('iframe')).not.toBeNull();
    });
});
