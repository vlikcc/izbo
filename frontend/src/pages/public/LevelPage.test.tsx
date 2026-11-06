import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicLevel } from '../../types/content';

const getPublicLevel = vi.fn();

vi.mock('../../services/content.service', () => ({
    default: {
        getPublicLevel: (slug: string) => getPublicLevel(slug),
        publicThumbnailUrl: (id: string) => `/thumb/${id}`,
    },
}));

import { LevelPage } from './LevelPage';

const level = (slug: string, name: string): PublicLevel => ({
    level: { id: slug, slug, name, kind: slug.includes('sinif') ? 'Grade' : 'ExamPrep', gradeNumber: null, order: 1 },
    subjects: [
        { id: 's1', slug: 'matematik', name: 'Matematik', color: '#2563eb', unitCount: 2, topicCount: 5, itemCount: 9, videoMinutes: 120 },
        { id: 's2', slug: 'turkce', name: 'Türkçe', color: '#dc2626', unitCount: 0, topicCount: 0, itemCount: 0, videoMinutes: 0 },
    ],
    totalItems: 9,
    totalVideoMinutes: 120,
    freeSamples: [{ id: 'v1', title: 'Kesirler', type: 'Video', subjectName: 'Matematik', topicName: 'Kesirler', durationSeconds: 600 }],
});

describe('LevelPage', () => {
    beforeEach(() => {
        getPublicLevel.mockReset();
    });

    it('shows a grade page from the route with its counts and subjects', async () => {
        getPublicLevel.mockResolvedValue(level('5-sinif', '5. Sınıf'));
        render(
            <MemoryRouter initialEntries={['/sinif/5-sinif']}>
                <Routes><Route path="/sinif/:slug" element={<LevelPage />} /></Routes>
            </MemoryRouter>,
        );

        expect(await screen.findByRole('heading', { level: 1, name: /5\. Sınıf/ })).toBeInTheDocument();
        expect(getPublicLevel).toHaveBeenCalledWith('5-sinif');
        expect(screen.getByText('5', { selector: 'strong' })).toBeInTheDocument();
        expect(screen.getByText(/İçerikler hazırlanıyor/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Kesirler/ })).toHaveAttribute('href', '/register?rol=ogrenci');
    });

    it('switches between the YKS tests', async () => {
        getPublicLevel.mockImplementation((slug: string) => Promise.resolve(level(slug, slug.toUpperCase())));
        render(
            <MemoryRouter>
                <LevelPage slugs={['yks-tyt', 'yks-ayt', 'yks-ydt']} title="YKS" />
            </MemoryRouter>,
        );

        await screen.findByText(/Temel Yeterlilik Testi/);
        await userEvent.click(screen.getByRole('tab', { name: 'AYT' }));

        expect(await screen.findByText(/Alan Yeterlilik Testi/)).toBeInTheDocument();
        expect(getPublicLevel).toHaveBeenLastCalledWith('yks-ayt');
    });

    it('says so when the level does not exist', async () => {
        getPublicLevel.mockRejectedValue(new Error('404'));
        render(
            <MemoryRouter initialEntries={['/sinif/99-sinif']}>
                <Routes><Route path="/sinif/:slug" element={<LevelPage />} /></Routes>
            </MemoryRouter>,
        );

        expect(await screen.findByText('Bu sayfa bulunamadı')).toBeInTheDocument();
    });
});
