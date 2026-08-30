// Exam Types
export interface Exam {
    id: string;
    classroomId: string;
    classroomName: string;
    title: string;
    description?: string;
    durationMinutes: number;
    startTime: string;
    endTime: string;
    totalPoints: number;
    questionCount: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResults: boolean;
    passingScore?: number;
    status: string;
    createdAt: string;
}

export interface CreateExamRequest {
    classroomId: string; // If creating from global context, might need selection
    title: string;
    description?: string;
    durationMinutes: number;
    startTime: string;
    endTime: string;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResults: boolean;
    passingScore?: number;
}

export interface ExamSession {
    id: string;
    examId: string;
    examTitle: string;
    studentId: string;
    studentName: string;
    startedAt?: string;
    submittedAt?: string;
    totalScore?: number;
    percentage?: number;
    isPassed: boolean;
    status: string;
}

// Homework Types
export interface CreateHomeworkRequest {
    classroomId: string;
    title: string;
    description: string;
    attachmentUrl?: string;
    maxScore: number;
    dueDate: string;
    allowLateSubmission: boolean;
    latePenaltyPercent: number;
}

export interface Homework {
    id: string;
    classroomId: string;
    classroomName: string;
    title: string;
    description: string;
    attachmentUrl?: string;
    maxScore: number;
    dueDate: string;
    allowLateSubmission: boolean;
    latePenaltyPercent: number;
    submissionCount: number;
    isActive: boolean;
    createdAt: string;
}

export interface Submission {
    id: string;
    homeworkId: string;
    studentId: string;
    studentName: string;
    content?: string;
    fileUrl?: string;
    score?: number;
    feedback?: string;
    status: string;
    submittedAt?: string;
    gradedAt?: string;
}

// Live Session Types
export interface LiveSession {
    id: string;
    classroomId: string;
    title: string;
    description?: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    meetingUrl?: string;
    recordingUrl?: string;
    status: string;
}

// Question Types
export type QuestionType = 'MultipleChoice' | 'TrueFalse' | 'FillInBlank';

export interface Question {
    id: string;
    examId: string;
    orderIndex: number;
    type: QuestionType;
    content: string;
    imageUrl?: string;
    options?: string[];
    correctAnswer?: string;
    points: number;
    explanation?: string;
}

export interface CreateQuestionRequest {
    orderIndex: number;
    type: QuestionType;
    content: string;
    imageUrl?: string;
    options?: string[];
    correctAnswer?: string;
    points: number;
    explanation?: string;
}

export interface UpdateQuestionRequest {
    orderIndex?: number;
    content?: string;
    imageUrl?: string;
    options?: string[];
    correctAnswer?: string;
    points?: number;
    explanation?: string;
}

// Subscription Types
export type SubscriberType = 'User' | 'Organization';
export type SubscriptionStatus = 'Trialing' | 'Active' | 'PastDue' | 'Canceled' | 'Expired';
export type BillingCycle = 'Monthly' | 'Yearly';
export type QuotaPeriod = 'Absolute' | 'Monthly';
export type OrgRole = 'Owner' | 'Admin' | 'Member';
export type OrderStatus = 'Pending' | 'Paid' | 'Failed' | 'Canceled';

export type QuotaMetric =
    | 'Classrooms'
    | 'ExamsCreated'
    | 'HomeworksCreated'
    | 'LiveMinutes'
    | 'StorageMegabytes'
    | 'MaxStudentsPerClassroom'
    | 'MaxQuestionsPerExam'
    | 'Seats';

export interface PlanLimit {
    metric: QuotaMetric;
    value: number; // -1 = unlimited
    period: QuotaPeriod;
}

export interface PlanFeature {
    featureCode: string;
    isEnabled: boolean;
}

export interface Plan {
    id: string;
    code: string;
    name: string;
    description?: string;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
    tier: number;
    targetSubscriberType: SubscriberType | null;
    isPublic: boolean;
    limits: PlanLimit[];
    features: PlanFeature[];
}

export interface UsageSnapshot {
    metric: QuotaMetric;
    used: number;
    limit: number; // -1 = unlimited
    period: QuotaPeriod;
}

export interface Subscription {
    id: string;
    subscriberType: SubscriberType;
    subscriberId: string;
    plan: Plan;
    status: SubscriptionStatus;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt?: string;
    trialAvailable: boolean;
    cancelAtPeriodEnd: boolean;
    seatCount: number;
    usage: UsageSnapshot[];
}

export interface CheckoutRequest {
    planCode: string;
    cycle: BillingCycle;
}

export interface CheckoutResult {
    orderId: string;
    amount: number;
    currency: string;
    provider: string;
    instructions: string;
}

export interface Organization {
    id: string;
    name: string;
    slug: string;
    ownerUserId: string;
    members: OrganizationMember[];
}

export interface OrganizationMember {
    id: string;
    userId: string;
    orgRole: OrgRole;
    joinedAt: string;
}

export interface AdminSubscription {
    id: string;
    subscriberType: SubscriberType;
    subscriberId: string;
    planCode: string;
    status: SubscriptionStatus;
    currentPeriodEnd: string;
    trialEndsAt?: string;
}

export interface AdminOrder {
    id: string;
    subscriptionId: string;
    planCode: string;
    cycle: BillingCycle;
    amount: number;
    currency: string;
    status: OrderStatus;
    createdAt: string;
}

export interface QuotaExceededInfo {
    message: string;
    errorCode: 'QUOTA_EXCEEDED';
    metric?: QuotaMetric;
    featureCode?: string;
    limit?: number;
    current?: number;
    upgradeUrl?: string;
}
