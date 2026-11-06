// Mirrors src/Shared/Shared/DTOs/ContentDtos.cs. ContentService serializes enums as strings.

export type LevelKind = 'Grade' | 'ExamPrep';
export type ContentItemType = 'Video' | 'SolvedQuestionVideo' | 'Pdf' | 'Worksheet' | 'EBook' | 'Embed';
export type ContentAccessTier = 'Free' | 'Premium';
export type ContentStatus = 'Draft' | 'InReview' | 'Published' | 'Rejected';
export type ContentOwnerKind = 'Platform' | 'Teacher';
export type ContentProcessingStatus = 'None' | 'Queued' | 'Processing' | 'Ready' | 'Failed';

export interface Level {
    id: string;
    slug: string;
    name: string;
    kind: LevelKind;
    gradeNumber: number | null;
    order: number;
}

export interface Subject {
    id: string;
    levelId: string;
    slug: string;
    name: string;
    color: string;
    order: number;
}

export interface LearningOutcome {
    id: string;
    topicId: string;
    code: string;
    description: string;
}

export interface TopicNode {
    id: string;
    unitId: string;
    slug: string;
    name: string;
    order: number;
    itemCount: number;
    completedCount: number;
}

export interface UnitNode {
    id: string;
    subjectId: string;
    name: string;
    order: number;
    topics: TopicNode[];
}

export interface SubjectTree {
    subject: Subject;
    level: Level;
    units: UnitNode[];
}

export interface ContentProgress {
    positionSeconds: number;
    completed: boolean;
    updatedAt: string;
}

export interface ContentItemSummary {
    id: string;
    topicId: string;
    type: ContentItemType;
    title: string;
    durationSeconds: number | null;
    accessTier: ContentAccessTier;
    status: ContentStatus;
    processingStatus: ContentProcessingStatus;
    hasThumbnail: boolean;
    order: number;
    progress: ContentProgress | null;
}

export interface ContentItem {
    id: string;
    topicId: string;
    topicName: string;
    type: ContentItemType;
    title: string;
    description: string;
    durationSeconds: number | null;
    accessTier: ContentAccessTier;
    status: ContentStatus;
    reviewNote: string | null;
    ownerId: string;
    ownerKind: ContentOwnerKind;
    order: number;
    processingStatus: ContentProcessingStatus;
    processingError: string | null;
    originalFileName: string | null;
    fileSize: number | null;
    hasThumbnail: boolean;
    embedUrl: string | null;
    outcomes: LearningOutcome[];
    createdAt: string;
    updatedAt: string;
    submittedAt: string | null;
    publishedAt: string | null;
    progress: ContentProgress | null;
}

export interface TopicDetail {
    id: string;
    unitId: string;
    unitName: string;
    subjectId: string;
    subjectName: string;
    slug: string;
    name: string;
    order: number;
    outcomes: LearningOutcome[];
    items: ContentItemSummary[];
}

export interface ContinueWatching {
    item: ContentItemSummary;
    subjectId: string;
    subjectName: string;
    topicName: string;
    positionSeconds: number;
    updatedAt: string;
}

export interface StudentContentActivity {
    studentId: string;
    since: string;
    itemsStudied: number;
    itemsCompleted: number;
    recent: ContinueWatching[];
}

export interface CreateContentItemRequest {
    topicId: string;
    type: ContentItemType;
    title: string;
    description?: string;
    accessTier?: ContentAccessTier;
    embedUrl?: string;
    order?: number;
    outcomeIds?: string[];
}

export interface CurriculumImportError {
    row: number;
    message: string;
}

export interface CurriculumImportResult {
    dryRun: boolean;
    rowCount: number;
    subjectsCreated: number;
    unitsCreated: number;
    topicsCreated: number;
    outcomesCreated: number;
    outcomesUpdated: number;
    errors: CurriculumImportError[];
}
