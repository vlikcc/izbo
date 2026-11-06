import { describe, expect, it } from 'vitest';
import { compactChoices } from './choiceKey';

describe('compactChoices', () => {
    it('keeps a letter key when no option is empty', () => {
        expect(compactChoices(['İstanbul', 'Ankara', 'İzmir'], 'B')).toEqual({
            options: ['İstanbul', 'Ankara', 'İzmir'],
            correctAnswer: 'B',
        });
    });

    it('shifts the letter when an earlier option is empty', () => {
        expect(compactChoices(['İstanbul', '', 'Ankara', 'İzmir'], 'C')).toEqual({
            options: ['İstanbul', 'Ankara', 'İzmir'],
            correctAnswer: 'B',
        });
    });

    it('accepts a lower-case letter', () => {
        expect(compactChoices(['a1', 'b1'], 'b').correctAnswer).toBe('B');
    });

    it('turns an option-text key into its letter', () => {
        expect(compactChoices(['İstanbul', 'Ankara'], 'ankara').correctAnswer).toBe('B');
    });

    it('returns no key when it points at an empty or missing option', () => {
        expect(compactChoices(['x', '', 'y'], 'B').correctAnswer).toBe('');
        expect(compactChoices(['x', 'y'], 'Bursa').correctAnswer).toBe('');
    });
});
