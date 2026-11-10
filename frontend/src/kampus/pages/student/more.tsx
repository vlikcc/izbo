/* eslint-disable @typescript-eslint/no-explicit-any */
// Öğrenci paneli, ikinci yarı (prototipte js/pages-student.js: library, bookView, games, kupa,
// miniPlanet, PENCIL, profile, avatarEdit). İşaretleme, sınıf adları ve metinler prototiple aynıdır.
import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    AVATAR_BASE, AVATAR_ITEMS, AvatarArt, BOOKS, COURSES, CupArt, GAMES, GRADES, KP_RULES, KP_TABLE, MEB_PLAN, MINITEST_SIZE,
    NICK_ADJ, NICK_NOUN, SUBJECTS, Store, TOPICS, TOPIC_PLANETS, confetti, courseTitle, dateFmt, sfx, toast, useMe,
} from '../../core';
import { GainLine, RawHtml } from '../../components/Char';
import { Emblem, StudentAvatar, StudentShell } from '../../student/StudentShell';
import { badgeName } from '../../student/helpers';

const cssVars = (v: Record<string, string>) => v as CSSProperties;

// ---- E-Kütüphane ----
// Kitabı bitirince +5 KP; beş anlama sorusunun her birinde ilk doğru yanıt +3 KP (kitap başına en fazla 20 KP).
// Yanlış yanıtlanan soru açık kalır; öğrenci kitaba dönüp sonra yeniden deneyebilir. Yeniden okuma ek ödül vermez.
export function LibraryPage() {
    const student = useMe();
    const [params] = useSearchParams();
    if (!student) return null;
    const id = params.get('kitap');
    const book = id && BOOKS.find((b: any) => b.id === id);
    if (book) {
        return (
            <StudentShell student={student} active="kutuphane" title="E-Kütüphane">
                {params.get('sorular') ? <BookQuestions student={student} book={book} /> : <BookReader student={student} book={book} page={Math.min(Number(params.get('s') || 0), book.pages.length - 1)} />}
            </StudentShell>
        );
    }
    return (
        <StudentShell student={student} active="kutuphane" title="E-Kütüphane">
            <p className="lead-sm">Kitabı oku, sonunda 5 kısa soruyu cevapla. Kitabı ilk bitirişin +5 💎 KP, her sorunun ilk doğru cevabı +3 💎 KP kazandırır.</p>
            <div className="book-grid">
                {BOOKS.filter((b: any) => b.grade === student.grade).map((b: any) => {
                    const st = Store.bookState(student.id, b.id), ok = b.questions.filter((q: any) => st.answers[q.id] && st.answers[q.id].ok).length;
                    return (
                        <Link key={b.id} className="book-card" to={`/ogrenci/kutuphane?kitap=${b.id}`} style={cssVars({ '--c': b.color })}>
                            <span className="book-cover" aria-hidden="true">{b.cover}</span><h3>{b.title}</h3>
                            <span className="book-meta">{st.finished ? `Okundu · ${ok}/5 soru` : `${b.pages.length} sayfa · 5 soru`}</span>
                            <span className="book-kp">💎 {Store.bookKp(student.id, b.id)}/{KP_RULES.kitapMax} KP</span>
                        </Link>
                    );
                })}
            </div>
        </StudentShell>
    );
}

function BookReader({ student, book, page }: { student: any; book: any; page: number }) {
    const navigate = useNavigate();
    const st = Store.bookState(student.id, book.id);
    const base = `/ogrenci/kutuphane?kitap=${book.id}`;
    const finish = async () => {
        let g: any = { kp: 0 };
        if (!st.finished) {
            try { g = await Store.finishBook(student.id, book.id); } catch (e) { toast((e as Error).message); return; }
        }
        if (g.kp) { sfx.done(); toast(`Kitabı bitirdin! +${g.kp} 💎 KP${g.cup ? ` · +${g.cup} ⭐` : ''}`, 'ok'); }
        navigate(`${base}&sorular=1`);
    };
    return (
        <>
            <Link className="back" to="/ogrenci/kutuphane">← E-Kütüphane</Link>
            <article className="reader" style={cssVars({ '--c': book.color })}>
                <header><span aria-hidden="true">{book.cover}</span><h2>{book.title}</h2><span className="muted">{page + 1}/{book.pages.length}</span></header>
                <p className="reader-text">{book.pages[page]}</p>
                <div className="reader-nav">
                    {page ? <Link className="yz-btn yz-btn-outline" to={`${base}&s=${page - 1}`}>← Geri</Link> : <span></span>}
                    {page < book.pages.length - 1
                        ? <Link className="yz-btn yz-btn-primary" to={`${base}&s=${page + 1}`}>İleri →</Link>
                        : <button className="yz-btn yz-btn-primary" id="finish" type="button" onClick={finish}>{st.finished ? 'Sorulara geç →' : 'Kitabı bitirdim ✓'}</button>}
                </div>
            </article>
        </>
    );
}

type Picked = { v: string; ok: boolean; g: any };

