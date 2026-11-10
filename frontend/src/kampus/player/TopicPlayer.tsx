/* eslint-disable @typescript-eslint/no-explicit-any */
// Konu oynatıcı (prototipte js/player.js Player.mount): İzle → Uygula → Kendini kontrol et.
// Karakter davranışları (ilk sürüm): ipucu düğmesi baştan görünür, hatadan sonra soruya özel
// adım adım ipucu, doğru cevapta kısa tepki, 1. sınıfta yönergeye dokununca ses yeniden çalar.
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PRAISE, STOP_TYPES, Store, TOPICS, confetti, pick, sfx, speak, stopSpeak, toast, topicChar, useKampus } from '../core';
import { GainLine } from '../components/Char';
import type { CharState } from '../components/useCharReact';
import { Bubble } from '../stops/Bubble';
import { Lines } from '../stops/Visual';
import { cx, withQ } from '../stops/util';
import { StageChar, type StageCharHandle } from './StageChar';
import { compareInfo } from './compareInfo';

export type TopicPlayerProps = { topicId: string; guest?: boolean; student?: any; exitHref: string; stopId?: string | null };

type StepKey = 'watch' | 'compare' | 'practice' | 'check';
type Step = { key: StepKey; label: string; items: any[] };
type Said = { text: string; voice: string | null; speaker: string };
type Fb = { cls: 'is-hint' | 'is-ok'; b: string; t?: string };

type Ctx = {
    topic: any;
    say: (text: string, voice: string | null, speaker: string) => void;
    react: (id: string, state: CharState, ms?: number) => void;
    record: (id: string, rec: any) => void;
    next: () => void;
};

function buildSteps(topic: any, stopId: string | null): Step[] {
    const stopStep = stopId ? (STOP_TYPES[stopId] || {}).step : null;
    const steps: Step[] = [
        { key: 'watch', label: topic.meeting ? 'Hikâye' : 'İzle', items: topic.watch || [] },
        { key: 'compare', label: topic.compare ? topic.compare.title : 'Etkinlik', items: topic.compare ? topic.compare.items : [] },
        { key: 'practice', label: 'Uygula', items: topic.practice || [] },
        { key: 'check', label: 'Kendini kontrol et', items: topic.check || [] },
    ];
    return steps.filter((s) => s.items.length && (!stopStep || s.key === stopStep) && (stopStep || s.key !== 'compare'));
}

/** Ekran açılınca karakterin söylediği (prototipte renderSlide / renderQuestion / renderCompare içindeki say()). */
function screenSay(topic: any, chars: string[], step: Step, item: any): Said {
    if (step.key === 'watch') return { text: item.text, voice: item.say || null, speaker: item.char || chars[0] };
    if (step.key === 'compare') return { text: topic.compare.prompt, voice: null, speaker: topicChar(topic, undefined) };
    return { text: item.prompt, voice: item.say || null, speaker: topicChar(topic, item) };
}

