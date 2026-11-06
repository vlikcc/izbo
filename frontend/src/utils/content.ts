import type { ContentItemType, ContentProcessingStatus, ContentStatus, Level } from '../types/content';
import type { User } from '../types';

/** The catalog levels a student studies: their grade, plus the exam track they prepare for. */
export function levelSlugsForUser(user: Pick<User, 'gradeLevel' | 'examTarget'> | null | undefined): string[] {
    const slugs: string[] = [];
    if (user?.gradeLevel) slugs.push(`${user.gradeLevel}-sinif`);
    if (user?.examTarget === 'Lgs') slugs.push('lgs');
    if (user?.examTarget === 'Yks') slugs.push('yks-tyt', 'yks-ayt', 'yks-ydt');
    return slugs;
}

/** Orders levels the way a student expects: grades first, then exam tracks. */
export const sortLevels = (levels: Level[]) =>
    [...levels].sort((a, b) => (a.kind === b.kind ? a.order - b.order : a.kind === 'Grade' ? -1 : 1));

export const CONTENT_TYPE_LABELS: Record<ContentItemType, string> = {
    Video: 'Konu anlatımı',
    SolvedQuestionVideo: 'Çözümlü soru',
    Pdf: 'PDF',
    Worksheet: 'Çalışma kâğıdı',
    EBook: 'E-kitap',
    Embed: 'Etkileşimli',
};

export const CONTENT_TYPE_ICONS: Record<ContentItemType, string> = {
    Video: '🎬',
    SolvedQuestionVideo: '✍️',
    Pdf: '📄',
    Worksheet: '📝',
    EBook: '📚',
    Embed: '🧩',
};

export const STATUS_LABELS: Record<ContentStatus, string> = {
    Draft: 'Taslak',
    InReview: 'Onay bekliyor',
    Published: 'Yayında',
    Rejected: 'Reddedildi',
};

export const PROCESSING_LABELS: Record<ContentProcessingStatus, string> = {
    None: 'Dosya yok',
    Queued: 'Sırada',
    Processing: 'Hazırlanıyor',
    Ready: 'Hazır',
    Failed: 'Hata',
};

export const isVideoType = (type: ContentItemType) => type === 'Video' || type === 'SolvedQuestionVideo';
export const isDocumentType = (type: ContentItemType) => type === 'Pdf' || type === 'Worksheet' || type === 'EBook';

/** Which files the upload picker offers for an item type (the server checks the bytes again). */
export const acceptFor = (type: ContentItemType) =>
    isVideoType(type) ? 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov' : 'application/pdf,.pdf';

/** 754 → "12 dk", 3725 → "1 sa 2 dk". */
export function formatDuration(seconds: number | null | undefined): string {
    if (!seconds || seconds <= 0) return '';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${Math.max(minutes, 1)} dk`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} sa ${rest} dk` : `${hours} sa`;
}

/** Completion as a whole percentage, safe for empty topics. */
export const percent = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);
