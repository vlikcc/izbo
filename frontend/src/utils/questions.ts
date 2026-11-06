import type { AttemptStatus, BankQuestionType, QuestionDifficulty, QuestionOption, ScoringRule } from '../types/assessment';

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
