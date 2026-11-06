import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PackagesPage } from './PackagesPage';
import type { LearnerAccess, LearnerOrder, LearnerPackage } from '../../types/learner';

const learner = vi.hoisted(() => ({
    getPackages: vi.fn(),
    getAccess: vi.fn(),
    getMyOrders: vi.fn(),
    createOrder: vi.fn(),
    notifyPaid: vi.fn(),
    startTrial: vi.fn(),
    cancelOrder: vi.fn(),
}));
const getChildren = vi.hoisted(() => vi.fn());

vi.mock('../../services/learner.service', () => ({ default: learner }));
vi.mock('../../services/guardian.service', () => ({ default: { getChildren } }));
vi.mock('../../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'parent-1', role: 'Parent' } }) }));

const price = (term: 'Month1' | 'Month3' | 'Month12', days: number, amount: number) =>
    ({ term, durationDays: days, price: amount, currency: 'TRY', isActive: true });

const packages: LearnerPackage[] = [
    { code: 'temel', name: 'Temel', description: '', tier: 1, features: ['premium_content'], practiceTestsPerDay: 3, isActive: true, sortOrder: 1,
        prices: [price('Month1', 30, 249), price('Month3', 90, 649)] },
    { code: 'plus', name: 'Plus', description: '', tier: 2, features: ['premium_content', 'unlimited_practice', 'premium_assessments'], practiceTestsPerDay: -1, isActive: true, sortOrder: 2,
        prices: [price('Month1', 30, 349), price('Month3', 90, 899)] },
];

const freeAccess: LearnerAccess = {
    studentId: 'kid-2', packageCode: null, packageName: null, tier: 0, features: [], practiceTestsPerDay: 3, endsAt: null, trialAvailable: true,
};

const order: LearnerOrder = {
    id: 'o1', reference: 'YZK-8F3K2', payerId: 'parent-1', studentId: 'kid-2', packageCode: 'plus', packageName: 'Plus', term: 'Month3',
    amount: 899, currency: 'TRY', status: 'Pending', provider: 'BankTransfer', payerNote: null, rejectReason: null,
    createdAt: '2026-11-07T09:00:00Z', paidAt: null,
    instructions: { method: 'BankTransfer', bankName: 'Örnek Bank', accountHolder: 'YZ Kampüs', iban: 'TR00 0000 0000 0000 0000 0000 00', reference: 'YZK-8F3K2', text: 'Açıklamaya yalnızca YZK-8F3K2 yazın.' },
};

describe('PackagesPage', () => {
    beforeEach(() => {
        Object.values(learner).forEach(fn => fn.mockReset());
        getChildren.mockReset();
        getChildren.mockResolvedValue([
            { id: 'kid-1', firstName: 'Ela', lastName: 'Yılmaz', gradeLevel: 5, linkedAt: '' },
            { id: 'kid-2', firstName: 'Can', lastName: 'Yılmaz', gradeLevel: 8, linkedAt: '' },
        ]);
        learner.getPackages.mockResolvedValue(packages);
        learner.getAccess.mockResolvedValue(freeAccess);
        learner.getMyOrders.mockResolvedValue([]);
    });

    it('orders the chosen package and term for the selected child and shows how to pay', async () => {
        learner.createOrder.mockResolvedValue(order);
        learner.notifyPaid.mockResolvedValue({ ...order, status: 'AwaitingApproval' });
        render(<MemoryRouter><PackagesPage /></MemoryRouter>);

        fireEvent.click(await screen.findByRole('tab', { name: 'Can' }));
        fireEvent.click(screen.getByRole('radio', { name: '3 ay' }));
        const plus = (await screen.findByRole('heading', { name: 'Plus' })).closest('.package-card') as HTMLElement;
        expect(within(plus).getByText('899 ₺')).toBeInTheDocument();
        fireEvent.click(within(plus).getByRole('button', { name: 'Satın al' }));

        await waitFor(() => expect(learner.createOrder).toHaveBeenCalledWith('kid-2', 'plus', 'Month3'));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('TR00 0000 0000 0000 0000 0000 00')).toBeInTheDocument();
        expect(within(dialog).getAllByText('YZK-8F3K2').length).toBeGreaterThan(0);

        fireEvent.click(within(dialog).getByRole('button', { name: 'Ödemeyi yaptım' }));
        await waitFor(() => expect(learner.notifyPaid).toHaveBeenCalledWith('o1', undefined));
        expect(await within(dialog).findByText(/onaylanınca paket tanımlanacak/)).toBeInTheDocument();
    });

    it('offers the free Plus trial once', async () => {
        learner.startTrial.mockResolvedValue({ ...freeAccess, studentId: 'kid-1', packageCode: 'plus', packageName: 'Plus', tier: 2, endsAt: '2026-11-14T09:00:00Z', trialAvailable: false });
        render(<MemoryRouter><PackagesPage /></MemoryRouter>);

        fireEvent.click(await screen.findByRole('button', { name: /7 gün Plus’ı ücretsiz dene/ }));

        await waitFor(() => expect(learner.startTrial).toHaveBeenCalledWith('kid-1'));
        expect(await screen.findByRole('heading', { name: 'Plus', level: 2 })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /ücretsiz dene/ })).not.toBeInTheDocument();
    });
});
