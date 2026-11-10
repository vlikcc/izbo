/* eslint-disable @typescript-eslint/no-explicit-any */
// Tek soru ekranı (prototipte stops.js askQuestion; alıştırma ve mini test ortak).
// mode 'practice': ipucu var, yanlışta tekrar denenir. mode 'test': ipucu yok, tek deneme.
// Akış: Kontrol et → dönüt → (yanlışta) Tekrar dene → … → İleri / Bitir.
import { useEffect, useRef, useState } from 'react';
import { PRAISE, pick, sfx, stopSpeak } from '../core';
import type { CharState } from '../components/useCharReact';
import { Question } from './Question';
import { answerText, isRight } from './questions';
import { qClear, qGiven, qHasReveal, qInit, qLock, qMark, qReveal, type QState } from './questionState';

type Fb = { cls: '' | 'is-hint' | 'is-ok' | 'is-no'; b: string | null; t: string | null };

type Props = {
    q: any;
    mode: 'practice' | 'test';
    index: number;
    total: number;
    say: (text: string, speak?: boolean) => void;
    react: (state: CharState, ms?: number) => void;
    /** answers[q.id] = rec (durak cevapları) */
    onAnswer: (id: string, rec: any) => void;
    /** Mini testte cevap kaydı (prototipte onDone.record). */
    onRecord?: (given: any, ok: boolean) => void;
    onDone: () => void;
};

export function AskQuestion({ q, mode, index, total, say, react, onAnswer, onRecord, onDone }: Props) {
    const [qs, setQs] = useState<QState>(() => qInit(q));
    const [phase, setPhase] = useState<'answer' | 'retry' | 'next'>('answer');
    const [cnt, setCnt] = useState({ wrong: 0, hints: 0, shown: 0, picks: [] as string[] });
    const [fb, setFb] = useState<Fb>({ cls: '', b: null, t: null });
    const [hintHidden, setHintHidden] = useState(false);
    const chk = useRef<HTMLButtonElement>(null);
    const given = qGiven(q, qs);

    useEffect(() => { if (phase === 'next') chk.current?.focus({ preventScroll: true }); }, [phase]);

    const showHint = (c: typeof cnt, fromWrong: boolean) => {
        const H: string[] = q.hints || [];
        if (!H.length) return c;
        const level = Math.min(fromWrong ? c.wrong - 1 : c.shown, H.length - 1);
        const next = { ...c, shown: Math.max(c.shown, level + 1), hints: fromWrong ? c.hints : c.hints + 1 };
        react('hint');
        say(H[level], true);
        setFb({ cls: 'is-hint', b: fromWrong ? 'Bir ipucu:' : 'İpucu:', t: H[level] });
        return next;
    };

    const onCheck = () => {
        if (phase === 'next') { stopSpeak(); onDone(); return; }
        if (phase === 'retry') {
            setPhase('answer');
            setQs((s) => qClear(q, s));
            setFb((f) => ({ ...f, cls: '' }));
            return;
        }
        if (given == null) return;
        const ok = isRight(q, given);
        const pickOf = typeof given === 'string' ? given : 'eşleştirme';
        if (mode === 'test') {
            let s = qLock(qMark(q, qs, ok));
            if (!ok && qHasReveal(q)) s = qReveal(q, s);
            setQs(s);
            onAnswer(q.id, { step: 'check', wrong: ok ? 0 : 1, hints: 0, picks: ok ? [] : [pickOf] });
            if (ok) { sfx.correct(); react('correct', 1000); }
            else { sfx.wrong(); react('hint', 1200); }
            setFb(ok ? { cls: 'is-ok', b: pick(PRAISE), t: null } : { cls: 'is-no', b: 'Doğru cevap:', t: answerText(q) });
            onRecord?.(given, ok);
            setPhase('next');
            return;
        }
        if (ok) {
            setQs(qLock(qMark(q, qs, true)));
            setHintHidden(true);
            sfx.correct(); react('correct', 1000);
            const p = pick(PRAISE); say(p);
            setFb({ cls: 'is-ok', b: p, t: null });
            onAnswer(q.id, { step: 'practice', wrong: cnt.wrong, hints: cnt.hints, picks: cnt.picks });
            setPhase('next');
            return;
        }
        const c = { ...cnt, wrong: cnt.wrong + 1, picks: [...cnt.picks, pickOf] };
        sfx.wrong();
        let s = qMark(q, qs, false);
        if (c.wrong >= 2) {
            s = qLock(s); if (qHasReveal(q)) s = qReveal(q, s);
            setQs(s);
            setHintHidden(true);
            react('hint', 1500);
            say('Sorun değil, birlikte bakalım. Doğru cevap: ' + answerText(q), true);
            setFb({ cls: 'is-hint', b: 'Doğru cevap:', t: answerText(q) });
            setCnt(c);
            onAnswer(q.id, { step: 'practice', wrong: c.wrong, hints: c.hints, picks: c.picks });
            setPhase('next');
            return;
        }
        setQs(s);
        setCnt(showHint(c, true));
        setPhase('retry');
    };

    const label = phase === 'next' ? (index === total - 1 ? 'Bitir ✓' : 'İleri →') : phase === 'retry' ? 'Tekrar dene' : 'Kontrol et';
    const suffix = q.type === 'tf' ? ' · Doğru mu, yanlış mı?' : q.type === 'match' ? ' · Eşleştir' : q.type === 'write' ? ' · Cevabı yaz' : '';
    return (
        <>
            <div className="question">
                <div className="q-meta">{mode === 'test' ? 'Mini Test' : 'Alıştırma'} · <b>{index + 1}/{total}</b>{suffix}</div>
                <h2 className="q-text">{q.prompt}</h2>
                <div id="qbox"><Question q={q} s={qs} update={setQs} /></div>
            </div>
            <div className={`player-actions feedback${fb.cls ? ' ' + fb.cls : ''}`} id="pfb">
                <div className="fb-msg" id="fbmsg" aria-live="polite">{fb.b != null && <><b>{fb.b}</b>{fb.t != null && <> {fb.t}</>}</>}</div>
                {mode === 'practice' && q.hints ? (
                    <button className="btn btn-hint" id="hint" type="button" hidden={hintHidden} onClick={() => setCnt(showHint(cnt, false))}>💡 İpucu</button>
                ) : null}
                <button ref={chk} className="btn btn-primary btn-lg" id="chk" type="button" disabled={phase === 'answer' && given == null} onClick={onCheck}>{label}</button>
            </div>
        </>
    );
}
