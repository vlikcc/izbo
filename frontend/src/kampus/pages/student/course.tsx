/* eslint-disable @typescript-eslint/no-explicit-any */
// Ders patikası (prototipte pages-student.js course): her konu bir gezegen, dört durak onun uydusu.
// Üstte kaydırdıkça görünen konuyu gösteren başlık bandı, Konular paneli ve Ders Araçları;
// gezegenin yanındaki 🖨️ düğmesi konunun Çalışma Kâğıdı'nı açar.
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    COURSES, MEB_PLAN, STOP_ORDER, STOP_TYPES, SUBJECTS, SUBJECT_TOOLS, Store, TOPICS, TOPIC_PLANETS,
    courseTitle, sfx, toast, topicStops, useKampus, useMe,
} from '../../core';
import { CharArt } from '../../components/Char';
import { StudentShell } from '../../student/StudentShell';
import { topicColor } from '../../student/helpers';
import { ToolsModal, WorksheetModal } from '../../stops';
import { LessonsPage } from './home';

const vars = (v: Record<string, string | number>) => v as CSSProperties;

// Patika başlığındaki düğmelerin beyaz simgeleri
const ICON = {
    list: (
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M9 6h11M9 12h11M9 18h11" />
            <circle cx="4.5" cy="6" r="1.4" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1.4" fill="currentColor" stroke="none" />
        </svg>
    ),
    tools: (
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="currentColor">
            <rect x="2" y="15" width="20" height="6" rx="1.5" />
            <path d="M5 15V7h2v8M9 15V9h2v6M13 15V5h2v10M17 15v-5h2v5" stroke="currentColor" strokeWidth="0" />
            <rect x="5" y="7" width="2" height="8" rx=".5" /><rect x="9" y="9" width="2" height="6" rx=".5" /><rect x="13" y="4" width="2" height="11" rx=".5" /><rect x="17" y="10" width="2" height="5" rx=".5" />
        </svg>
    ),
};

// Plan: MEB programından (MEB_PLAN) ya da müfredat ağacından (COURSES) temalar ve konular.
function coursePlan(cid: string): any {
    if (MEB_PLAN[cid]) return MEB_PLAN[cid];
    const c = COURSES[cid];
    if (!c) return null;
    return { themes: c.units.map((u: any, i: number) => ({ no: u.no || i + 1, title: u.title, topics: u.topics.map((id: string) => ({ id, title: TOPICS[id].title, code: TOPICS[id].code })) })) };
}

// Uyduların gezegen çevresindeki yerleri (patika genişliğinin %'si, cqw)
const SAT_POS = [[50, 2], [70, 13], [70, 37], [50, 48]];
const stopsOf = () => STOP_ORDER.map((id: string) => ({ id, ...STOP_TYPES[id] }));
const themeLabel = (th: any) => `${th.no}. Tema · ${th.title}`;

