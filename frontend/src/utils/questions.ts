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