export function TopicPlayer({ topicId, guest = false, student = null, exitHref, stopId = null }: TopicPlayerProps) {
    useKampus();
    const navigate = useNavigate();
    const topic = TOPICS[topicId];
    const [steps] = useState(() => buildSteps(topic, stopId));
    const chars: string[] = useMemo(() => (topic.meeting ? topic.chars : [topicChar(topic, undefined)]), [topic]);
    const total = steps.reduce((n, s) => n + s.items.length, 0);
    const answers = useRef<Record<string, any>>({});
    const charRefs = useRef<Record<string, StageCharHandle | null>>({});
    const stageRef = useRef<HTMLElement>(null);
    const [pos, setPos] = useState({ si: 0, ii: 0 });
    const [fin, setFin] = useState<null | { kind: 'stop'; r: any; label: string; back: string } | { kind: 'full'; weakSkills: string[] }>(null);
    const [bub, setBub] = useState<(Said & { at: string; n: number }) | null>(null);
    const sayN = useRef(0);
    const backTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const step = steps[pos.si];
    const screenKey = fin ? 'done' : `${pos.si}:${pos.ii}`;

    useEffect(() => () => clearTimeout(backTimer.current), []);
    useEffect(() => {
        if (stopId && student && !guest) Store.startStop(student.id, topicId, stopId);
    }, [stopId, student, guest, topicId]);

    const reactChar = (id: string | undefined, state: CharState, ms?: number) => {
        const h = (id && charRefs.current[id]) || charRefs.current[chars[0]];
        h?.react(state, ms);
    };
    const reactAll = (state: CharState) => chars.forEach((c) => charRefs.current[c]?.react(state));

    // Ekran değişince yönerge (sesli konularda ya da kayıtlı ses varsa) okunur
    useEffect(() => {
        if (fin) return;
        const st = steps[pos.si];
        if (!st) return;
        const d = screenSay(topic, chars, st, st.items[pos.ii]);
        if (topic.audioFirst || d.voice) speak(d.voice || d.text);
    }, [fin, pos, steps, topic, chars]);

    // Doğrudan "Kendini kontrol et" ile açılırsa kısa geçiş tepkisi
    useEffect(() => {
        if (steps[0] && steps[0].key === 'check') (charRefs.current[chars[0]])?.react('correct', 900);
    }, [steps, chars]);

    const say = (text: string, voice: string | null, speaker: string, at = screenKey) => {
        setBub({ at, text, voice, speaker, n: ++sayN.current });
        if (topic.audioFirst || voice) speak(voice || text);
    };

    async function finishStop() {
        stopSpeak();
        let r: any = { stars: 0 };
        if (!guest && student) {
            try { r = await Store.saveStop(student.id, topicId, stopId, answers.current); }
            catch (e) { toast((e as Error).message); return; }
        }
        const label = STOP_TYPES[stopId as string] ? (stopId === 'etkinlik' ? topic.compare.title : STOP_TYPES[stopId as string].label) : 'Durak';
        reactAll('happy');
        sfx.done();
        confetti(stageRef.current);
        say(r.allDone ? 'Bu konunun bütün duraklarını bitirdin!' : 'Harika iş çıkardın!', null, chars[0], 'done');
        const back = withQ(exitHref, 'tamam=' + stopId);
        setFin({ kind: 'stop', r, label, back });
        if (!r.allDone) backTimer.current = setTimeout(() => { if (window.location.pathname.startsWith('/ogrenci/konu/')) navigate(back); }, 2400);
    }

    function finish() {
        if (stopId) { void finishStop(); return; }
        stopSpeak();
        // Konu kaydı sunucuya gider (bekleyen ödev varsa ona bağlanır); kutlama beklemeden gösterilir
        if (!guest && student) Store.saveAttempt(student.id, topicId, answers.current).catch((e: Error) => toast(e.message));
        const A = answers.current;
        const weak = [...(topic.practice || []), ...(topic.check || [])].filter((q: any) => A[q.id] && ((A[q.id].step === 'check' && A[q.id].wrong > 0) || A[q.id].wrong >= 2));
        const weakSkills = [...new Set(weak.map((q: any) => q.skill as string))];
        reactAll('happy');
        sfx.done();
        confetti(stageRef.current);
        say(guest ? 'Dersi bitirdin! Seninle gurur duyuyoruz!' : 'Bu konuyu bitirdin!', null, chars[0], 'done');
        setFin({ kind: 'full', weakSkills });
    }

    function next() {
        stopSpeak();
        let { si, ii } = pos;
        ii++;
        if (ii >= steps[si].items.length) { si++; ii = 0; }
        if (si >= steps.length) { finish(); return; }
        setPos({ si, ii });
        if (ii === 0 && steps[si].key === 'check') reactChar(undefined, 'correct', 900); // kısa geçiş
    }

    const ctx: Ctx = {
        topic,
        say: (t, v, sp) => say(t, v, sp),
        react: reactChar,
        record: (id, rec) => { answers.current[id] = rec; },
        next,
    };

    // ---- Balon ----
    const def: Said | null = !fin && step ? screenSay(topic, chars, step, step.items[pos.ii]) : null;
    const shown: (Said & { n?: number }) | null = bub && bub.at === screenKey ? bub : def;
    const canReplay = !!(shown && shown.voice) || !!topic.audioFirst;
    const speaker = shown ? shown.speaker : null;

    // ---- İlerleme ----
    const before = steps.slice(0, pos.si).reduce((n, s) => n + s.items.length, 0) + pos.ii;
    const barW = fin ? 100 : total ? before / total * 100 : 0;
    const allDone = !!fin && fin.kind === 'full';

    // ---- Gövde ----
    let body: ReactNode = null;
    if (fin && fin.kind === 'stop') {
        const { r, label, back } = fin;
        body = (
            <div className="done">
                <div className="done-badge">🎉</div>
                <h2>{label} tamamlandı!</h2>
                <GainLine g={r} />
                {r.allDone ? <p>{topic.learned}.</p> : <p className="muted">Patikaya dönüyoruz…</p>}
                <div className="done-actions"><Link className="btn btn-primary btn-lg" to={back}>Patikaya dön</Link></div>
            </div>
        );
    } else if (fin) {
        body = (
            <div className="done">
                <div className="done-badge">🎉</div>
                <h2>Bugün ne öğrendin?</h2>
                <p className="done-learned">{topic.learned}.</p>
                {fin.weakSkills.length ? <p className="done-repeat">Biraz daha tekrar edebilirsin: <b>{fin.weakSkills.join(', ')}</b></p> : null}
                {guest ? (
                    <>
                        <p className="muted">Bu, platformdaki bir dersin tamamıydı: kısa anlatım, etkinlik ve kendini kontrol.</p>
                        <div className="done-actions">
                            <Link className="btn btn-primary btn-lg" to="/paketler">Üyelik paketlerini gör</Link>
                            <Link className="btn btn-ghost" to="/ornek-ders">Diğer örnek ders</Link>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="done-light">
                            <img className="done-maskot" src="/kampus/assets/karakterler/maskot.png" alt="" />
                            <div><b>Ödevini bitirdin!</b><span className="muted">💎 {student ? Store.stars(student.id) : 0} KP bakiyen var.</span></div>
                        </div>
                        <div className="done-actions">
                            <Link className="btn btn-primary btn-lg" to="/ogrenci">Ana sayfaya dön</Link>
                            <Link className="btn btn-ghost" to="/ogrenci/derslerim">Derslerim</Link>
                        </div>
                    </>
                )}
            </div>
        );
    } else if (step && step.key === 'watch') {
        body = (
            <SlideView
                key={screenKey}
                sl={step.items[pos.ii]}
                first={pos.ii === 0}
                fwdLabel={pos.ii === step.items.length - 1 ? (pos.si === steps.length - 1 ? 'Bitir ✓' : 'Uygulamaya geç →') : 'İleri →'}
                onPrev={() => setPos({ si: pos.si, ii: pos.ii - 1 })}
                onNext={next}
            />
        );
    } else if (step && step.key === 'compare') {
        body = <CompareView key={screenKey} pair={step.items[pos.ii]} ii={pos.ii} n={step.items.length} ctx={ctx} />;
    } else if (step) {
        body = <ChoiceView key={screenKey} q={step.items[pos.ii]} stepKey={step.key} ii={pos.ii} n={step.items.length} ctx={ctx} />;
    }

    return (
        <div className="player">
            <div className="player-top">
                <Link className="btn btn-ghost btn-sm" to={exitHref} aria-label="Dersten çık">✕ Çık</Link>
                <div className="player-title">{topic.title}</div>
                <ol className="steps">
                    {steps.map((s, i) => (
                        <li key={s.key} data-i={i} className={cx(!allDone && i === pos.si && 'on', (allDone || i < pos.si) && 'done') || undefined}>{s.label}</li>
                    ))}
                </ol>
            </div>
            <div className="pbar" aria-hidden="true"><span style={{ width: barW + '%' }} /></div>
            <div className="player-main">
                <section className="player-stage" aria-label="Karakter" ref={stageRef}>
                    <Bubble
                        text={shown ? shown.text : ''}
                        onReplay={canReplay && shown ? () => speak(shown.voice || shown.text) : null}
                        replayLabel="Yönergeyi tekrar dinle"
                        popKey={bub && bub.at === screenKey ? 'o' + bub.n : 's' + screenKey}
                    />
                    <div className="stage-chars">
                        {chars.map((c) => (
                            <StageChar key={c} id={c} speaking={chars.length > 1 && speaker === c} ref={(h) => { charRefs.current[c] = h; }} />
                        ))}
                    </div>
                </section>
                <section className="player-body" id="pbody">{body}</section>
            </div>
        </div>
    );
}

