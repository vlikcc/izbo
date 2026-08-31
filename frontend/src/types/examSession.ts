import type { Question } from '../types';

export interface StartExamResponse {
    sessionId: string;
    questions: Question[];
    expiresAt: string;
    remainingSeconds: number;
}

export interface ExamResult {
    sessionId: string;
    examId: string;
    examTitle: string;
    totalScore: number;
    maxScore: number;
    percentage: number;
    isPassed: boolean;
    submittedAt: string;
    questionResults?: {
        questionId: string;
        content: string;
        yourAnswer?: string;
        correctAnswer?: string;
        isCorrect: boolean;
        pointsAwarded: number;
        maxPoints: number;
        explanation?: string;
    }[];
}
