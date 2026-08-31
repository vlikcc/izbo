import { describe, expect, it } from 'vitest';
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH, validatePassword } from '../utils/passwordPolicy';

describe('passwordPolicy', () => {
    it('rejects short passwords', () => {
        expect(validatePassword('Short1')).toContain(String(PASSWORD_MIN_LENGTH));
    });

    it('rejects a single character class', () => {
        expect(validatePassword('aaaaaaaaaa')).not.toBeNull();
    });

    it('accepts a mixed password', () => {
        expect(validatePassword('correct horse 9')).toBeNull();
    });

    it('exposes a Turkish hint', () => {
        expect(PASSWORD_HINT).toContain('karakter');
    });
});
