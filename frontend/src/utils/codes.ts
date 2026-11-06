/** "ABCD2345" → "ABCD-2345": join and guardian codes are read aloud and typed by children. */
export const formatCode = (code: string) =>
    code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

/** Suggests a sign-in name from a child's name: "Ela Yılmaz" → "ela.yilmaz". */
export function suggestUsername(firstName: string, lastName: string): string {
    const ascii = (s: string) => s
        .toLocaleLowerCase('tr-TR')
        .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '');
    return [ascii(firstName), ascii(lastName)].filter(Boolean).join('.').slice(0, 32);
}

/** Same rule the server enforces for user names. */
export const USERNAME_PATTERN = /^[a-z0-9._]{4,32}$/;
