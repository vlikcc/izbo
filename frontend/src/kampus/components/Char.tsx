// Karakter (prototipte UI.char / UI.react) ve küçük ortak parçalar.
import type { CSSProperties } from 'react';
import { CHARACTERS } from '../core';

import type { CharState } from './useCharReact';
export type { CharState };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const artFor = (c: any, state: string): string | null =>
    typeof c.art === 'string' ? c.art : (c.art && (c.art[state] || c.art.idle)) || null;

type CharProps = {
    id: string;
    state?: CharState;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    label?: boolean;
    /** Aynı duruma yeniden geçişte animasyonu baştan oynatmak için artırılır (useCharReact verir). */
    nonce?: number;
    className?: string;
    speaking?: boolean;
};

/** Çizim yoksa renkli yer tutucu gösterilir. Çizim eklemek için core/data.ts > CHARACTERS > art. */
export function Char({ id, state = 'idle', size = 'md', label = true, nonce = 0, className = '', speaking = false }: CharProps) {
    const c = CHARACTERS[id];
    if (!c) return null;
    const art = artFor(c, state);
    return (
        <div
            key={nonce}
            className={`char char-${size} is-${state}${speaking ? ' speaking' : ''}${className ? ' ' + className : ''}`}
            data-char={id}
            style={{ '--c': c.color } as CSSProperties}
            role="img"
            aria-label={c.name}
        >
            <div className="char-body">
                {art ? (
                    <img src={art} alt={c.name} />
                ) : (
                    <div className="char-ph" aria-hidden="true">
                        <span className="char-initial">{c.name[0]}</span>
                        <span className="char-animal">{c.animal}</span>
                    </div>
                )}
            </div>
            {label && <div className="char-name">{c.name}</div>}
        </div>
    );
}

/**
 * Öğrenci paneli görseli (prototipte pages-student `art()`): karakterin durum görseli img olarak,
 * görseli yoksa yer tutucu karakter, karakter yoksa ✨.
 */
export function CharArt({ id, className = '', state = 'idle' }: { id: string | null | undefined; className?: string; state?: CharState }) {
    const c = id ? CHARACTERS[id] : null;
    if (!c) return <div className={`yz-art-ph ${className}`} aria-hidden="true">✨</div>;
    const src = artFor(c, state);
    return src ? <img className={className} src={src} alt={c.name} /> : <Char id={id as string} size="md" label={false} />;
}

/** Haftalık çalışma ışıkları (UI.lightDots). */
export function LightDots({ n }: { n: number }) {
    return (
        <span className="light-dots" aria-label={`Bu hafta ${n} çalışma`}>
            {[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < n ? 'on' : ''} />)}
        </span>
    );
}

type Gain = { kp?: number; cup?: number; daily?: number; bonus?: number } | null | undefined;

/** Sonuç satırı: [4/5 doğru] · +4 ⭐ · +10 💎 KP (UI.gainHtml). */
export function GainLine({ g, lead = '' }: { g: Gain; lead?: string }) {
    if (!g || (!g.kp && !g.cup && !g.daily && !g.bonus && !lead)) return null;
    return (
        <p className="gain-line">
            {lead && <span className="gain-lead">{lead}</span>}
            {!!g.cup && <span className="gain-cup">+{g.cup} ⭐</span>}
            {!!g.kp && <span className="gain-kp">+{g.kp} 💎 KP</span>}
            {!!g.daily && <span className="gain-daily">🎯 Günlük görev +{g.daily} 💎</span>}
            {!!g.bonus && <span className="gain-daily">🎁 Bonus görev +{g.bonus} 💎</span>}
        </p>
    );
}

/** Güvenilir, kod içinde üretilmiş SVG/HTML dizgilerini (AvatarArt, CupArt, sayı doğrusu) basar. */
export function RawHtml({ html, as: Tag = 'span', className, ...rest }: { html: string; as?: 'span' | 'div'; className?: string; style?: CSSProperties; 'aria-hidden'?: boolean | 'true' }) {
    return <Tag className={className} {...rest} dangerouslySetInnerHTML={{ __html: html }} />;
}
