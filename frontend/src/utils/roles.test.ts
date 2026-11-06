import { describe, expect, it } from 'vitest';
import { examTargetsForGrade, isStaff, roleLabel } from './roles';

describe('examTargetsForGrade', () => {
    it('offers LGS in middle school and YKS in high school', () => {
        expect(examTargetsForGrade(3)).toEqual([]);
        expect(examTargetsForGrade(8)).toEqual(['Lgs']);
        expect(examTargetsForGrade(11)).toEqual(['Yks']);
        expect(examTargetsForGrade(undefined)).toEqual([]);
    });
});

describe('roles', () => {
    it('does not treat parents as staff', () => {
        expect(isStaff({ role: 'Parent' })).toBe(false);
        expect(isStaff({ role: 'Instructor' })).toBe(true);
        expect(roleLabel('Parent')).toBe('Veli');
    });
});
