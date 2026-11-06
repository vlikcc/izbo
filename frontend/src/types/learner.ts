/** Student packages (SubscriptionService /api/learner). Enums arrive as strings. */

export type LearnerTerm = 'Month1' | 'Month3' | 'Month12' | 'Summer';
export type LearnerOrderStatus = 'Pending' | 'AwaitingApproval' | 'Paid' | 'Rejected' | 'Canceled';
export type LearnerPassSource = 'Purchase' | 'Trial' | 'AdminGrant';

export interface LearnerPrice {
    term: LearnerTerm;
    durationDays: number;
    price: number;
    currency: string;
    isActive: boolean;
}

export interface LearnerPackage {
    code: string;
    name: string;
    description: string;
    tier: number;
    features: string[];
    /** -1 when unlimited. */
    practiceTestsPerDay: number;
    isActive: boolean;
    sortOrder: number;
    prices: LearnerPrice[];
}

export interface LearnerAccess {
    studentId: string;
    packageCode: string | null;
    packageName: string | null;
    /** 0 without a package. */
    tier: number;
    features: string[];
    practiceTestsPerDay: number;
    endsAt: string | null;
    trialAvailable: boolean;
}

export interface LearnerPass {
    id: string;
    packageCode: string;
    packageName: string;
    tier: number;
    startsAt: string;
    endsAt: string;
    source: LearnerPassSource;
}

export interface PaymentInstructions {
    method: string;
    bankName: string | null;
    accountHolder: string | null;
    iban: string | null;
    reference: string;
    text: string;
}

export interface LearnerOrder {
    id: string;
    reference: string;
    payerId: string;
    studentId: string;
    packageCode: string;
    packageName: string;
    term: LearnerTerm;
    amount: number;
    currency: string;
    status: LearnerOrderStatus;
    provider: string;
    payerNote: string | null;
    rejectReason: string | null;
    createdAt: string;
    paidAt: string | null;
    instructions: PaymentInstructions | null;
}

export interface PracticeUsage {
    usedToday: number;
    /** -1 when unlimited. */
    dailyLimit: number;
}

export interface UpdateLearnerPackageRequest {
    name: string;
    description: string | null;
    features: string[];
    practiceTestsPerDay: number;
    isActive: boolean;
    sortOrder: number;
}