/** Seçilen konunun bölümüne, başlık bandının altında kalacak biçimde kaydırır. */
function jumpTo(banner: HTMLElement | null, id: string, smooth: boolean) {
    const sec = document.getElementById('sec-' + id);
    if (!sec || !banner) return;
    const y = sec.getBoundingClientRect().top + window.scrollY - banner.offsetHeight - 16;
    window.scrollTo({ top: Math.max(0, y), behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
}

/** Çalışma Kâğıdı penceresi için durum (konunun kâğıdı yoksa null). `done` açılış anında okunur. */
function sheetFor(sid: string, tid: string): { tid: string; done: boolean } | null {
    const tp = TOPICS[tid];
    if (!tp || !tp.worksheet) return null;
    return { tid, done: Store.stopsDone(sid, tid).includes('calisma') };
}

// Geçersiz ders ya da başka sınıfın dersi: prototipteki gibi adres değişmeden Derslerim gösterilir.
export function CoursePage() {
    const student = useMe();
    const { id: cid = '' } = useParams();
    const [params] = useSearchParams();
    if (!student) return null;
    const [g, s] = cid.split('-');
    const sub = SUBJECTS[s];
    if (!sub || Number(g) !== student.grade) return <LessonsPage />;
    const title = courseTitle(Number(g), s);
    const plan = coursePlan(cid);
    if (!plan) return (
        <StudentShell student={student} active="dersler" title={title} pill={`${student.grade}. Sınıf`}>
            <Link className="back" to="/ogrenci/derslerim">← Derslerim</Link>
            <div className="todo-empty"><CharArt id={sub.char} className="empty-maskot" /><div className="speech">Bu dersin patikası hazırlanıyor. Çok yakında burada!</div></div>
        </StudentShell>
    );
    return (
        <Patika
            student={student} cid={cid} s={s} sub={sub} plan={plan} title={title}
            want={params.get('konu')} flash={params.get('tamam')} kagit={!!params.get('kagit')}
        />
    );
}

type PatikaProps = { student: any; cid: string; s: string; sub: any; plan: any; title: string; want: string | null; flash: string | null; kagit: boolean };

function Patika({ student, cid, s, sub, plan, title, want, flash, kagit }: PatikaProps) {
    useKampus();
    const navigate = useNavigate();
    const sid: string = student.id;

    // Patika dersin bütün konularını sırayla gösterir: her konu için bir gezegen ve dört uydu.
    // İçeriği hazır olmayan konuların uyduları gri görünür ("Hazırlanıyor").
    const all: any[] = plan.themes.flatMap((th: any) => th.topics.map((t: any) => ({ ...t, theme: th })));
    const doneSet = Store.completedSet(sid);
    const current = all.find((t) => TOPICS[t.id] && Store.stopsDone(sid, t.id).length < topicStops(TOPICS[t.id]).length) || null;
    const sel = all.find((t) => t.id === want) || current || all.find((t) => TOPICS[t.id]) || all[0];
    const tools = SUBJECT_TOOLS[s] || [];

    const bannerRef = useRef<HTMLElement>(null);
    const patikaRef = useRef<HTMLDivElement>(null);
    const konularRef = useRef<HTMLButtonElement>(null);
    const drawerCloseRef = useRef<HTMLButtonElement>(null);
    const savedRef = useRef(false);

    // Başlık bandı: kaydırdıkça görünen konunun teması, adı ve rengi
    const [band, setBand] = useState(() => ({ theme: themeLabel(sel.theme), title: sel.title as string, color: topicColor(Math.max(0, all.indexOf(sel))) }));
    const [initSelId] = useState<string>(sel.id);
    const [initJump] = useState(sel !== all[0]);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [openPop, setOpenPop] = useState<string | null>(null);
    const [toolsOpen, setToolsOpen] = useState(false);
    const [sheet, setSheet] = useState<{ tid: string; done: boolean } | null>(null);

    // Başlık bandı kaydırdıkça görünen konuyu gösterir; yönlendirici sayfayı en üste kaydırdıktan sonra seçili konuya gidilir.
    useEffect(() => {
        const banner = bannerRef.current, root = patikaRef.current;
        if (!banner || !root) return;
        const secs = [...root.querySelectorAll<HTMLElement>('.path-sec')];
        let shown = initSelId;
        const onScroll = () => {
            const line = banner.getBoundingClientRect().bottom + window.innerHeight * 0.25;  // ekranın üst çeyreğine gelen konu
            let curSec = secs[0];
            for (const sc of secs) { if (sc.getBoundingClientRect().top <= line) curSec = sc; else break; }
            if (!curSec || curSec.dataset.topic === shown) return;
            shown = curSec.dataset.topic as string;
            setBand({ theme: curSec.dataset.theme as string, title: curSec.dataset.title as string, color: curSec.dataset.color as string });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        const t = setTimeout(() => { if (initJump) jumpTo(banner, initSelId, false); onScroll(); }, 0);
        return () => { clearTimeout(t); window.removeEventListener('scroll', onScroll); };
    }, [initSelId, initJump]);

    // Uydu kartı dışına tıklanınca açık kart kapanır
    useEffect(() => {
        const off = (e: MouseEvent) => { if (!(e.target instanceof Element) || !e.target.closest('.stop-wrap')) setOpenPop(null); };
        document.addEventListener('click', off);
        return () => document.removeEventListener('click', off);
    }, []);
    // Kart açılınca içindeki düğmeye odaklan
    useEffect(() => {
        if (!openPop) return;
        const a = document.getElementById('sp-' + openPop)?.querySelector('a');
        if (a) a.focus({ preventScroll: true });
    }, [openPop]);

    // Konular paneli açılınca kapat düğmesine odaklan; sayfa kapanırken kaydırma kilidi kalmasın
    useEffect(() => { if (drawerOpen) drawerCloseRef.current?.focus(); }, [drawerOpen]);
    useEffect(() => () => document.body.classList.remove('no-scroll'), []);

    // Çalışma Kâğıdı durağından (?kagit=1) gelindiyse kâğıt kendiliğinden açılır
    useEffect(() => {
        if (!kagit || !want) return;
        const t = setTimeout(() => { const st = sheetFor(sid, want); if (st) { savedRef.current = false; setSheet(st); } }, 50);
        return () => clearTimeout(t);
    }, [kagit, want, sid]);
    // Durak bitince patikaya ?tamam=<durak> ile dönülür
    useEffect(() => {
        if (!flash || !STOP_TYPES[flash]) return;
        const t = setTimeout(() => toast(`${STOP_TYPES[flash].label} tamamlandı! ⭐`, 'ok'), 0);
        return () => clearTimeout(t);
    }, [flash]);

    const openD = () => { setDrawerOpen(true); document.body.classList.add('no-scroll'); };
    const closeD = () => { setDrawerOpen(false); document.body.classList.remove('no-scroll'); konularRef.current?.focus(); };
    // Konular listesinden seçilen konuya patikada kayarak gidilir (adres sayfa yeniden çizilmeden güncellenir)
    const jumpFromDrawer = (e: ReactMouseEvent, href: string, id: string) => {
        e.preventDefault();
        setDrawerOpen(false); document.body.classList.remove('no-scroll');
        window.history.replaceState(window.history.state, '', href);
        jumpTo(bannerRef.current, id, true);
    };

    // Çalışma Kâğıdı: önizle, indir, yazdır. İndirince, yazdırınca ya da "Çalıştım" deyince durak tamamlanır.
    const openSheet = (tid: string) => {
        const st = sheetFor(sid, tid);
        if (!st) return;
        savedRef.current = false;
        setSheet(st);
    };
    const markSheetUsed = (tid: string) => {
        if (savedRef.current || Store.stopsDone(sid, tid).includes('calisma')) return;
        savedRef.current = true;
        Store.saveStop(sid, tid, 'calisma', {});
        toast('Çalışma Kâğıdı tamamlandı! ✓', 'ok');
    };
    // Pencere kapanınca patika o konuyla yeniden açılır (prototipte replaceState + App.render)
    const closeSheet = (tid: string) => {
        setSheet(null);
        if (savedRef.current) navigate(`/ogrenci/ders/${cid}?konu=${tid}`, { replace: true });
    };

    // Uydu kartında başlamadan önce kazanılabilecek ⭐ ve 💎 görünür
    const starHint = (tid: string, stop: string, isDone: boolean) => {
        const p = Store.starPreview(sid, tid, stop), kp = STOP_TYPES[stop].kp;
        const kpTxt = stop === 'minitest' ? `+${kp} 💎 KP (yeni set)` : isDone ? 'KP alındı' : `+${kp} 💎 KP`;
        if (p.kind === 'none') return <span className="sp-hint">{kpTxt}</span>;
        const st = p.max ? `en fazla ${p.max} ⭐` : p.left === 0 ? 'bugünkü 10 ⭐ doldu' : 'yıldızları alındı';
        return <span className="sp-hint"><b>{st}</b> · {kpTxt}</span>;
    };

    // Konu gezegeni: renkli görselin üstüne gri kopya konur; tamamlanan her uydu için gri kopyanın dörtte biri açılır.
    const planet = (t: any, topic: any, doneN: number, full: boolean, burst: boolean) => {
        const pl = TOPIC_PLANETS[t.id] || { icon: sub.name[0], color: sub.color };
        const pct = doneN / STOP_ORDER.length * 100;
        const face = pl.art ? (
            <><img className="pl-img" src={pl.art} alt="" loading="lazy" /><img className="pl-img pl-gray" src={pl.art} alt="" loading="lazy" /></>
        ) : (
            <>
                <span className="pl-img pl-ph" style={vars({ '--pc': pl.color })}><span>{pl.icon}</span></span>
                <span className="pl-img pl-ph pl-gray" style={vars({ '--pc': pl.color })}><span>{pl.icon}</span></span>
            </>
        );
        return (
            <div
                className={`planet ${full ? 'is-full' : ''} ${burst ? 'is-burst' : ''} ${topic ? '' : 'is-soon'}`}
                style={vars({ '--p': String(pct) })}
                role="img"
                aria-label={`${t.title} gezegeni, ${doneN}/${STOP_ORDER.length} uydu tamamlandı`}
            >
                {face}{full && <span className="pl-glow" aria-hidden="true" />}
            </div>
        );
    };

    const section = (t: any, ti: number) => {
        const topic = TOPICS[t.id];
        const done: string[] = topic ? Store.stopsDone(sid, t.id) : [];
        const stops = stopsOf();
        const doneN = stops.filter((x: any) => done.includes(x.id)).length;
        const full = !!topic && doneN === stops.length;
        const mt = topic ? Store.mtState(sid, t.id) : null;
        const mtOpen = mt && !mt.done && mt.idx > 0 ? mt : null;
        const burst = !!(full && t.id === want && flash && STOP_TYPES[flash]);
        return (
            <section
                key={t.id}
                className={`path-sec planet-sec ${topic ? '' : 'is-soon'}`}
                id={`sec-${t.id}`}
                data-topic={t.id}
                data-theme={themeLabel(t.theme)}
                data-color={topicColor(ti)}
                data-title={t.title}
                aria-label={`${t.title}, ${topic ? `${doneN}/${stops.length} uydu tamamlandı` : 'hazırlanıyor'}`}
            >
                <svg className="orbit" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M27 6 C62 -4, 92 18, 80 32 C70 46, 50 60, 27 54" /></svg>
                {planet(t, topic, doneN, full, burst)}
                {topic && topic.worksheet && (
                    <button
                        className="pl-sheet"
                        type="button"
                        aria-label={`${t.title} çalışma kâğıdı: önizle, indir, yazdır`}
                        title="Çalışma kâğıdı"
                        onClick={(e) => { e.stopPropagation(); setOpenPop(null); openSheet(t.id); }}
                    >
                        🖨️
                    </button>
                )}
                {stops.map((st: any, si: number) => {
                    const isDone = done.includes(st.id);
                    const resumeTest = st.id === 'minitest' && mtOpen;
                    const uid = `${t.id}--${st.id}`;
                    const [x, y] = SAT_POS[si];
                    const open = openPop === uid;
                    const btn = !topic ? <span className="yz-btn yz-btn-disabled" aria-disabled="true">Hazırlanıyor</span>
                        : <Link className="yz-btn yz-btn-primary" to={`/ogrenci/konu/${t.id}?durak=${st.id}`}>{resumeTest ? `Devam et · ${mtOpen.idx + 1}/${mtOpen.set.length}` : isDone ? 'Tekrar et' : 'Başlat'}</Link>;
                    return (
                        <div key={st.id} className="stop-wrap sat-wrap" style={vars({ '--sx': `${x}cqw`, '--sy': `${y}cqw` })}>
                            <button
                                className={`sat ${isDone ? 'is-done' : ''} ${topic ? '' : 'is-soon'} ${t.id === want && flash === st.id ? 'is-flash' : ''}`}
                                style={vars({ '--c': st.color })}
                                data-stop={uid}
                                aria-expanded={open}
                                aria-controls={`sp-${uid}`}
                                aria-label={`${t.title}: ${st.label}${isDone ? ', tamamlandı' : topic ? '' : ', hazırlanıyor'}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenPop(open ? null : uid);
                                    if (!open) sfx.tap();
                                }}
                            >
                                <img src={isDone ? st.art : st.artOff} alt="" loading="lazy" />{isDone && <span className="sat-tick" aria-hidden="true">✓</span>}
                            </button>
                            <div className="stop-pop" id={`sp-${uid}`} hidden={!open}>
                                <b>{st.label}</b>
                                {topic && starHint(t.id, st.id, isDone)}
                                {btn}
                            </div>
                        </div>
                    );
                })}
            </section>
        );
    };

    return (
        <StudentShell student={student} active="dersler" title={title} compact>
            <header className="patika-banner" id="pbanner" ref={bannerRef} style={vars({ '--c': band.color })}>
                <div className="pb-titles">
                    <Link className="pb-theme" to="/ogrenci/derslerim" aria-label="Derslerime dön"><span aria-hidden="true">←</span> <span id="pb-theme">{band.theme}</span></Link>
                    <h2 className="pb-topic" id="pb-topic" aria-live="polite">{band.title}</h2>
                </div>
                <div className="pb-actions" role="toolbar" aria-label="Yardımcı düğmeler">
                    {tools.length > 0 && (
                        <button className="pb-btn" id="araclar" type="button" aria-label="Ders Araçları" aria-haspopup="dialog" onClick={() => setToolsOpen(true)}>
                            {ICON.tools}<span>Ders Araçları</span>
                        </button>
                    )}
                    <button className="pb-btn" id="konular" ref={konularRef} type="button" aria-label="Konular" aria-haspopup="dialog" aria-controls="drawer" onClick={openD}>
                        {ICON.list}<span>Konular</span>
                    </button>
                </div>
            </header>
            <div className="patika patika-long" ref={patikaRef} aria-label={`${sub.name} patikası`}>
                {all.map(section)}
            </div>
            <div className="konu-drawer" id="drawer" hidden={!drawerOpen} onKeyDown={(e) => { if (e.key === 'Escape') closeD(); }}>
                <div className="konu-backdrop" onClick={closeD} />
                <aside className="konu-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-h">
                    <div className="konu-head"><h2 id="drawer-h">Konular</h2><button ref={drawerCloseRef} className="yz-collapse" type="button" onClick={closeD} aria-label="Kapat">✕</button></div>
                    {plan.source && <p className="muted small">MEB Türkiye Yüzyılı Maarif Modeli {student.grade}. sınıf programına göre</p>}
                    {plan.themes.map((th: any) => (
                        <details key={th.no} className="konu-theme" open={th.topics.some((t: any) => t.id === sel.id)}>
                            <summary>{themeLabel(th)}</summary>
                            <ul>
                                {th.topics.map((t: any) => {
                                    const has = !!TOPICS[t.id], fin = doneSet.has(t.id);
                                    const n = has ? Store.stopsDone(sid, t.id).length : 0;
                                    const href = `/ogrenci/ders/${cid}?konu=${t.id}`;
                                    return (
                                        <li key={t.id}>
                                            <Link className={`konu-link ${t.id === sel.id ? 'on' : ''} ${has ? '' : 'soon'}`} to={href} onClick={(e) => jumpFromDrawer(e, href, t.id)}>
                                                <span>{t.title}</span>
                                                {fin ? <span className="konu-done" aria-label="tamamlandı">⭐</span>
                                                    : has ? <small>{n}/{topicStops(TOPICS[t.id]).length} durak</small>
                                                    : <small>Hazırlanıyor</small>}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </details>
                    ))}
                </aside>
            </div>
            {toolsOpen && <ToolsModal subject={s} onClose={() => setToolsOpen(false)} />}
            {sheet && (
                <WorksheetModal
                    ws={TOPICS[sheet.tid].worksheet}
                    done={sheet.done}
                    onUse={() => markSheetUsed(sheet.tid)}
                    onClose={() => closeSheet(sheet.tid)}
                />
            )}
        </StudentShell>
    );
}
