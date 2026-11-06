// Mirrors src/Shared/Shared/DTOs/AssessmentDtos.cs. ContentService serializes enums as strings.
import type { ContentAccessTier, ContentItemSummary, ContentOwnerKind, ContentStatus, LearningOutcome } from './content';

export type BankQuestionType = 'MultipleChoice' | 'TrueFalse';
export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';

// ---- Question bank ----

export interface QuestionOption {
    key: string;
    text: string;
    assetId: string | null;
}

export interface QuestionOptionInput {
    text: string;
    assetId?: string | null;
}

export interface BankQuestion {
    id: string;
    topicId: string;
    topicName: string;
    unitId: string;
    unitName: string;
    subjectId: string;
    subjectName: string;
    levelId: string;
    levelName: string;
    outcome: LearningOutcome | null;
    type: BankQuestionType;
    stem: string;
    stemAssetId: string | null;
    options: QuestionOption[];
    correctKey: string;
    difficulty: QuestionDifficulty;
    explanation: string;
    solutionVideoItemId: string | null;
    solutionVideoTitle: string | null;
    ownerId: string;
    ownerKind: ContentOwnerKind;
    status: ContentStatus;
    reviewNote: string | null;
    createdAt: string;
    updatedAt: string;
    submittedAt: string | null;
    publishedAt: string | null;
}

export interface SaveBankQuestionRequest {
    topicId: string;
    learningOutcomeId: string | null;
    type: BankQuestionType;
    stem: string;
    stemAssetId: string | null;
    options: QuestionOptionInput[] | null;
    correctKey: string;
    difficulty: QuestionDifficulty;
    explanation: string | null;
    solutionVideoItemId: string | null;
}

export interface QuestionListQuery {
    levelId?: string;
    subjectId?: string;
    unitId?: string;
    topicId?: string;
    outcomeId?: string;
    difficulty?: QuestionDifficulty;
    status?: ContentStatus;
    mine?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
}

export interface QuestionAsset {
    id: string;
    contentType: string;
    size: number;
}

export interface ImportError {
    row: number;
    message: string;
}

export interface QuestionImportResult {
    dryRun: boolean;
    rowCount: number;
    created: number;
    updated: number;
    unchanged: number;
    errors: ImportError[];
}

// ---- Tests and results ----

export type AssessmentKind = 'MockExam' | 'Placement';
export type ScoringRule = 'Plain' | 'NetThird' | 'NetQuarter';
export type AssessmentStatus = 'Draft' | 'Published';
export type AttemptScope = 'Topic' | 'Unit' | 'Assessment';
export type AttemptStatus = 'InProgress' | 'Submitted' | 'Expired';
export type AssessmentWindowState = 'Upcoming' | 'Open' | 'Closed';

export interface AttemptQuestion {
    order: number;
    questionId: string;
    sectionTitle: string | null;
    type: BankQuestionType;
    stem: string;
    stemAssetId: string | null;
    options: QuestionOption[];
    selectedKey: string | null;
}

export interface AttemptSummary {
    id: string;
    scope: AttemptScope;
    assessmentKind: AssessmentKind | null;
    assessmentId: string | null;
    topicId: string | null;
    unitId: string | null;
    title: string;
    status: AttemptStatus;
    scoringRule: ScoringRule;
    startedAt: string;
    deadline: string;
    submittedAt: string | null;
    questionCount: number;
    answeredCount: number;
    resultsVisible: boolean;
    resultsAt: string | null;
    correct: number | null;
    wrong: number | null;
    blank: number | null;
    net: number | null;
    percent: number | null;
    isRanked: boolean;
    rank: number | null;
    participantCount: number | null;
    topPercent: number | null;
}

export interface Attempt {
    summary: AttemptSummary;
    serverNow: string;
    questions: AttemptQuestion[];
}

export interface SectionResult {
    title: string;
    subjectId: string | null;
    correct: number;
    wrong: number;
    blank: number;
    net: number;
}

export interface MasteryRow {
    topicId: string;
    topicName: string;
    outcomeId: string | null;
    outcomeCode: string | null;
    outcomeDescription: string | null;
    correct: number;
    total: number;
    percent: number;
}

export interface RecommendedContent {
    item: ContentItemSummary;
    topicId: string;
    topicName: string;
    outcomeCode: string | null;
}

export interface ReviewQuestion {
    order: number;
    questionId: string;
    sectionTitle: string | null;
    type: BankQuestionType;
    stem: string;
    stemAssetId: string | null;
    options: QuestionOption[];
    selectedKey: string | null;
    correctKey: string;
    isCorrect: boolean | null;
    explanation: string;
    solutionVideoItemId: string | null;
    topicName: string;
    outcomeCode: string | null;
}

export interface AttemptReport {
    summary: AttemptSummary;
    sections: SectionResult[];
    topics: MasteryRow[];
    outcomes: MasteryRow[];
    weak: MasteryRow[];
    recommendations: RecommendedContent[];
    questions: ReviewQuestion[];
}

export interface TopicMastery {
    topicId: string;
    topicName: string;
    subjectId: string;
    subjectName: string;
    correct: number;
    total: number;
    percent: number;
    lastAttemptAt: string;
}

export interface Mastery {
    studentId: string;
    since: string;
    topics: TopicMastery[];
    weak: TopicMastery[];
}

export interface AssessmentSummary {
    id: string;
    kind: AssessmentKind;
    title: string;
    description: string;
    levelId: string;
    levelSlug: string;
    levelName: string;
    durationMinutes: number;
    scoringRule: ScoringRule;
    questionCount: number;
    windowStart: string | null;
    windowEnd: string | null;
    state: AssessmentWindowState;
    accessTier: ContentAccessTier;
    status: AssessmentStatus;
    myAttemptId: string | null;
    myAttemptStatus: AttemptStatus | null;
}

export interface AssessmentSection {
    id: string;
    subjectId: string | null;
    title: string;
    order: number;
    questions: BankQuestion[];
}

export interface AssessmentDetail {
    summary: AssessmentSummary;
    rankedAt: string | null;
    attemptCount: number;
    sections: AssessmentSection[];
}

export interface SaveAssessmentRequest {
    kind: AssessmentKind;
    title: string;
    description: string | null;
    levelId: string;
    durationMinutes: number;
    scoringRule: ScoringRule | null;
    windowStart: string | null;
    windowEnd: string | null;
    accessTier: ContentAccessTier;
}

export interface SectionInput {
    subjectId: string | null;
    title: string;
    questionIds: string[];
}
