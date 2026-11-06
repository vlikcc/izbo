import { describe, expect, it } from 'vitest';
import { USERNAME_PATTERN, formatCode, suggestUsername } from './codes';

describe('suggestUsername', () => {
    it('turns a Turkish name into an ASCII sign-in name the server accepts', () => {
        const name = suggestUsername('Çağla', 'Işık Öztürk');

        expect(name).toBe('cagla.isikozturk');
        expect(USERNAME_PATTERN.test(name)).toBe(true);
    });

    it('handles a single name and caps the length', () => {
        expect(suggestUsername('Ela', '')).toBe('ela');
        expect(suggestUsername('a'.repeat(40), 'b').length).toBeLessThanOrEqual(32);
    });
});

describe('formatCode', () => {
    it('groups eight-character codes for reading aloud', () => {
        expect(formatCode('ABCD2345')).toBe('ABCD-2345');
        expect(formatCode('ABC')).toBe('ABC');
    });
});
