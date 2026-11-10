/* eslint-disable @typescript-eslint/no-explicit-any */
// Durak oynatıcı (prototipte stops.js Stops.mount):
// 🎧 Konu Anlatımı (video) · ✏️ Alıştırmalar · ✅ Mini Test · 📖 Konu Özeti.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
    COURSES, STOP_TYPES, SUBJECTS, Store, TOPICS, TOPIC_PLANETS,
    confetti, sfx, speak, stopContent, stopSpeak, toast, topicChar, topicStops, useKampus,
} from '../core';
import { Char, GainLine } from '../components/Char';
import { useCharReact } from '../components/useCharReact';
import { AskQuestion } from './AskQuestion';
import { Bubble } from './Bubble';
import { StarNote } from './StarNote';
import { answerText } from './questions';
import { printSummary } from './print';
import { withQ } from './util';

export type StopPlayerProps = { topicId: string; student: any; stopId: string; exitHref: string };

type View =
    | { v: 'lesson' }
    | { v: 'ex'; i: number }
    | { v: 'test'; qIdx: number | null }
    | { v: 'testDone'; s: any; qs: any[]; right: number; r: any; levelUp: number }
    | { v: 'summary' }
    | { v: 'done'; r: any; nextStop: string | undefined; firstTry: number; levelUp: number };

const firstView = (stopId: string): View =>
    stopId === 'anlatim' ? { v: 'lesson' } : stopId === 'alistirma' ? { v: 'ex', i: 0 } : stopId === 'minitest' ? { v: 'test', qIdx: null } : { v: 'summary' };

