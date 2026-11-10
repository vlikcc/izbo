/* eslint-disable @typescript-eslint/no-explicit-any */
// Soru gövdesinin durumu (prototipte stops.js bindQuestion). Prototipteki denetim nesnesi
// { lock, clear, mark, reveal } burada saf durum dönüşümleri olarak yazıldı; <Question/> bu durumu çizer.
import { shuffle } from '../core';

export type QState = {
    // Seçmeli / doğru-yanlış
    /** Son seçilen seçenek (prototipte selBtn). */
    sel: string | null;
    /** selBtn üzerinde "sel" sınıfı duruyor mu (mark() sınıfı kaldırır ama selBtn kalır). */
    selCls: boolean;
    no: string[];
    ok: string[];
    off: string[];
    // Yazma
    text: string;
    inCls: '' | 'ok' | 'no';
    /** clear() girişe yeniden odaklanır; artınca odaklanılır. */
    focusN: number;
    // Eşleştirme
    /** Sağ sütunun karışık sırası (soru başına bir kez). */
    order: number[];
    /** sol sıra → sağ sıra (prototipteki gibi dizgi anahtarlar) */
    map: Record<string, string>;
    selL: string | null;
    /** clear() ile doğru diye kilitlenen sol öğeler. */
    fixed: string[];
    mcls: '' | 'ok' | 'no-soft';
    // Ortak
    locked: boolean;
};

export const MATCH_COLORS = ['#FF8A3D', '#1E88E5', '#8E5CF7', '#E25A86', '#58B947'];

/** Yeni soru durumu. Eşleştirme sırası burada karıştırılır (useState başlatıcısında çağrılır). */
export function qInit(q: any): QState {
    return {
        sel: null, selCls: false, no: [], ok: [], off: [],
        text: '', inCls: '', focusN: 0,
        order: q.type === 'match' ? shuffle(q.pairs.map((_: any, i: number) => i)) : [],
        map: {}, selL: null, fixed: [], mcls: '',
        locked: false,
    };
}

/** onChange(given | null) karşılığı: cevap tamamlandıysa verilen cevap, değilse null. */
export function qGiven(q: any, s: QState): any {
    if (q.type === 'write') return s.text.trim() ? s.text.trim() : null;
    if (q.type === 'match') {
        return Object.keys(s.map).length === q.pairs.length
            ? Object.fromEntries(Object.entries(s.map).map(([l, r]) => [l, Number(r)]))
            : null;
    }
    return s.sel;
}

// ---- Kullanıcı etkileşimleri ----
export const qPick = (s: QState, v: string): QState => ({ ...s, sel: v, selCls: true });
export const qType = (s: QState, text: string): QState => ({ ...s, text });

export function qMatchClick(s: QState, side: 'l' | 'r', i: string): QState {
    const map = { ...s.map };
    let selL = s.selL;
    if (side === 'l') {
        if (map[i] != null) delete map[i];
        selL = selL === i ? null : i;
    } else {
        const owner = Object.keys(map).find((l) => String(map[l]) === i);
        if (owner != null) delete map[owner];
        if (selL != null) { map[selL] = i; selL = null; }
    }
    return { ...s, map, selL, mcls: '' }; // paint() no-soft'u kaldırır
}

// ---- Denetim (lock / clear / mark / reveal) ----
export const qLock = (s: QState): QState => ({ ...s, locked: true });

export function qClear(q: any, s: QState): QState {
    if (q.type === 'write') return { ...s, text: '', inCls: s.inCls === 'no' ? '' : s.inCls, focusN: s.focusN + 1 };
    if (q.type === 'match') {
        // Yanlış eşleşmeleri çöz, doğruları kilitle
        const map = { ...s.map };
        const fixed = [...s.fixed];
        Object.keys(map).forEach((l) => {
            if (Number(map[l]) === Number(l)) { if (!fixed.includes(l)) fixed.push(l); }
            else delete map[l];
        });
        return { ...s, map, fixed, mcls: '' };
    }
    if (s.sel == null) return s;
    return { ...s, selCls: false, no: [...s.no, s.sel], off: [...s.off, s.sel], sel: null };
}

export function qMark(q: any, s: QState, ok: boolean): QState {
    if (q.type === 'write') return { ...s, inCls: ok ? 'ok' : 'no' };
    if (q.type === 'match') return { ...s, mcls: ok ? 'ok' : 'no-soft' };
    if (s.sel == null) return s;
    return { ...s, selCls: false, ok: ok ? [...s.ok, s.sel] : s.ok, no: ok ? s.no : [...s.no, s.sel] };
}

/** Yalnızca seçmeli / doğru-yanlış sorularda vardır (prototipte ctl.reveal). */
export const qHasReveal = (q: any) => q.type !== 'write' && q.type !== 'match';
export const qReveal = (q: any, s: QState): QState => ({ ...s, ok: [...s.ok, String(q.answer)] });
