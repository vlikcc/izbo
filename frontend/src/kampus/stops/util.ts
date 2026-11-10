// Oynatıcıların küçük ortak yardımcıları.

/** Sınıf adlarını birleştirir (boş/yanlış değerleri atlar). */
export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ');

/** Adrese sorgu ekler: /a → /a?x=1, /a?y=2 → /a?y=2&x=1 (prototipte `href + (href.includes('?') ? '&' : '?') + …`). */
export const withQ = (href: string, q: string) => href + (href.includes('?') ? '&' : '?') + q;