// ---- İzle: slayt ----
function SlideView({ sl, first, fwdLabel, onPrev, onNext }: { sl: any; first: boolean; fwdLabel: string; onPrev: () => void; onNext: () => void }) {
    const fwd = useRef<HTMLButtonElement>(null);
    useEffect(() => { fwd.current?.focus({ preventScroll: true }); }, []);
    return (
        <>
            <div className="slide">
                <div className={cx('slide-visual', sl.big && 'is-big', sl.list && 'is-list')}><Lines text={sl.visual} /></div>
                <div className="slide-note">Animasyon yer tutucu</div>
            </div>
            <div className="player-actions">
                <button className="btn btn-ghost" id="prev" type="button" disabled={first} onClick={onPrev}>← Geri</button>
                <button className="btn btn-primary btn-lg" id="fwd" type="button" ref={fwd} onClick={onNext}>{fwdLabel}</button>
            </div>
        </>
    );
}

// ---- Soru başına deneme sayaçları ve ipucu akışı (seçmeli soru ve karşılaştırma ortak) ----
type Cur = { wrong: number; hints: number; shown: number; picks: string[]; solved: boolean; fb: Fb | null };
const newCur = (): Cur => ({ wrong: 0, hints: 0, shown: 0, picks: [], solved: false, fb: null });

