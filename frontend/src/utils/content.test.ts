import { describe, expect, it } from 'vitest';
import { formatDuration, levelSlugsForUser, percent, sortLevels } from './content';
import type { Level } from '../types/content';

describe('levelSlugsForUser', () => {
    it('gives a student their grade and the exam track they prepare for', () => {
        expect(levelSlugsForUser({ gradeLevel: 8, examTarget: 'Lgs' })).toEqual(['8-sinif', 'lgs']);
        expect(levelSlugsForUser({ gradeLevel: 12, examTarget: 'Yks' })).toEqual(['12-sinif', 'yks-tyt', 'yks-ayt', 'yks-ydt']);
        expect(levelSlugsForUser({ gradeLevel: 3, examTarget: null })).toEqual(['3-sinif']);
        expect(levelSlugsForUser({ gradeLevel: null, examTarget: null })).toEqual([]);
    });
});

describe('formatDuration', () => {
    it('rounds to minutes and switches to hours past sixty', () => {
        expect(formatDuration(754)).toBe('13 dk');
        expect(formatDuration(20)).toBe('1 dk');
        expect(formatDuration(3725)).toBe('1 sa 2 dk');
        expect(formatDuration(7200)).toBe('2 sa');
        expect(formatDuration(null)).toBe('');
    });
});

describe('percent', () => {
    it('is safe for empty topics', () => {
        expect(percent(0, 0)).toBe(0);
        expect(percent(1, 3)).toBe(33);
    });
});

describe('sortLevels', () => {
    it('puts grades before exam tracks', () => {
        const level = (slug: string, kind: Level['kind'], order: number): Level =>
            ({ id: slug, slug, name: slug, kind, gradeNumber: null, order });
        const sorted = sortLevels([level('lgs', 'ExamPrep', 1), level('9-sinif', 'Grade', 9), level('1-sinif', 'Grade', 1)]);
        expect(sorted.map(l => l.slug)).toEqual(['1-sinif', '9-sinif', 'lgs']);
    });
});
