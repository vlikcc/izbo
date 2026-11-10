// Soru yardımcıları (prototipte stops.js "Soru yardımcıları"): doğruluk kontrolü ve cevap metinleri.
/* eslint-disable @typescript-eslint/no-explicit-any */

export const norm = (s: unknown) =>
    String(s == null ? '' : s).replace(/\s+/g, '').replace(/[＜‹]/g, '<').replace(/[＞›]/g, '>').toLocaleLowerCase('tr');

export function isRight(q: any, given: any): boolean {
    if (given == null) return false;
    if (q.type === 'tf') return given === String(q.answer);
    if (q.type === 'write') return ([] as any[]).concat(q.answer).some((a) => norm(a) === norm(given));
    if (q.type === 'match') return q.pairs.every((_p: any, i: number) => given[i] === i);
    return given === q.answer;
}

export function answerText(q: any): string {
    if (q.type === 'tf') return q.answer ? 'Doğru' : 'Yanlış';
    if (q.type === 'write') return ([] as any[]).concat(q.answer)[0];
    if (q.type === 'match') return q.pairs.map((p: any) => `${p[0]} → ${p[1]}`).join(' · ');
    const o = q.options.find((o: any) => o.v === q.answer); return o ? o.label : q.answer;
}

export function givenText(q: any, g: any): string {
    if (g == null) return '—';
    if (q.type === 'tf') return g === 'true' ? 'Doğru' : 'Yanlış';
    if (q.type === 'match') return 'Eşleştirme';
    if (q.type === 'choice') { const o = q.options.find((o: any) => o.v === g); return o ? o.label : g; }
    return g;
}