function hintStep(ctx: Ctx, q: any, sp: string, cur: Cur, fromWrong: boolean): Cur {
    const H: string[] = q.hints || [];
    if (!H.length) return cur;
    const level = Math.min(fromWrong ? cur.wrong - 1 : cur.shown, H.length - 1);
    ctx.react(sp, 'hint');
    ctx.say(H[level], ctx.topic.audioFirst ? H[level] : null, sp);
    return {
        ...cur,
        shown: Math.max(cur.shown, level + 1),
        hints: fromWrong ? cur.hints : cur.hints + 1,
        fb: { cls: 'is-hint', b: fromWrong ? 'Bir ipucu:' : 'İpucu:', t: H[level] },
    };
}

function solvedCur(ctx: Ctx, cur: Cur, sp: string, id: string, step: string): Cur {
    sfx.correct();
    ctx.react(sp, 'correct', 1000);
    const praise = pick(PRAISE);
    ctx.say(praise, null, sp);
    ctx.record(id, { step, wrong: cur.wrong, hints: cur.hints, picks: cur.picks });
    return { ...cur, solved: true, fb: { cls: 'is-ok', b: praise } };
}

function Feedback({ cur, onHint, fwdRef, onNext }: { cur: Cur; onHint: () => void; fwdRef: RefObject<HTMLButtonElement | null>; onNext: () => void }) {
    return (
        <div className={`player-actions feedback${cur.fb ? ' ' + cur.fb.cls : ''}`} id="pfb">
            <div className="fb-msg" id="fbmsg" aria-live="polite">{cur.fb ? <><b>{cur.fb.b}</b>{cur.fb.t != null ? <> {cur.fb.t}</> : null}</> : null}</div>
            <button className="btn btn-hint" id="hint" type="button" hidden={cur.solved} onClick={onHint}>💡 İpucu</button>
            <button className="btn btn-primary btn-lg" id="fwd" type="button" ref={fwdRef} hidden={!cur.solved} onClick={onNext}>Devam →</button>
        </div>
    );
}

