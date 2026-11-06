import { describe, expect, it } from 'vitest';
import { daysLeft, formatPrice, isSummerSaleOpen, monthlyEquivalent, purchasableTerms } from './learner';
import type { LearnerPackage } from '../types/learner';

const pkg: LearnerPackage = {
    code: 'plus', name: 'Plus', description: '', tier: 2, features: [], practiceTestsPerDay: -1, isActive: true, sortOrder: 2,
    prices: [
        { term: 'Summer', durationDays: 0, price: 699, currency: 'TRY', isActive: true },
        { term: 'Month12', durationDays: 365, price: 2790, currency: 'TRY', isActive: true },
        { term: 'Month1', durationDays: 30, price: 349, currency: 'TRY', isActive: true },
        { term: 'Month3', durationDays: 90, price: 899, currency: 'TRY', isActive: false },
    ],
};

describe('learner helpers', () => {
    it('offers active terms in order, and the summer package only in summer', () => {
        expect(purchasableTerms(pkg, new Date('2026-11-07T09:00:00Z')).map(p => p.term)).toEqual(['Month1', 'Month12']);
        expect(purchasableTerms(pkg, new Date('2027-06-01T09:00:00Z')).map(p => p.term)).toEqual(['Month1', 'Month12', 'Summer']);
    });

    it('follows the Istanbul calendar for the summer sale', () => {
        expect(isSummerSaleOpen(new Date('2027-04-30T20:00:00Z'))).toBe(false); // 23:00 in Istanbul
        expect(isSummerSaleOpen(new Date('2027-04-30T21:00:00Z'))).toBe(true);  // already 1 May
    });

    it('formats lira and monthly equivalents', () => {
        expect(formatPrice(1290)).toBe('1.290 ₺');
        expect(monthlyEquivalent(pkg.prices[1])).toBe(229);
    });

    it('counts the days left, rounding up', () => {
        const now = new Date('2026-11-07T09:00:00Z');
        expect(daysLeft({ endsAt: '2026-11-10T08:00:00Z' }, now)).toBe(3);
        expect(daysLeft({ endsAt: null }, now)).toBeNull();
    });
});
