import type { LearnerAccess, LearnerOrderStatus, LearnerPackage, LearnerPrice, LearnerTerm } from '../types/learner';

export const TERM_LABELS: Record<LearnerTerm, string> = {
    Month1: '1 ay',
    Month3: '3 ay',
    Month12: '12 ay',
    Summer: 'Yaz paketi',
};

export const TERM_ORDER: LearnerTerm[] = ['Month1', 'Month3', 'Month12', 'Summer'];

export const ORDER_STATUS_LABELS: Record<LearnerOrderStatus, string> = {
    Pending: 'Ödeme bekleniyor',
    AwaitingApproval: 'Onay bekliyor',
    Paid: 'Ödendi',
    Rejected: 'Reddedildi',
    Canceled: 'İptal edildi',
};

export const FEATURE_LABELS: Record<string, string> = {
    premium_content: 'Premium konu anlatımları ve PDF’ler',
    unlimited_practice: 'Sınırsız konu ve ünite testi',
    premium_assessments: 'Premium denemeler ve Türkiye sıralaması',
    live_group_lessons: 'Canlı grup dersleri (yakında)',
};

export const TIER_NAMES: Record<number, string> = { 0: 'Ücretsiz', 1: 'Temel', 2: 'Plus', 3: 'Premium' };

export const tierName = (tier: number) => TIER_NAMES[tier] ?? `Paket ${tier}`;

/** 1290 → "1.290 ₺". */
export function formatPrice(amount: number, currency = 'TRY'): string {
    const symbol = currency === 'TRY' ? '₺' : currency;
    return `${amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${symbol}`;
}

/** The yaz paketi is sold from May through August (Istanbul calendar), as SubscriptionService enforces. */
export function isSummerSaleOpen(now = new Date()): boolean {
    const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', month: 'numeric' }).format(now));
    return month >= 5 && month <= 8;
}

/** The terms a buyer can choose right now, in display order. */
export function purchasableTerms(pkg: LearnerPackage, now = new Date()): LearnerPrice[] {
    return TERM_ORDER
        .map(term => pkg.prices.find(p => p.term === term && p.isActive))
        .filter((p): p is LearnerPrice => !!p && (p.term !== 'Summer' || isSummerSaleOpen(now)));
}

/** Monthly equivalent, for "aylık … ₺'ye gelir" hints on longer terms. */
export const monthlyEquivalent = (price: LearnerPrice) =>
    price.durationDays > 0 ? Math.round((price.price / price.durationDays) * 30) : price.price;

/** Whole days until the package ends, rounded up; null without a package. */
export function daysLeft(access: Pick<LearnerAccess, 'endsAt'> | null | undefined, now = new Date()): number | null {
    if (!access?.endsAt) return null;
    return Math.max(0, Math.ceil((new Date(access.endsAt).getTime() - now.getTime()) / 86_400_000));
}

export const formatDay = (iso: string) =>
    new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

export const practiceLimitLabel = (perDay: number) => (perDay < 0 ? 'Sınırsız test' : `Günde ${perDay} test`);