export function StopPlayer({ topicId, student, stopId, exitHref }: StopPlayerProps) {
    useKampus();
    const topic = TOPICS[topicId];
    const st = STOP_TYPES[stopId];
    const [C] = useState(() => stopContent(topic));
    const charId = topicChar(topic, undefined);
    const sid = student.id;
    const answers = useRef<Record<string, any>>({});
    const stageRef = useRef<HTMLElement>(null);
    const ch = useCharReact();
    const [view, setView] = useState<View>(() => firstView(stopId));
    const [bub, setBub] = useState<{ at: string; text: string; n: number } | null>(null);
    const sayN = useRef(0);
    const [videoW, setVideoW] = useState(0);
    const [videoOpen, setVideoOpen] = useState(false);

    // ---- ✅ Mini Test: geçerli deneme Store'dan okunur ----
    const pool: any[] = C.testPool;
    const mt = stopId === 'minitest' ? Store.mtState(sid, topicId) : null;
    const mtValid = (s: any) => !!s && !s.done && s.set.every((id: string) => pool.some((q) => q.id === id));

    const started = useRef(false);
    useEffect(() => {
        Store.startStop(sid, topicId, stopId);
        if (stopId !== 'minitest' || started.current) return;
        started.current = true;
        // Yarım bırakılan deneme aynı sorularla sürer; geçerli deneme yoksa yeni set kurulur
        const ids = C.testPool.map((q: any) => q.id);
        const s = Store.mtState(sid, topicId);
        const valid = !!s && !s.done && s.set.every((id: string) => ids.includes(id));
        if (valid && s.idx > 0) toast(`Kaldığın yerden devam ediyorsun: ${s.idx + 1}. soru`);
        if (!valid) Store.mtNew(sid, topicId).catch((e: Error) => toast(e.message));  // sunucu havuzdan 5 soru seçer
    }, [sid, topicId, stopId, C]);

    // ---- Görünüm anahtarı, balon ve ilerleme çubuğu ----
    let screen = view.v as string;
    let q: any = null, qIndex = 0, qTotal = 0, qs: any[] = [];
    if (view.v === 'ex') { q = C.exercises[view.i]; qIndex = view.i; qTotal = C.exercises.length; screen = 'ex' + view.i; }
    if (view.v === 'test' && mt && (view.qIdx != null || mtValid(mt))) {
        qs = mt.set.map((id: string) => pool.find((x) => x.id === id));
        qIndex = view.qIdx ?? mt.idx; q = qs[qIndex]; qTotal = qs.length;
        screen = `t${mt.attempt}:${qIndex}`;
    }
    const defaultText = q ? (q.type === 'tf' ? 'Bu cümle doğru mu, yanlış mı?' : q.prompt) : view.v === 'summary' ? C.summary.idea : '';
    const shown = bub && bub.at === screen ? bub : null;
    const bubbleText = shown ? shown.text : defaultText;

    const say = (text: string, doSpeak = false, at = screen) => {
        setBub({ at, text, n: ++sayN.current });
        if (doSpeak) speak(text);
    };

    let barW = 0, count = '';
    if (q) { barW = qTotal ? qIndex / qTotal * 100 : 0; count = qTotal ? `${Math.min(qIndex + 1, qTotal)}/${qTotal}` : ''; }
    else if (view.v === 'lesson') barW = videoW;
    else if (view.v !== 'test') barW = 100;

    // ---- Durak bitişi ----
    const busy = useRef(false);
    async function finishStop() {
        if (busy.current) return;
        busy.current = true;
        stopSpeak();
        let r: any;
        try { r = await Store.saveStop(sid, topicId, stopId, answers.current); }
        catch (e) { busy.current = false; toast((e as Error).message); return; }
        const prog = await Store.loadProgress().catch(() => null);
        const done: string[] = (prog?.stops || {})[topicId] || [stopId];
        const nextStop = topicStops(topic).map((x: any) => x.id).find((id: string) => !done.includes(id));
        ch.react('happy');
        sfx.done(); confetti(stageRef.current);
        say(r.allDone ? 'Bu konunun bütün duraklarını bitirdin!' : 'Harika iş çıkardın!', false, 'done');
        const firstTry = Object.values(answers.current).filter((a: any) => a.wrong === 0).length;
        const levelUp = r.levelUp && await Store.takeLevelUp(sid).catch(() => 0) ? r.levelUp : 0;
        setView({ v: 'done', r, nextStop, firstTry, levelUp });
        busy.current = false;
    }

    async function testResult(_s: any, list: any[]) {
        if (busy.current) return;
        busy.current = true;
        // Durak, yeni set ödülü ve yıldızlar sunucuda tek istekte (cevaplar sunucuda puanlandı)
        let r: any;
        try { r = await Store.mtComplete(sid, topicId, answers.current); }
        catch (e) { busy.current = false; toast((e as Error).message); return; }
        const s = Store.mtState(sid, topicId) || _s;
        const right = list.filter((x) => s.answers[x.id] && s.answers[x.id].ok).length;
        const great = right >= list.length - 1;
        ch.react(great ? 'happy' : 'hint');
        sfx.done(); if (great) confetti(stageRef.current);
        say(great ? `${list.length} sorudan ${right} doğru! Bu konuyu çok iyi anlamışsın!` : `${list.length} sorudan ${right} doğru. Yeni sorularla bir daha deneyelim mi?`, true, 'testDone');
        const levelUp = r.levelUp && await Store.takeLevelUp(sid).catch(() => 0) ? r.levelUp : 0;
        setView({ v: 'testDone', s, qs: list, right, r, levelUp });
        busy.current = false;
    }

    async function retryTest() {
        answers.current = {};
        try { await Store.mtNew(sid, topicId); } catch (e) { toast((e as Error).message); return; }
        setView({ v: 'test', qIdx: 0 });
    }

    const back = withQ(exitHref, 'tamam=' + stopId);
    const levelLine = (n: number) => n ? (
        <p className="lvl-inline"><span aria-hidden="true">★</span> {n}. seviyeye ulaştın! Yeni rozet: <b>{(TOPIC_PLANETS[topicId] || {}).badge || topic.title}</b></p>
    ) : null;

    // ---- Gövde ----
    let body: ReactNode = null;
    if (view.v === 'lesson') {
        // 🎧 Konu Anlatımı: video `topic.video.src` ile bağlanır; video yoksa yer tutucu gösterilir.
        // `lesson` sahneleri video senaryosudur; ekranda kapalı "Video metni" olarak durur (erişilebilirlik).
        const v = topic.video || {};
        const poster = v.poster || (SUBJECTS[COURSES[topic.course].subject] || {}).pathArt || '';
        // Videonun sonuna gelince ya da %90'ını izleyince Bitir açılır
        const open = () => setVideoOpen(true);
        body = (
            <>
                <div className="video-box">
                    {v.src ? (
                        <video
                            id="lv" controls playsInline preload="metadata" poster={poster || undefined}
                            onEnded={open}
                            onTimeUpdate={(e) => {
                                const el = e.currentTarget;
                                if (el.duration) setVideoW(el.currentTime / el.duration * 100);
                                if (el.duration && el.currentTime / el.duration >= 0.9) open();
                            }}
                        >
                            <source src={v.src} type="video/mp4" />
                            {v.captions ? <track kind="captions" srcLang="tr" label="Türkçe" src={v.captions} default /> : null}
                        </video>
                    ) : (
                        <div className="video-ph">{poster ? <img src={poster} alt="" /> : null}<p><b>Konu anlatım videosu hazırlanıyor</b><span>Video eklenince burada oynayacak.</span></p></div>
                    )}
                </div>
                {C.lesson.length ? (
                    <details className="video-script"><summary>Video metni</summary><ol>{C.lesson.map((sc: any, i: number) => <li key={i}>{sc.text}</li>)}</ol></details>
                ) : null}
                <div className="player-actions">
                    <span className="muted small" id="vhint">{v.src && !videoOpen ? 'Videoyu izledikten sonra durağı bitirebilirsin.' : ''}</span>
                    <button className="btn btn-primary btn-lg" id="fwd" type="button" disabled={!!v.src && !videoOpen} onClick={finishStop}>Bitir ✓</button>
                </div>
            </>
        );
    } else if (view.v === 'ex' && q) {
        // ✏️ Alıştırmalar
        const i = view.i;
        body = (
            <AskQuestion
                key={screen} q={q} mode="practice" index={i} total={C.exercises.length}
                say={(t, sp) => say(t, sp)} react={ch.react}
                onAnswer={(id, rec) => { answers.current[id] = rec; }}
                onDone={() => { if (i + 1 < C.exercises.length) setView({ v: 'ex', i: i + 1 }); else finishStop(); }}
            />
        );
    } else if (view.v === 'test' && q) {
        // ✅ Mini Test
        const idx = qIndex, list = qs;
        body = (
            <AskQuestion
                key={screen} q={q} mode="test" index={idx} total={list.length}
                say={(t, sp) => say(t, sp)} react={ch.react}
                onAnswer={(id, rec) => { answers.current[id] = rec; }}
                onRecord={(given, ok) => {
                    // Cevap soru soru sunucuya gider ve orada puanlanır; ekran beklemesin diye deneme hemen ilerler
                    setView({ v: 'test', qIdx: idx });
                    Store.mtAnswer(sid, topicId, q.id, given, ok).catch((e: Error) => toast(e.message));
                }}
                onDone={() => { const s = Store.mtState(sid, topicId); if (s.idx < list.length) setView({ v: 'test', qIdx: s.idx }); else void testResult(s, list); }}
            />
        );
    } else if (view.v === 'testDone') {
        const { s, qs: list, right, r, levelUp } = view;
        body = (
            <div className="done test-done">
                <div className="score-ring" style={{ '--p': right / list.length * 100 } as CSSProperties}><b>{right}/{list.length}</b><span>doğru</span></div>
                <h2>Mini Test bitti{s.attempt > 1 ? ` · ${s.attempt}. deneme` : ''}</h2>
                <GainLine g={r} lead={`${right}/${list.length} doğru`} />
                <StarNote r={r} />
                {levelLine(levelUp)}
                <ol className="test-review">
                    {list.map((x) => {
                        const a = s.answers[x.id] || {};
                        return <li key={x.id} className={a.ok ? 'ok' : 'no'}><span aria-hidden="true">{a.ok ? '✓' : '✗'}</span> {x.prompt}{a.ok ? null : <small>Doğru cevap: {answerText(x)}</small>}</li>;
                    })}
                </ol>
                <div className="done-actions">
                    <button className="btn btn-primary btn-lg" id="retry" type="button" onClick={retryTest}>🔄 Yeni sorularla tekrar dene</button>
                    <Link className="btn btn-ghost" to={back}>Patikaya dön</Link>
                </div>
            </div>
        );
    } else if (view.v === 'summary') {
        // 📖 Konu Özeti
        const S = C.summary;
        body = (
            <>
                <article className="summary">
                    <div className="sum-idea"><span className="sum-tag">Ana fikir</span><p>{S.idea}</p></div>
                    {S.points && S.points.length ? <ul className="sum-points">{S.points.map((p: any, i: number) => <li key={i}>{p}</li>)}</ul> : null}
                    {S.example ? (
                        <div className="sum-example"><span className="sum-tag">Örnek · {S.example.title}</span>{S.example.lines.map((l: any, i: number) => <p key={i}>{l}</p>)}</div>
                    ) : null}
                </article>
                <div className="player-actions">
                    <button className="btn btn-ghost" id="again" type="button" onClick={() => speak([S.idea, ...(S.points || [])].join(' '))}>🔊 Dinle</button>
                    <button className="btn btn-ghost" id="print" type="button" onClick={() => printSummary(topic, S)}>🖨 Yazdır</button>
                    <button className="btn btn-primary btn-lg" id="fwd" type="button" onClick={finishStop}>Okudum ✓</button>
                </div>
            </>
        );
    } else if (view.v === 'done') {
        const { r, nextStop, firstTry, levelUp } = view;
        const ns = nextStop ? STOP_TYPES[nextStop] : null;
        body = (
            <div className="done">
                <div className="done-badge">{st.icon}</div>
                <h2>{st.label} tamamlandı!</h2>
                <GainLine g={r} lead={stopId === 'alistirma' ? `${firstTry}/${C.exercises.length} ilk denemede doğru` : ''} />
                {stopId === 'alistirma' ? <StarNote r={r} /> : null}
                {r.allDone ? <p>{topic.learned}.</p> : null}
                {levelLine(levelUp)}
                <div className="done-actions">
                    {ns ? (
                        <Link className="btn btn-primary btn-lg" to={ns.sheet ? withQ(exitHref, 'kagit=1') : `/ogrenci/konu/${topicId}?durak=${nextStop}`}>Sıradaki: {ns.icon} {ns.label}</Link>
                    ) : null}
                    <Link className={`btn ${ns ? 'btn-ghost' : 'btn-primary btn-lg'}`} to={back}>Patikaya dön</Link>
                </div>
            </div>
        );
    }

    const isVideo = view.v === 'lesson';
    return (
        <div className="player stop-player" style={{ '--sc': st.color } as CSSProperties}>
            <div className="player-top">
                <Link className="btn btn-ghost btn-sm" to={exitHref} aria-label="Patikaya dön">✕ Çık</Link>
                <div className="player-title"><span className="sp-badge" aria-hidden="true">{st.icon}</span> {st.label} <span className="muted sp-topic">· {topic.title}</span></div>
                <div className="sp-count" id="spc" aria-live="polite">{count}</div>
            </div>
            <div className="pbar" aria-hidden="true"><span style={{ width: barW + '%' }} /></div>
            <div className={`player-main${isVideo ? ' is-video' : ''}`}>
                <section className="player-stage" aria-label="Karakter" ref={stageRef} hidden={isVideo}>
                    <Bubble text={bubbleText} onReplay={() => speak(bubbleText)} replayLabel="Sesli dinle" popKey={shown ? 'o' + shown.n : 's' + screen} />
                    <div className="stage-chars"><Char id={charId} size="lg" state={ch.state} nonce={ch.nonce} /></div>
                </section>
                <section className="player-body" id="pbody">{body}</section>
            </div>
        </div>
    );
}