function BookQuestions({ student, book }: { student: any; book: any }) {
    // Prototip soruları sayfa açılışındaki duruma göre çizer ve cevaptan sonra yeniden çizmez:
    // açılıştaki cevaplar saklanır, bu ziyarette verilen cevaplar ayrıca tutulur.
    const [initial] = useState<Record<string, any>>(() => ({ ...Store.bookState(student.id, book.id).answers }));
    const [picked, setPicked] = useState<Record<string, Picked>>({});
    const base = `/ogrenci/kutuphane?kitap=${book.id}`;
    // Her soruda bu ziyarette tek deneme: yanlışsa soru açık kalır, sonra yeniden denenir
    const sending = useRef<Record<string, boolean>>({});
    const answer = async (q: any, v: string) => {
        if (picked[q.id] || sending.current[q.id]) return;
        sending.current[q.id] = true;
        // Seçilen şık sunucuya gider; doğruluğu ve ödülü sunucu belirler
        try {
            const res = await Store.answerBook(student.id, book.id, q.id, v);
            setPicked((p) => ({ ...p, [q.id]: { v, ok: res.ok, g: res.gain } }));
            if (res.ok) sfx.correct(); else sfx.wrong();
        } catch (e) { toast((e as Error).message); } finally { sending.current[q.id] = false; }
    };
    return (
        <>
            <Link className="back" to={base}>← Kitaba dön</Link>
            <article className="reader" style={cssVars({ '--c': book.color })}>
                <header><span aria-hidden="true">{book.cover}</span><h2>{book.title} · Sorular</h2><span className="muted">💎 {Store.bookKp(student.id, book.id)}/{KP_RULES.kitapMax} KP</span></header>
                <ol className="book-qs">
                    {book.questions.map((q: any) => {
                        const a = initial[q.id], p = picked[q.id];
                        return (
                            <li key={q.id} className={`book-q ${a && a.ok ? 'ok' : a ? 'retry' : ''}`} data-q={q.id}>
                                <p><b>{q.prompt}</b></p>
                                {a && a.ok ? <p className="bq-ok">✓ Doğru cevapladın</p> : (
                                    <>
                                        <div className="bq-opts">
                                            {q.options.map(([v, l]: [string, string]) => (
                                                <button
                                                    key={v}
                                                    type="button"
                                                    className={`bq-opt${p && p.v === v ? (p.ok ? ' ok' : ' no') : ''}`}
                                                    data-v={v}
                                                    disabled={!!p}
                                                    onClick={() => answer(q, v)}
                                                >{l}</button>
                                            ))}
                                        </div>
                                        {a && <p className="bq-retry">Önceki cevabın doğru değildi. Kitaba dönüp tekrar deneyebilirsin.</p>}
                                    </>
                                )}
                                <p className="bq-msg" aria-live="polite">
                                    {p && (p.ok
                                        ? <>Doğru! {p.g.kp ? <b>+{p.g.kp} 💎 KP{p.g.cup ? ` · +${p.g.cup} ⭐` : ''}</b> : ''}</>
                                        : 'Bu kez olmadı. Kitaba dönüp sonra tekrar dene.')}
                                </p>
                            </li>
                        );
                    })}
                </ol>
            </article>
        </>
    );
}

// ---- Oyunlar ----
// Sayı Balonları: büyük sayıyı taşıyan balonu seç. Biten tur +5 💎 KP (oyun başına günde bir kez).
export function GamesPage() {
    const student = useMe();
    const [params] = useSearchParams();
    if (!student) return null;
    const gid = params.get('oyun');
    const game = gid && GAMES.find((g: any) => g.id === gid);
    if (!game) {
        return (
            <StudentShell student={student} active="oyunlar" title="Oyunlar">
                <p className="lead-sm">Her oyun bir derse bağlı. Bir turu bitirmek +{KP_RULES.oyun} 💎 KP kazandırır (oyun başına günde bir kez).</p>
                <div className="book-grid">
                    {GAMES.map((g: any) => (
                        <Link key={g.id} className="book-card game-card" to={`/ogrenci/oyunlar?oyun=${g.id}`} style={cssVars({ '--c': SUBJECTS[g.subject].color })}>
                            <span className="book-cover" aria-hidden="true">{g.icon}</span><h3>{g.title}</h3><span className="book-meta">{g.desc}</span>
                            <span className="book-kp">{SUBJECTS[g.subject].name}</span>
                        </Link>
                    ))}
                </div>
            </StudentShell>
        );
    }
    return (
        <StudentShell student={student} active="oyunlar" title={game.title}>
            <Link className="back" to="/ogrenci/oyunlar">← Oyunlar</Link>
            <GameRound student={student} game={game} />
        </StudentShell>
    );
}

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const newPair = (): [number, number] => {
    const a = rnd(100, 999);
    let b = rnd(100, 999);
    if (a === b) b = a + 7 > 999 ? a - 7 : a + 7;
    return [a, b];
};

// "Yeni tur" bağlantısı için zaman damgası (yalnızca zamanlayıcı geri çağrısında alınır)
const stamp = () => Date.now();

type RoundState = { i: number; nums: [number, number] | null; picked: number | null };