// ---- Uygula / Kendini kontrol et: dokununca cevaplanan seçmeli soru ----
function ChoiceView({ q, stepKey, ii, n, ctx }: { q: any; stepKey: StepKey; ii: number; n: number; ctx: Ctx }) {
    const sp = topicChar(ctx.topic, q);
    const [cur, setCur] = useState<Cur>(newCur);
    const [okV, setOkV] = useState<string | null>(null);
    const [noVs, setNoVs] = useState<string[]>([]);
    const fwd = useRef<HTMLButtonElement>(null);
    useEffect(() => { if (cur.solved) fwd.current?.focus({ preventScroll: true }); }, [cur.solved]);
    const ans = String(q.answer);
    const pulse = cur.wrong >= 2 && !cur.solved;

    const answer = (v: string) => {
        if (cur.solved) return;
        if (v === ans) {
            setOkV(v);
            setCur(solvedCur(ctx, cur, sp, q.id, stepKey));
        } else {
            setNoVs([...noVs, v]);
            sfx.wrong();
            setCur(hintStep(ctx, q, sp, { ...cur, wrong: cur.wrong + 1, picks: [...cur.picks, v] }, true));
        }
    };

    return (
        <>
            <div className="question">
                <div className="q-meta">{stepKey === 'check' ? 'Kendini kontrol et' : 'Uygula'} · {ii + 1}/{n}</div>
                <h2 className="q-text">{q.prompt}</h2>
                <div className={cx('opts', q.options.length === 2 && 'two', q.letters && 'letters')}>
                    {q.options.map((o: any) => {
                        const v = String(o.v);
                        const no = noVs.includes(v);
                        return (
                            <button key={v} className={cx('opt', okV === v && 'ok', no && 'no', pulse && v === ans && 'pulse')} type="button" data-v={v} disabled={cur.solved || no} onClick={() => answer(v)}>
                                {o.emoji ? <span className="opt-emoji" aria-hidden="true">{o.emoji}</span> : null}
                                <span className="opt-label">{o.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            <Feedback cur={cur} onHint={() => setCur(hintStep(ctx, q, sp, cur, false))} fwdRef={fwd} onNext={ctx.next} />
        </>
    );
}

// ---- Etkinlik: işareti kutuya sürükle ya da işarete dokun ----
const SIGN_LABEL: Record<string, string> = { '<': 'küçüktür', '>': 'büyüktür', '=': 'eşittir' };

function CompareView({ pair, ii, n, ctx }: { pair: [number, number]; ii: number; n: number; ctx: Ctx }) {
    const [a, b] = pair;
    const topic = ctx.topic;
    const [q] = useState(() => { const info = compareInfo(a, b); return { id: `cmp-${ii}`, hints: info.hints, answer: info.sign, skill: 'Sayıları karşılaştırma' }; });
    const sp = topicChar(topic, undefined);
    const [cur, setCur] = useState<Cur>(newCur);
    const [slot, setSlot] = useState<{ v: string; cls: '' | 'ok' | 'no' }>({ v: '?', cls: '' });
    const [over, setOver] = useState(false);
    const fwd = useRef<HTMLButtonElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);
    useEffect(() => { if (cur.solved) fwd.current?.focus({ preventScroll: true }); }, [cur.solved]);
    const pulse = cur.wrong >= 2 && !cur.solved;

    const placeSign = (v: string) => {
        if (cur.solved || !v) return;
        if (v === q.answer) {
            setSlot({ v, cls: 'ok' });
            setCur(solvedCur(ctx, cur, sp, q.id, 'compare'));
        } else {
            setSlot({ v, cls: 'no' });
            sfx.wrong();
            timer.current = setTimeout(() => setSlot((s) => (s.cls === 'ok' ? s : { v: '?', cls: '' })), 700);
            setCur(hintStep(ctx, q, sp, { ...cur, wrong: cur.wrong + 1, picks: [...cur.picks, v] }, true));
        }
    };

    return (
        <>
            <div className="question compare">
                <div className="q-meta">{topic.compare.title} · {ii + 1}/{n}</div>
                <h2 className="q-text">{topic.compare.prompt}</h2>
                <div className="cmp-row">
                    <span className="cmp-num">{a}</span>
                    <button
                        className={cx('cmp-slot', slot.cls, over && 'over')}
                        id="slot"
                        type="button"
                        aria-label={cur.solved ? 'İşaret kutusu: ' + slot.v : 'İşaret kutusu, boş'}
                        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                        onDragLeave={() => setOver(false)}
                        onDrop={(e) => { e.preventDefault(); setOver(false); placeSign(e.dataTransfer.getData('text/plain')); }}
                    >{slot.v}</button>
                    <span className="cmp-num">{b}</span>
                </div>
                <p className="cmp-help muted small">İşareti kutuya sürükle ya da işarete dokun.</p>
                <div className="cmp-signs">
                    {['<', '>', '='].map((g) => (
                        <button
                            key={g}
                            className={cx('cmp-sign', pulse && g === q.answer && 'pulse')}
                            type="button"
                            draggable
                            data-v={g}
                            aria-label={`${SIGN_LABEL[g]} işareti`}
                            disabled={cur.solved}
                            onClick={() => placeSign(g)}
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', g)}
                        >{g}</button>
                    ))}
                </div>
            </div>
            <Feedback cur={cur} onHint={() => setCur(hintStep(ctx, q, sp, cur, false))} fwdRef={fwd} onNext={ctx.next} />
        </>
    );
}
