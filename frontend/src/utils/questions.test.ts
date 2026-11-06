import { describe, expect, it } from 'vitest';
import { bankToExamQuestion, formatClock, homeworkResultText } from './questions';
import type { AttemptSummary, BankQuestion } from '../types/assessment';

const base: BankQuestion = {
    id: 'q1', topicId: 't1', topicName: 'Bölme', unitId: 'u1', unitName: 'Sayılar', subjectId: 's1', subjectName: 'Matematik',
    levelId: 'l1', levelName: '8. Sınıf', outcome: null, type: 'MultipleChoice', stem: '$12 \\div 3$ kaçtır?', stemAssetId: 'img1',
    options: [{ key: 'A', text: '2', assetId: null }, { key: 'B', text: '4', assetId: null }],
    correctKey: 'B', difficulty: 'Easy', explanation: 'Bölme yapılır.', solutionVideoItemId: null, solutionVideoTitle: null,
    ownerId: 'o', ownerKind: 'Platform', status: 'Published', reviewNote: null,
    createdAt: '', updatedAt: '', submittedAt: null, publishedAt: null,
};

describe('bankToExamQuestion', () => {
    it('keeps the letter key, the options and the stem image', () => {
        expect(bankToExamQuestion(base, 3, id => `/img/${id}`)).toEqual({
            orderIndex: 3,
            type: 'MultipleChoice',
            content: '$12 \\div 3$ kaçtır?',
            imageUrl: '/img/img1',
            options: ['2', '4'],
            correctAnswer: 'B',
            points: 1,
            explanation: 'Bölme yapılır.',
        });
    });

    it('turns a true/false key into the exam answer text', () => {
        const trueFalse: BankQuestion = { ...base, type: 'TrueFalse', stemAssetId: null, correctKey: 'B',
            options: [{ key: 'A', text: 'Doğru', assetId: null }, { key: 'B', text: 'Yanlış', assetId: null }] };
        expect(bankToExamQuestion(trueFalse, 1, id => id)).toMatchObject({ type: 'TrueFalse', correctAnswer: 'Yanlış', imageUrl: undefined });
    });

    it('refuses questions whose options are images, which exam options cannot hold', () => {
        const pictures = { ...base, options: [{ key: 'A', text: '', assetId: 'x' }, { key: 'B', text: '4', assetId: null }] };
        expect(bankToExamQuestion(pictures, 1, id => id)).toBeNull();
    });
});

describe('formatting', () => {
    it('formats the countdown', () => {
        expect(formatClock(754_000)).toBe('12:34');
        expect(formatClock(3_725_000)).toBe('1:02:05');
        expect(formatClock(-5)).toBe('0:00');
    });

    it('writes the homework submission for a finished topic test', () => {
        const summary = { title: 'Bölme — konu testi', correct: 8, wrong: 2, blank: 0, net: 8, percent: 80 } as AttemptSummary;
        expect(homeworkResultText(summary)).toBe('Bölme — konu testi: 8 doğru, 2 yanlış, 0 boş (net 8, %80)');
    });
});
