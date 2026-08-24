/**
 * Mirrors the server's password policy so the requirement is visible before the request is sent.
 * The server remains the authority; this only saves a round trip.
 */
export const PASSWORD_MIN_LENGTH = 10;

export const PASSWORD_HINT = `En az ${PASSWORD_MIN_LENGTH} karakter ve en az iki farklı karakter türü (küçük harf, büyük harf, rakam, sembol).`;

export function validatePassword(password: string): string | null {
    if (password.length < PASSWORD_MIN_LENGTH) {
        return `Parola en az ${PASSWORD_MIN_LENGTH} karakter olmalıdır.`;
    }

    const classes = [/[a-zçğıöşü]/, /[A-ZÇĞIİÖŞÜ]/, /[0-9]/, /[^\p{L}\p{N}]/u]
        .filter((pattern) => pattern.test(password)).length;

    if (classes < 2) {
        return 'Parola en az iki farklı karakter türü içermelidir (küçük harf, büyük harf, rakam, sembol).';
    }

    return null;
}
