import type { AttemptStatus, AttemptSummary, BankQuestion, BankQuestionType, QuestionDifficulty, QuestionOption, ScoringRule } from '../types/assessment';
import type { CreateQuestionRequest } from '../types';

export const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'];

/** True/false questions are stored as two fixed options. */
export const TRUE_FALSE_OPTIONS: QuestionOption[] = [
    { key: 'A', text: 'Doğru', assetId: null },
    { key: 'B', text: 'Yanlış', assetId: null },
];

export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
    Easy: 'Kolay',
    Medium: 'Orta',
    Hard: 'Zor',
};

export const QUESTION_TYPE_LABELS: Record<BankQuestionType, string> = {
    MultipleChoice: 'Çoktan seçmeli',
    TrueFalse: 'Doğru / Yanlış',
};

export const SCORING_RULE_LABELS: Record<ScoringRule, string> = {
    Plain: 'Yanlışlar doğruyu götürmez',
    NetThird: '3 yanlış 1 doğruyu götürür (LGS)',
    NetQuarter: '4 yanlış 1 doğruyu götürür (YKS)',
};

export const ATTEMPT_STATUS_LABELS: Record<AttemptStatus, string> = {
    InProgress: 'Devam ediyor',
    Submitted: 'Tamamlandı',
    Expired: 'Süre doldu',
};

/** 14.5 → "14,5"; nets are shown the Turkish way. */
export const formatNet = (value: number | null | undefined) =>
    value === null || value === undefined ? '—' : value.toLocaleString('tr-TR', { maximumFractionDigits: 2 });

/** 754000 ms → "12:34"; over an hour → "1:02:05". */
export function formatClock(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const mm = String(minutes).padStart(hours ? 2 : 1, '0');
    const ss = String(seconds).padStart(2, '0');
    return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "ilk %2,5" style placement text for a mock exam result. */
export const formatTopPercent = (value: number | null | undefined) =>
    value === null || value === undefined ? '' : `ilk %${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;

export const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * A bank question as a classroom exam question. The exam keeps a copy, so later bank edits never change an
 * exam already given. Multiple choice keeps its letter key; true/false uses the exam's "Doğru"/"Yanlış".
 * Option images cannot travel (exam options are text), so such questions are refused — the caller says so.
 */
export function bankToExamQuestion(question: BankQuestion, orderIndex: number, imageUrl: (assetId: string) => string): CreateQuestionRequest | null {
    if (question.options.some(o => o.assetId)) return null;

    const base = {
        orderIndex,
        content: question.stem,
        imageUrl: question.stemAssetId ? imageUrl(question.stemAssetId) : undefined,
        points: 1,
        explanation: question.explanation || undefined,
    };

    return question.type === 'TrueFalse'
        ? { ...base, type: 'TrueFalse', correctAnswer: question.correctKey === 'A' ? 'Doğru' : 'Yanlış' }
        : { ...base, type: 'MultipleChoice', options: question.options.map(o => o.text), correctAnswer: question.correctKey };
}

/** The submission a topic test hands in for homework, e.g. "Bölme — konu testi: 8 doğru, 2 yanlış, 0 boş (net 8, %80)". */
export function homeworkResultText(summary: AttemptSummary): string {
    const counts = `${summary.correct ?? 0} doğru, ${summary.wrong ?? 0} yanlış, ${summary.blank ?? 0} boş`;
    return `${summary.title}: ${counts} (net ${formatNet(summary.net)}, %${formatNet(summary.percent)})`;
}
