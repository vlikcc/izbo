// Ortak arayüz yardımcıları (prototipte js/ui.js): ses, konuşma, bildirim, konfeti, tarih biçimleri.
// Karakter, ışık noktaları ve kazanç satırı React bileşeni olarak components/ altında.
import { Store } from './store';

/** Ham HTML/SVG dizgileri üreten yardımcılar (avatar çizimi, yazdırma sayfası) için kaçış. JSX zaten kaçırır. */
export const esc = (s: unknown): string =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export const PRAISE = ['Harika!', 'Doğru!', 'Çok iyi!', 'Aynen öyle!', 'Süper!'];
export const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
export const shuffle = <T,>(a: T[]): T[] => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

// ---- Ses efektleri ----
let actx: AudioContext | undefined;
function tone(freqs: number[], dur = 0.12, type: OscillatorType = 'sine', vol = 0.12) {
    if (!Store.prefs().sound) return;
    try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        actx = actx || new Ctor();
        const ctx = actx;
        freqs.forEach((f, i) => {
            const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * dur;
            o.type = type; o.frequency.value = f;
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.6);
            o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur * 1.8);
        });
    } catch { /* ses yok */ }
}
export const sfx = {
    correct: () => tone([660, 880]),
    wrong: () => tone([330, 294], 0.14, 'sine', 0.06),
    done: () => tone([523, 659, 784, 1047], 0.12, 'triangle'),
    tap: () => tone([520], 0.05, 'sine', 0.05),
};

// ---- Konuşma (kayıtlı seslendirme gelene kadar tarayıcı sesi) ----
export function speak(text?: string) {
    if (!Store.prefs().voice || !('speechSynthesis' in window) || !text) return;
    try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/["“”]/g, ''));
        u.lang = 'tr-TR'; u.rate = 0.95; u.pitch = 1.15;
        speechSynthesis.speak(u);
    } catch { /* konuşma yok */ }
}
export function stopSpeak() {
    try { speechSynthesis.cancel(); } catch { /* konuşma yok */ }
}

// ---- Bildirim: <KampusToasts/> dinler ----
export type KampusToast = { id: number; msg: string; type: string };
const toastListeners = new Set<(t: KampusToast) => void>();
let toastSeq = 0;
export function toast(msg: string, type: 'info' | 'ok' = 'info') {
    const t = { id: ++toastSeq, msg, type };
    toastListeners.forEach((fn) => fn(t));
}
export function onToast(fn: (t: KampusToast) => void) {
    toastListeners.add(fn);
    return () => { toastListeners.delete(fn); };
}

/** Konfeti: host öğesinin içine geçici bir katman ekler (2,6 sn sonra kendini siler). */
export function confetti(host: HTMLElement | null | undefined, n = 40) {
    if (!host || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div'); box.className = 'confetti';
    const cols = ['#FF7A45', '#F2B705', '#2FA866', '#1AA6B7', '#7C5CF0', '#E25A86'];
    for (let i = 0; i < n; i++) {
        const c = document.createElement('i');
        c.style.left = Math.random() * 100 + '%';
        c.style.background = cols[i % cols.length];
        c.style.animationDelay = Math.random() * 0.4 + 's';
        box.appendChild(c);
    }
    host.appendChild(box);
    setTimeout(() => box.remove(), 2600);
}

export const dateFmt = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
export const dayFmt = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { weekday: 'long' });

/** Tüm YZ Kampüs sayfalarını saran .kampus kökü (pencereler ve açılır kutular buraya portallanır). */
export const kampusRoot = (): HTMLElement => document.getElementById('kampus-root') || document.body;
