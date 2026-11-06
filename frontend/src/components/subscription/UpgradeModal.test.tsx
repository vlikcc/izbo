import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UpgradeModal } from './UpgradeModal';
import { useUpgradeStore } from '../../stores/upgradeStore';

vi.mock('../../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 's1', role: 'Student' } }) }));

describe('UpgradeModal', () => {
    afterEach(() => act(() => useUpgradeStore.getState().close()));

    it('explains a missing student package and points to the packages page', () => {
        render(<MemoryRouter><UpgradeModal /></MemoryRouter>);
        act(() => useUpgradeStore.getState().open({
            errorCode: 'PACKAGE_REQUIRED', message: 'Bugünkü 3 ücretsiz testini kullandın', requiredTier: 2, reason: 'daily_limit', upgradeUrl: '/app/paketler',
        }));

        expect(screen.getByText('Bugünkü test hakkın doldu')).toBeInTheDocument();
        expect(screen.getByText('Plus ve üstü')).toBeInTheDocument();
        expect(screen.getByText(/velin alabilir/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Paketleri gör' })).toBeInTheDocument();
    });

    it('keeps the teacher plan message for quota limits', () => {
        render(<MemoryRouter><UpgradeModal /></MemoryRouter>);
        act(() => useUpgradeStore.getState().open({ errorCode: 'QUOTA_EXCEEDED', message: 'Sınıf limitine ulaştınız', metric: 'Classrooms', limit: 1, current: 1 }));

        expect(screen.getByText('Plan limitine ulaşıldı')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Planları Görüntüle' })).toBeInTheDocument();
    });
});
