/* eslint-disable @typescript-eslint/no-explicit-any */
// Soru gövdesi (prototipte stops.js questionHtml + bindQuestion). Durum üst bileşende tutulur
// (questionState.ts); bu bileşen yalnızca çizer ve dokunuşları durum dönüşümlerine çevirir.
import { useEffect, useRef, type CSSProperties } from 'react';
import { sfx } from '../core';
import { MATCH_COLORS, qMatchClick, qPick, qType, type QState } from './questionState';
import { cx } from './util';

type Props = { q: any; s: QState; update: (fn: (s: QState) => QState) => void };

const SIGN_LABEL: Record<string, string> = { '<': 'küçüktür', '>': 'büyüktür', '=': 'eşittir' };

export function Question({ q, s, update }: Props) {
    if (q.type === 'write') return <WriteBox q={q} s={s} update={update} />;
    if (q.type === 'match') return <MatchBox q={q} s={s} update={update} />;

    const optCls = (v: string) => cx('opt', s.sel === v && s.selCls && 'sel', s.ok.includes(v) && 'ok', s.no.includes(v) && 'no');
    const pickOpt = (v: string) => { sfx.tap(); update((p) => qPick(p, v)); };
    const dis = (v: string) => s.locked || s.off.includes(v);

    if (q.type === 'tf') {
        return (
            <div className="opts two tf">
                {([['true', '👍', 'Doğru'], ['false', '👎', 'Yanlış']] as const).map(([v, e, l]) => (
                    <button key={v} className={optCls(v)} type="button" data-v={v} disabled={dis(v)} onClick={() => pickOpt(v)}>
                        <span className="opt-emoji" aria-hidden="true">{e}</span><span className="opt-label">{l}</span>
                    </button>
                ))}
            </div>
        );
    }
    return (
        <div className={cx('opts', q.options.length === 2 && 'two', q.letters && 'letters')}>
            {q.options.map((o: any) => {
                const v = String(o.v);
                return (
                    <button key={v} className={optCls(v)} type="button" data-v={v} disabled={dis(v)} onClick={() => pickOpt(v)}>
                        {o.emoji ? <span className="opt-emoji" aria-hidden="true">{o.emoji}</span> : null}
                        <span className="opt-label">{o.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

function WriteBox({ q, s, update }: Props) {
    const inp = useRef<HTMLInputElement>(null);
    const isSign = q.input === 'sign';
    // Açılışta (50 ms sonra) ve clear() sonrasında girişe odaklanır
    useEffect(() => {
        const first = s.focusN === 0;
        const t = setTimeout(() => inp.current?.focus(first ? { preventScroll: true } : undefined), first ? 50 : 0);
        return () => clearTimeout(t);
    }, [s.focusN]);
    return (
        <div className="write-box">
            <label className="sr-only" htmlFor="wr">Cevabın</label>
            <input
                ref={inp}
                id="wr"
                className={cx('write-in', isSign && 'is-sign', s.inCls)}
                type="text"
                autoComplete="off"
                inputMode={q.input === 'number' ? 'numeric' : undefined}
                maxLength={isSign ? 1 : 6}
                placeholder={isSign ? '?' : 'Cevabını yaz'}
                value={s.text}
                disabled={s.locked}
                onChange={(e) => { const v = e.target.value; update((p) => qType(p, v)); }}
            />
            {isSign && (
                <div className="write-keys">
                    {['<', '>', '='].map((k) => (
                        <button key={k} type="button" className="cmp-sign" data-k={k} aria-label={SIGN_LABEL[k]} disabled={s.locked} onClick={() => update((p) => qType(p, k))}>{k}</button>
                    ))}
                </div>
            )}
        </div>
    );
}

function MatchBox({ q, s, update }: Props) {
    const ownerOf = (r: string) => Object.keys(s.map).find((l) => String(s.map[l]) === r);
    const item = (side: 'l' | 'r', i: number, text: string) => {
        const id = String(i);
        const l = side === 'l' ? (s.map[id] != null ? id : undefined) : ownerOf(id);
        const paired = l != null;
        const fixed = side === 'l' ? s.fixed.includes(id) : !!l && s.fixed.includes(l);
        const style = paired ? ({ '--mc': MATCH_COLORS[Number(l) % MATCH_COLORS.length] } as CSSProperties) : undefined;
        return (
            <button
                key={side + id}
                type="button"
                className={cx('match-item', paired && 'is-paired', side === 'l' && s.selL === id && 'is-sel', (fixed || (paired && s.mcls === 'ok')) && 'ok', paired && s.mcls === 'no-soft' && 'no-soft')}
                data-side={side}
                data-i={id}
                style={style}
                disabled={s.locked || fixed}
                onClick={() => { sfx.tap(); update((p) => qMatchClick(p, side, id)); }}
            >{text}</button>
        );
    };
    return (
        <>
            <div className="match">
                <div className="match-col">{q.pairs.map((p: any, i: number) => item('l', i, p[0]))}</div>
                <div className="match-col">{s.order.map((i) => item('r', i, q.pairs[i][1]))}</div>
            </div>
            <p className="muted small match-help">Soldan birine, sonra sağdan eşine dokun.</p>
        </>
    );
}
