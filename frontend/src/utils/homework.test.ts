import { describe, expect, it } from 'vitest';
import { missedHomework, pendingHomework } from './homework';
import type { StudentHomework } from '../services/guardian.service';
import type { Homework, Submission } from '../types';

const now = new Date('2026-11-06T12:00:00Z');

const item = (id: string, dueDate: string, submitted: boolean): StudentHomework => ({
    homework: { id, dueDate, title: id } as Homework,
    submission: submitted ? ({ id: `s-${id}` } as Submission) : null,
});

describe('homework buckets for the parent view', () => {
    const items = [
        item('open', '2026-11-08T00:00:00Z', false),
        item('done', '2026-11-08T00:00:00Z', true),
        item('missed', '2026-11-01T00:00:00Z', false),
        item('late-but-done', '2026-11-01T00:00:00Z', true),
    ];

    it('counts unsubmitted work that is still due as pending', () => {
        expect(pendingHomework(items, now).map(i => i.homework.id)).toEqual(['open']);
    });

    it('counts unsubmitted work past its due date as missed', () => {
        expect(missedHomework(items, now).map(i => i.homework.id)).toEqual(['missed']);
    });
});