function GameRound({ student, game }: { student: any; game: any }) {
    const [round, setRound] = useState<RoundState>(() => ({ i: 0, nums: newPair(), picked: null }));
    const [score, setScore] = useState(0);
    const [end, setEnd] = useState<{ g: any; t: number } | null>(null);
    const timer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(timer.current), []);

    const next = (i: number, sc: number) => {
        const r = i + 1;
        if (r >= game.rounds) {
            setRound((x) => ({ ...x, nums: null, picked: null }));
            const t = stamp();
            sfx.done();
            Store.finishGame(student.id, game.id, sc).then(
                (g: any) => setEnd({ g, t }),
                (e: Error) => { toast(e.message); setEnd({ g: { kp: 0, cup: 0 }, t }); });
            return;
        }
        setRound({ i: r, nums: newPair(), picked: null });
    };
    const pop = (idx: number) => {
        if (!round.nums || round.picked !== null) return;
        const [a, b] = round.nums;
        const ok = round.nums[idx] === Math.max(a, b);
        const sc = score + (ok ? 1 : 0);
        if (ok) sfx.correct(); else sfx.wrong();
        setScore(sc);
        setRound({ ...round, picked: idx });
        const i = round.i;
        timer.current = window.setTimeout(() => next(i, sc), 450);
    };
    const ok = round.nums && round.picked !== null && round.nums[round.picked] === Math.max(...round.nums);
    return (
        <section className="game-box">
            <div className="game-top"><b id="gq">{round.i + 1}/{game.rounds}</b><span id="gs">{score} doğru</span></div>
            <p className="game-prompt">Büyük sayıyı taşıyan balonu patlat!</p>
            <div className="balloons" id="gb">
                {round.nums && round.nums.map((n, idx) => (
                    <button
                        key={`${round.i}-${idx}`}
                        type="button"
                        className={`balloon b${idx}${round.picked === idx ? (ok ? ' pop-ok' : ' pop-no') : ''}`}
                        data-n={n}
                        onClick={() => pop(idx)}
                    >{n}</button>
                ))}
            </div>
            <div id="gend">
                {end && (
                    <div className="game-end">
                        <p className="lvl-big">{score}/{game.rounds} doğru</p>
                        {end.g.kp || end.g.cup ? <GainLine g={end.g} lead={`${score}/${game.rounds} doğru`} /> : <p className="muted">Bugünkü oyun ödülünü aldın. Yarın yeniden kazanabilirsin.</p>}
                        <div className="done-actions">
                            <Link className="yz-btn yz-btn-primary" to={`/ogrenci/oyunlar?oyun=${game.id}&t=${end.t}`}>Yeni tur</Link>
                            <Link className="yz-btn yz-btn-outline" to="/ogrenci/oyunlar">Oyunlar</Link>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

// ---- Yıldız Kupası ----
type NickPick = { info: { taken: string[]; last?: string; suggest: string }; adj: string; noun: string; err: string };

const splitNick = (n: string): [string, string] => { const [x, ...y] = n.split(' '); return [x, y.join(' ')]; };
// Prototipte <select> seçili seçenek yoksa ilk seçeneği gösterir
const adjOr = (x: string) => (NICK_ADJ.some(([a]: [string]) => a === x) ? x : NICK_ADJ[0][0]);
const nounOr = (x: string) => (NICK_NOUN.some(([a]: [string]) => a === x) ? x : NICK_NOUN[0][0]);

export function KupaPage() {
    const student = useMe();
    const [pick, setPick] = useState<NickPick | null>(null);
    const [welcome, setWelcome] = useState<{ nick: string } | null>(null);
    const [joining, setJoining] = useState(false);
    const joinRef = useRef<HTMLButtonElement>(null);
    const okRef = useRef<HTMLButtonElement>(null);
    const welcomeCard = useRef<HTMLDivElement>(null);
    const welcomeBtn = useRef<HTMLButtonElement>(null);
    const pickOpen = !!pick;
    useEffect(() => { if (pickOpen) okRef.current?.focus(); }, [pickOpen]);
    useEffect(() => {
        if (!welcome) return;
        confetti(welcomeCard.current);
        welcomeBtn.current?.focus();
    }, [welcome]);
    if (!student) return null;

    const c = Store.cupSummary(student.id), rows = Store.cupBoard(student.id).rows, th = c.theme;
    const b = c.progress.bonus;

    // Kupaya katıl → önce takma ad seçimi (listeden ya da otomatik), sonra katılım ve karşılama
    const openPick = async () => {
        let info: any;   // { taken: grubundaki adlar, last: hatırlanan ad, suggest } — her açılışta sunucudan tazelenir
        try { info = await Store.loadNickChoices(); } catch (e) { toast((e as Error).message); return; }
        const start = info.last && !info.taken.includes(info.last) ? info.last : info.suggest;
        const [a0, n0] = splitNick(start);
        setPick({ info, adj: adjOr(a0), noun: nounOr(n0), err: '' });
    };
    const closePick = () => { setPick(null); joinRef.current?.focus(); };
    const cur = pick ? `${pick.adj} ${pick.noun}` : '';
    const bad = !!pick && pick.info.taken.includes(cur);
    const auto = () => {
        if (!pick) return;
        const [x, y] = splitNick(Store.nickChoices(student.id).suggest);
        setPick({ ...pick, adj: x, noun: y, err: '' });
        sfx.tap();
    };
    const join = async () => {
        if (!pick || joining) return;
        setJoining(true);
        try {
            const j2 = await Store.joinCup(student.id, cur);
            sfx.done();
            setPick(null);
            setWelcome({ nick: j2.nick });
        } catch (e: any) { setPick({ ...pick, err: e.message }); } finally { setJoining(false); }
    };

    return (
        <StudentShell student={student} active="kupa" title="Yıldız Kupası">
            <section className="cup-hero" style={cssVars({ '--cc': th.color, '--cg': th.glow })}>
                <RawHtml as="div" className="cup-hero-art" html={CupArt.svg(th)} />
                <div><p className="cup-kicker">Bu haftanın kupası</p><h2 className="cup-name">{th.name}</h2>
                    <p className="muted">Katıl, grubunda haftayı ilk 5 içinde bitir, {th.name} senin olsun! 5. sırada eşitlik varsa o sırayı paylaşanlar da alır. Küçük gruplarda kupa daha az kişiye çıkar (6–11 kişide ilk 3, 5 ve daha az kişide ilk 1).</p></div>
            </section>
            <div className="panom-grid">
                <section className="panom-box" aria-labelledby="gorev-h">
                    <h2 className="yz-h2" id="gorev-h">Bu haftanın katılım görevi</h2>
                    {c.joined
                        ? <div className="cup-joined"><span className="cup-me-av"><StudentAvatar s={student} size="md" /></span><div><p className="cup-nick">{c.nick}</p><p className="lvl-big">Bu hafta {c.points} ⭐</p><p className="muted">Grubunda {c.rank}. sıradasın{c.inZone ? ' — şu an kupa bölgesindesin 🏆' : ` — kupa bölgesi ilk ${c.winners}`}.</p></div></div>
                        : <p className="muted">İki görevi istediğin sırayla tamamla, sonra kupaya katıl. Yalnızca bu hafta yaptığın çalışmalar sayılır.</p>}
                    <div className="day-bar" role="img" aria-label={`Bugün ${c.today}/${c.dailyMax} Kupa Yıldızı`}><span>Bugün</span><i><b style={{ width: `${c.today / c.dailyMax * 100}%` }}></b></i><span>{c.today}/{c.dailyMax} ⭐</span></div>
                    {c.today >= c.dailyMax && <p className="small day-full">Bugünkü yıldızlarını topladın! Yarın yine gel. 💎 KP kazanmaya devam edebilirsin.</p>}
                    <ul className="cup-tasks">
                        {c.progress.tasks.map((t: any) => (
                            <li key={t.id} className={`cup-task ${t.done ? 'ok' : ''}`}>
                                <span className="ct-ico" aria-hidden="true">{t.done ? '✓' : t.icon}</span>
                                <span className="ct-lbl">{t.label}</span><b className="ct-n">{t.done}/{t.target}</b>
                                {!!t.done && <span className="ct-done">Tamam</span>}
                            </li>
                        ))}
                    </ul>
                    <div className={`cup-bonus ${b.done ? 'ok' : ''}`}><span className="ct-ico" aria-hidden="true">{b.done ? '✓' : '🎁'}</span>
                        <span><b>Bonus görev</b> <small>(isteğe bağlı · +{KP_RULES.bonus} 💎 KP)</small><br />{b.label}</span><b className="ct-n">{b.done}/1</b></div>
                    <Link className="yz-btn yz-btn-outline cup-go" to="/ogrenci/derslerim">📚 Derslerime git</Link>
                    <p className="small muted">İstediğin dersi ve konuyu aç, alıştırmasını ya da mini testini seç. Bu hafta tamamladığın çalışmalar sayacı kendiliğinden günceller.</p>
                    {!c.joined && (
                        <>
                            <button ref={joinRef} className="yz-btn yz-btn-primary yz-btn-lg" id="join" type="button" disabled={!c.progress.ready} onClick={openPick}>🏆 Kupaya katıl</button>
                            {c.progress.ready
                                ? <p className="small muted">Katıldığında bu haftaki çalışmalarından kazandığın <b>{c.points} ⭐ Kupa Yıldızı</b> ile tabloya girersin.</p>
                                : <p className="small muted">{c.progress.total - c.progress.doneCount} görev kaldı.</p>}
                        </>
                    )}
                </section>
                <section className="panom-box" aria-labelledby="puan-h">
                    <h2 className="yz-h2" id="puan-h">Ne kazandırır?</h2>
                    <p className="small muted">Çalışmayı tamamlamak 💎 KP kazandırır. ⭐ Kupa Yıldızı doğru cevaplardan gelir: her doğru cevap 1 ⭐, günde en fazla 10 ⭐. Örneğin 4/5 doğru mini test: +4 ⭐ · +10 💎 KP.</p>
                    <ul className="cup-points">
                        {KP_TABLE.map(([i, l, kp, st]: string[]) => (
                            <li key={l}><span aria-hidden="true">{i}</span><span className="cp-l">{l}</span><b className="cp-kp">{kp}</b>{st !== '—' && <b className="cp-st">{st}</b>}</li>
                        ))}
                    </ul>
                    <p className="small muted">Bir soru sana yalnızca bir kez yıldız getirir; aynı alıştırmayı tekrar yapmak yıldız getirmez, yeni sorulardan oluşan mini test seti getirir. Bir kitap en fazla 20 💎 KP kazandırır. 💎 KP birikir ve avatar için harcanır; KP harcamak kupa sıranı etkilemez. ⭐ Kupa Yıldızı her pazartesi sıfırlanır.</p>
                </section>
            </div>
            <section className="panom-box" aria-labelledby="board-h">
                <h2 className="yz-h2" id="board-h">{c.joined ? `Grubun · ${c.total} kişi` : 'Grubun'}</h2>
                <p className="muted small">Katılan {student.grade}. sınıflar katılım sırasıyla 20 kişilik gruplara yerleşir; benzer zamanda katılanlar aynı grupta yarışır. Okul hesabıyla katılanlar ve bireysel üyeler aynı grupta olabilir. Grubun hafta boyunca değişmez; yalnızca kendi grubunu görürsün. Eşit ⭐ toplayanlar aynı sırayı paylaşır. Her pazartesi yeni kupa, yeni görev ve yeni gruplar açılır.</p>
                {c.joined
                    ? (
                        <ol className="league-table board-table">
                            {rows.map((r: any, i: number) => (
                                <Fragment key={r.id}>
                                    {i > 0 && rows[i - 1].winner && !r.winner && <li className="zone-line" aria-hidden="true"><span>Kupa çizgisi · ilk 5</span></li>}
                                    <li className={`${r.me ? 'me' : ''} ${r.winner ? 'in-zone' : ''}`}>
                                        <span className="lt-rank">{r.winner ? '🏆' : ''}{r.rank}</span>
                                        {r.me
                                            ? <span className="lt-av"><StudentAvatar s={student} size="xs" /></span>
                                            : <span className="lt-av lt-av-emoji" aria-hidden="true">{r.emoji || '🙂'}</span>}
                                        <span className="lt-name">{r.nick}{r.me && <> <small>(sen)</small></>}</span>
                                        <span className="lt-kind" title={r.kind === 'okul' ? 'Okul hesabıyla katılıyor' : 'Bireysel üye'}>{r.kind === 'okul' ? '🏫 Okul' : '🏠 Bireysel'}</span>
                                        <span className="lt-pts">{r.points} ⭐</span>
                                    </li>
                                </Fragment>
                            ))}
                        </ol>
                    )
                    : <p className="cup-note">Görevleri tamamlayıp kupaya katıldığında grubun belli olacak.</p>}
            </section>

            {pick && (
                <div className="join-pop" role="dialog" aria-modal="true" aria-labelledby="np-h" onKeyDown={(e) => { if (e.key === 'Escape') closePick(); }}>
                    <div className="join-card nick-card">
                        <StudentAvatar s={Store.me()} size="lg" />
                        <h2 id="np-h">Takma adını seç</h2>
                        <p className="small muted">Yıldız Kupası'nda grubundakiler seni bu adla görür; gerçek adın görünmez.{pick.info.last ? ' Geçen sefer seçtiğin ad hatırlandı.' : ''}</p>
                        <p className="nick-preview"><b id="npv">{cur}</b> <small>(sen)</small></p>
                        <div className="nick-pick">
                            <label>Sıfat <select id="nadj" value={pick.adj} onChange={(e) => setPick({ ...pick, adj: e.target.value, err: '' })}>
                                {NICK_ADJ.map(([x]: [string]) => <option key={x}>{x}</option>)}
                            </select></label>
                            <label>İsim <select id="nnoun" value={pick.noun} onChange={(e) => setPick({ ...pick, noun: e.target.value, err: '' })}>
                                {NICK_NOUN.map(([x, e]: [string, string]) => <option key={x} value={x}>{e} {x}</option>)}
                            </select></label>
                        </div>
                        <p className="nick-err" id="nerr" aria-live="polite">{pick.err || (bad ? 'Bu ad grubunda başka birinde var. Başka bir birleşim seç.' : '')}</p>
                        <div className="nick-actions">
                            <button className="yz-btn yz-btn-outline" id="nauto" type="button" onClick={auto}>🎲 Otomatik seç</button>
                            <button ref={okRef} className="yz-btn yz-btn-primary yz-btn-lg" id="nok" type="button" disabled={bad} onClick={join}>Bu adla katıl</button>
                        </div>
                        <button className="yz-collapse nick-x" type="button" aria-label="Vazgeç" onClick={closePick}>✕</button>
                    </div>
                </div>
            )}
            {welcome && (
                <div className="join-pop" role="dialog" aria-modal="true" aria-labelledby="jp-h">
                    <div className="join-card" ref={welcomeCard}>
                        <StudentAvatar s={Store.me()} size="lg" />
                        <RawHtml className="join-cup" html={CupArt.svg(th)} />
                        <h2 id="jp-h">Takma adın <b>{welcome.nick}</b> olarak bu haftanın {th.name}'na katıldın.</h2>
                        <p>Haydi yıldızları toplayalım! ⭐</p>
                        <button ref={welcomeBtn} className="yz-btn yz-btn-primary yz-btn-lg" type="button" onClick={() => setWelcome(null)}>Başlayalım!</button>
                    </div>
                </div>
            )}
        </StudentShell>
    );
}

// Rozet olarak kazanılan, tam renkli konu gezegeni (küçük)
function MiniPlanet({ topicId, cls = '' }: { topicId: string; cls?: string }) {
    const pl = TOPIC_PLANETS[topicId] || { icon: '🪐', color: '#8E5CF7' };
    return pl.art
        ? <img className={`mini-planet ${cls}`} src={pl.art} alt="" />
        : <span className={`mini-planet pl-ph ${cls}`} style={cssVars({ '--pc': pl.color })}><span>{pl.icon}</span></span>;
}

// ---- Profilim ----
const PENCIL = <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M15.2 4.4l4.4 4.4-10.9 10.9-5 .6.6-5L15.2 4.4zm1.4-1.4l1.6-1.6a1.5 1.5 0 012.1 0l2.3 2.3a1.5 1.5 0 010 2.1L21 7.4 16.6 3z" /></svg>;

export function ProfilePage() {
    const student = useMe();
    const [openBadge, setOpenBadge] = useState<string | null>(null);
    // Rozet kartı dışına dokununca kart kapanır
    useEffect(() => {
        const off = (e: MouseEvent) => { if (!(e.target as Element | null)?.closest?.('.coll-item')) setOpenBadge(null); };
        document.addEventListener('click', off);
        return () => document.removeEventListener('click', off);
    }, []);
    if (!student) return null;

    const lvl = Store.campusLevel(student.id);
    const subjects: string[] = GRADES[student.grade] || [];
    // Her konunun mini test durumu ayrı istenir; birlikte başlasın
    Store.prefetch({ minitests: subjects.flatMap((s) => {
        const plan = MEB_PLAN[`${student.grade}-${s}`];
        return (plan ? plan.themes.flatMap((th: any) => th.topics.map((t: any) => t.id)) : []).filter((id: string) => TOPICS[id]);
    }) });
    // Çalışmalarım: ders ders tamamlanan konular ve Mini Test sonuçları (kişisel ilerleme)
    const work = subjects.map((s: string) => {
        const plan = MEB_PLAN[`${student.grade}-${s}`];
        const ids: string[] = plan ? plan.themes.flatMap((th: any) => th.topics.map((t: any) => t.id)) : Object.keys(TOPICS).filter((id) => TOPICS[id].course === `${student.grade}-${s}`);
        const ready = ids.filter((id) => TOPICS[id]);
        const done = ready.filter((id) => Store.topicComplete(student.id, id));
        const tests = ready.map((id) => ({ id, st: Store.mtState(student.id, id) })).filter((x) => x.st && (x.st.done || x.st.attempt > 1));
        return { s, total: ids.length, ready: ready.length, done, tests };
    });
    const cup = Store.cupSummary(student.id);
    const av = Store.avatarOf(student.id);
    const coll = Store.collectionOf(student.id);
    const won = Store.cupsWon(student.id);
    // Rozete dokununca: rozet adı ve tamamlanan konu küçük kartta açılır
    const toggleBadge = (id: string) => {
        const open = openBadge !== id;
        setOpenBadge(open ? id : null);
        if (open) sfx.tap();
    };

    return (
        <StudentShell student={student} active="profil" title="Profilim">
            <section className="profile-banner" aria-label="Avatarın">
                <RawHtml html={AvatarArt.banner(av.cfg, av.eq, { title: student.name + ' avatarı' })} />
                <Link className="avb-edit" to="/ogrenci/avatar" aria-label="Avatarımı düzenle" title="Avatarımı düzenle">{PENCIL}</Link>
            </section>
            <section className="profile-hero"><div><h2>{student.name}</h2><p className="muted">{[student.grade ? `${student.grade}. sınıf` : '', student.classId].filter(Boolean).join(' · ')}</p>
                <div className="hero-stats"><span className="hero-lvl"><Emblem n={lvl} size="sm" /><span>Kampüs Seviyesi <b>{lvl}</b></span></span>
                    <span className="yz-stars yz-kp" title="Kampüs Puanı: avatar için harcanabilir, birikir"><span aria-hidden="true">💎</span> {Store.stars(student.id)} KP</span>
                    <Link className="hero-cup" to="/ogrenci/kupa" title="Bu haftanın Kupa Yıldızı (her pazartesi sıfırlanır)">Bu hafta {cup.points} ⭐{cup.joined ? ` · ${cup.rank}. sıra` : ''}</Link></div>
            </div></section>
            <h2 className="yz-h2" id="rozetler">Rozetlerim</h2>
            <p className="muted small">Bir konunun dört uydusunu bitirdiğinde o konunun gezegeni rozet olarak buraya eklenir ve Kampüs Seviyen bir artar. Rozete dokun, ne için kazandığını gör.</p>
            {coll.length ? (
                <div className="coll-grid">
                    {coll.map((c: any) => {
                        const t = TOPICS[c.topicId], open = openBadge === c.topicId;
                        return (
                            <div key={c.topicId} className="coll-item">
                                <button
                                    className="coll-btn"
                                    type="button"
                                    data-badge={c.topicId}
                                    aria-expanded={open}
                                    aria-controls={`bc-${c.topicId}`}
                                    aria-label={`${badgeName(c.topicId)} rozeti`}
                                    onClick={(e) => { e.stopPropagation(); toggleBadge(c.topicId); }}
                                ><MiniPlanet topicId={c.topicId} cls="is-float" /><b>{badgeName(c.topicId)}</b></button>
                                <div className="stop-pop badge-card" id={`bc-${c.topicId}`} hidden={!open}>
                                    <b>{badgeName(c.topicId)}</b>
                                    <span>Tamamladığın konu: <strong>{t ? t.title : ''}</strong></span>
                                    <small>{t ? SUBJECTS[COURSES[t.course].subject].name : ''} · {dateFmt(c.at)}</small>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : <p className="muted">Henüz rozetin yok. Bir konunun dört uydusunu tamamla, ilk rozetin gelsin!</p>}
            <h2 className="yz-h2">Kupalarım</h2>
            {won.length ? (
                <div className="cups-grid">
                    {won.map((w: any) => (
                        <figure key={w.week} className="cup-item"><RawHtml className="cup-item-art" html={CupArt.svg(w.theme)} /><figcaption><b>{w.theme.name}</b><small>{dateFmt(w.week + 'T12:00:00')} haftası · grubunda {w.rank}. sıra</small></figcaption></figure>
                    ))}
                </div>
            ) : <p className="muted">Henüz kupan yok. Yıldız Kupası'na katıl, grubunda ilk 5'e gir!</p>}
            <h2 className="yz-h2">Çalışmalarım</h2>
            <div className="work-grid">
                {work.map((w: any) => {
                    const sub = SUBJECTS[w.s];
                    return (
                        <article key={w.s} className="work-card" style={cssVars({ '--c': sub.color })}>
                            <h3>{courseTitle(student.grade, w.s)}</h3>
                            <div className="work-bar" role="img" aria-label={`${w.total} konudan ${w.done.length} tamamlandı`}><i style={{ width: `${w.total ? w.done.length / w.total * 100 : 0}%` }}></i></div>
                            {w.total
                                ? <p className="small"><b>{w.done.length}/{w.total}</b> konu tamamlandı{w.ready < w.total && <> <span className="muted">· {w.total - w.ready} konu hazırlanıyor</span></>}</p>
                                : <p className="small muted">Bu dersin konuları hazırlanıyor.</p>}
                            {!w.total ? null : w.tests.length ? (
                                <ul className="work-tests">
                                    {w.tests.map((x: any) => <li key={x.id}><span>{TOPICS[x.id].title}</span><b>Mini Test: en iyi {x.st.best || 0}/{MINITEST_SIZE}</b><small>{x.st.attempt} deneme</small></li>)}
                                </ul>
                            ) : <p className="muted small">Henüz Mini Test sonucu yok.</p>}
                        </article>
                    );
                })}
            </div>
        </StudentShell>
    );
}

// ---- Profilim → Avatarımı Düzenle ----
// Temel avatar ücretsiz; özel parçalar 💎 KP ile açılır. Parçaya dokununca önce avatarın üzerinde önizlenir.
const SLOTS: [string, string][] = [['temel', 'Temel'], ['outfit', 'Kıyafet'], ['acc', 'Aksesuar'], ['bg', 'Arka plan']];

export function AvatarEditPage() {
    const student = useMe();
    const navigate = useNavigate();
    const [base] = useState(() => (student ? Store.avatarOf(student.id) : null));
    const [cfg, setCfg] = useState<Record<string, string>>(() => ({ ...(base ? base.cfg : {}) }));
    const [eq, setEq] = useState<Record<string, string | null>>(() => ({ ...(base ? base.eq : {}) }));
    const [owned, setOwned] = useState<string[]>(() => (base ? base.owned : []));
    const [preview, setPreview] = useState<any>(null);
    const [tab, setTab] = useState('temel');
    if (!student) return null;

    const shown = preview ? { ...eq, [preview.slot]: preview.id } : eq;
    const kp = Store.stars(student.id);
    const swatch = (key: string, val: string, label: string, isColor = false) => (
        <button
            key={val}
            type="button"
            className={`av-sw ${cfg[key] === val ? 'on' : ''} ${isColor ? 'is-color' : ''}`}
            data-k={key}
            data-v={val}
            style={isColor ? cssVars({ '--sw': val }) : undefined}
            aria-label={isColor ? label : undefined}
            aria-pressed={cfg[key] === val}
            onClick={() => { setCfg({ ...cfg, [key]: val }); sfx.tap(); }}
        >{isColor ? '' : label}</button>
    );
    const tryOn = (it: any) => { setPreview(it); sfx.tap(); };
    const wear = (it: any) => { setEq({ ...eq, [it.slot]: eq[it.slot] === it.id ? null : it.id }); setPreview(null); };
    const buy = async (it: any) => {
        if (!preview || preview.id !== it.id) { setPreview(it); toast(`Önce önizle: ${it.name}. Açmak için tekrar dokun.`); return; }
        try {
            setOwned((await Store.buyItem(student.id, it.id)).owned);
            setEq({ ...eq, [it.slot]: it.id });
            setPreview(null);
            sfx.correct();
            toast(`${it.name} açıldı! −${it.price} 💎 KP`, 'ok');
        } catch (e: any) { toast(e.message); }
    };
    const save = () => {
        Store.saveAvatar(student.id, cfg, eq).then(
            () => { toast('Avatarın kaydedildi! 🎨', 'ok'); navigate('/ogrenci/profilim'); },
            (e: Error) => toast(e.message));
    };
    const items = AVATAR_ITEMS.filter((x: any) => x.slot === tab);

    return (
        <StudentShell student={student} active="profil" title="Avatarımı Düzenle">
            <Link className="back" to="/ogrenci/profilim">← Profilim</Link>
            <div className="av-editor">
                <section className="av-stage" aria-label="Avatar önizlemesi">
                    <div className="profile-banner av-banner-prev" id="avbig" dangerouslySetInnerHTML={{ __html: AvatarArt.banner(cfg, shown, { title: 'Avatarının önizlemesi' }) }} />
                    <p className="av-preview-note" id="avnote" aria-live="polite">{preview ? `Önizleme: ${preview.name}${owned.includes(preview.id) ? '' : ` · ${preview.price} KP`}` : ''}</p>
                    <div className="av-balances">
                        <span className="yz-stars" id="avstars"><span aria-hidden="true">💎</span> {kp} KP</span>
                        <Link className="hero-cup" to="/ogrenci/kupa">Bu hafta {Store.cupPoints(student.id)} ⭐</Link>
                    </div>
                    <p className="small muted">Parça açınca yalnızca 💎 KP bakiyen azalır; ⭐ Kupa Yıldızın ve kupa sıran aynı kalır. KP'n ve açtığın parçalar hafta yenilense de korunur.</p>
                    <button className="yz-btn yz-btn-primary yz-btn-lg" id="avsave" type="button" onClick={save}>Kaydet</button>
                </section>
                <section className="av-panel">
                    <div className="tool-tabs" role="tablist">
                        {SLOTS.map(([k, l]) => (
                            <button key={k} className={`tool-tab ${tab === k ? 'on' : ''}`} role="tab" aria-selected={tab === k} data-tab={k} type="button" onClick={() => { setTab(k); setPreview(null); }}>{l}</button>
                        ))}
                    </div>
                    <div id="avpane">
                        {tab === 'temel' ? (
                            <>
                                <h3 className="av-h">Ten rengi</h3><div className="av-row">{AVATAR_BASE.skin.map((c: string, i: number) => swatch('skin', c, `Ten rengi ${i + 1}`, true))}</div>
                                <h3 className="av-h">Göz rengi</h3><div className="av-row">{AVATAR_BASE.eyes.map((c: string, i: number) => swatch('eyes', c, `Göz rengi ${i + 1}`, true))}</div>
                                <h3 className="av-h">Saç</h3><div className="av-row">{AVATAR_BASE.hair.map(([v, l]: [string, string]) => swatch('hair', v, l))}</div>
                                <h3 className="av-h">Saç rengi</h3><div className="av-row">{AVATAR_BASE.hairColor.map((c: string, i: number) => swatch('hairColor', c, `Saç rengi ${i + 1}`, true))}</div>
                                <h3 className="av-h">Tişört rengi</h3><div className="av-row">{AVATAR_BASE.shirt.map((c: string, i: number) => swatch('shirt', c, `Tişört rengi ${i + 1}`, true))}</div>
                            </>
                        ) : (
                            <>
                                <div className="av-items">
                                    {items.map((it: any) => {
                                        const has = owned.includes(it.id), worn = eq[it.slot] === it.id, sel = preview && preview.id === it.id;
                                        return (
                                            <div key={it.id} className={`av-item ${sel ? 'is-sel' : ''} ${worn ? 'is-worn' : ''}`}>
                                                <button type="button" className="av-try" data-try={it.id} aria-label={`${it.name} parçasını avatarında dene`} onClick={() => tryOn(it)} dangerouslySetInnerHTML={{ __html: AvatarArt.itemIcon(it) }} />
                                                <b>{it.name}</b>
                                                {has
                                                    ? <button type="button" className={`yz-btn ${worn ? 'yz-btn-outline' : 'yz-btn-primary'} av-act`} data-wear={it.id} onClick={() => wear(it)}>{worn ? 'Çıkar' : 'Giy'}</button>
                                                    : <button type="button" className="yz-btn yz-btn-primary av-act" data-buy={it.id} disabled={kp < it.price} onClick={() => buy(it)}>💎 {it.price} KP · Aç</button>}
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="small muted">Bir parçaya dokun, avatarında nasıl durduğunu gör. Beğenirsen 💎 KP ile aç.</p>
                            </>
                        )}
                    </div>
                </section>
            </div>
        </StudentShell>
    );
}
