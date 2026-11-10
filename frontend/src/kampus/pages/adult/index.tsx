/* eslint-disable @typescript-eslint/no-explicit-any */
// Öğretmen ve veli ekranları (prototipte js/pages-adult.js). İlk sürümün omurgası: öğretmen ödev verir → çocuk tamamlar →
// öğretmen zorlanılan soruları görür → veli "Neyi tamamladı / neyi tekrar edebilir?" özetini görür.
import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ASSESS_BANK, ASSESS_SKILLS, COURSES, SUBJECTS, Store, TOPICS, courseTitle, dateFmt, dayFmt, toast, useMe } from '../../core';
import { Char, LightDots } from '../../components/Char';
import { NotFoundPage } from '../public/NotFound';

const subjName = (t: any): string => (t.meeting ? 'Buluşma' : courseTitle(COURSES[t.course].grade, COURSES[t.course].subject));
const cssVars = (v: Record<string, string>) => v as CSSProperties;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
/** Bugün ve 3 gün sonrası (tarih alanlarının alt sınırı ve varsayılanı). */
const initDates = () => ({ today: ymd(new Date()), def: ymd(new Date(Date.now() + 3 * 864e5)) });
const pct = (r: any) => `${r.total ? (r.doneCount / r.total) * 100 : 0}%`;

// ---- Öğretmen panosu ----
export function TeacherHomePage() {
    const t = useMe();
    const classes = Store.teacherClasses(t);
    const asg = Store.assignmentsOfTeacher(t);
    return (
        <section className="container page">
            <div className="dash-head"><div><h1>Merhaba {t.name.split(' ')[0]} Öğretmen</h1><p className="muted">Sınıflarınız ve verdiğiniz ödevler.</p></div>
                <div className="dash-actions"><Link className="btn btn-primary btn-lg" to="/ogretmen/odev-ver">+ Ödev ver</Link>
                    <Link className="btn btn-ghost btn-lg" to="/ogretmen/degerlendirme-ata">+ Süreç değerlendirmesi ata</Link></div></div>
            <div className="class-cards">{classes.map((c: any) => {
                const st = Store.studentsOf(c.id);
                return (
                    <div key={c.id} className="class-card"><h3>{c.name}</h3><span className="muted">{c.grade}. sınıf · {st.length} öğrenci</span>
                        <div className="chips">{st.map((s: any) => <span key={s.id} className="chip">{s.name}</span>)}</div></div>
                );
            })}</div>
            <h2 className="section-title left">Ödevler</h2>
            {asg.length ? (
                <div className="table-wrap"><table className="table">
                    <thead><tr><th>Konu</th><th>Sınıf</th><th>Son tarih</th><th>Tamamlayan</th><th></th></tr></thead>
                    <tbody>{asg.map((a: any) => {
                        const r = Store.assignmentResults(a), tp = TOPICS[a.topicId];
                        return (
                            <tr key={a.id}><td><b>{tp.title}</b><br /><span className="muted small">{subjName(tp)}</span></td><td>{a.classId}</td><td>{dateFmt(a.due)}</td>
                                <td><div className="mini-bar"><i style={{ width: pct(r) }} /></div><span className="small">{r.doneCount}/{r.total}</span></td>
                                <td><Link className="btn btn-ghost btn-sm" to={`/ogretmen/odev/${a.id}`}>Sonuçlar</Link></td></tr>
                        );
                    })}</tbody></table></div>
            ) : <p className="muted">Henüz ödev vermediniz.</p>}
            <ProcessTable t={t} />
        </section>
    );
}

// ---- Süreç değerlendirmeleri ----
function ProcessTable({ t }: { t: any }) {
    const list = Store.processChecksOf(t);
    return (
        <>
            <h2 className="section-title left">Süreç değerlendirmeleri</h2>
            <p className="muted">Öğrenme devam ederken kısa kontroller. Sonuç, her öğrencinin hangi beceriyi tekrar etmesi gerektiğini gösterir.</p>
            {list.length ? (
                <div className="table-wrap"><table className="table">
                    <thead><tr><th>Değerlendirme</th><th>Sınıf</th><th>Açık olduğu günler</th><th>Tamamlayan</th><th></th></tr></thead>
                    <tbody>{list.map((e: any) => {
                        const r = Store.processCheckResults(e);
                        return (
                            <tr key={e.id}><td><b>{e.title}</b><br /><span className="muted small">{e.questions.length} soru · {(e.skills || []).map((k: string) => ASSESS_SKILLS[k].name).join(', ')}</span></td>
                                <td>{e.classIds.join(', ')}</td><td>{dateFmt(e.opensAt)} – {dateFmt(e.closesAt)}</td>
                                <td><div className="mini-bar"><i style={{ width: pct(r) }} /></div><span className="small">{r.doneCount}/{r.total}</span></td>
                                <td><Link className="btn btn-ghost btn-sm" to={`/ogretmen/degerlendirme/${e.id}`}>Sonuçlar</Link></td></tr>
                        );
                    })}</tbody></table></div>
            ) : <p className="muted">Henüz süreç değerlendirmesi atamadınız.</p>}
        </>
    );
}

export function ProcessFormPage() {
    const t = useMe();
    const navigate = useNavigate();
    const classes = Store.teacherClasses(t);
    const [dates] = useState(initDates);
    const [cls, setCls] = useState<string>(classes[0]?.id ?? '');
    const [checked, setChecked] = useState<string[]>([]);
    const [per, setPer] = useState('3');
    const [ttl, setTtl] = useState('');
    const [op, setOp] = useState(dates.today);
    const [cl, setCl] = useState(dates.def);
    const [err, setErr] = useState('');

    const g = Store.classOf(cls)?.grade;
    const poolSize = (k: string) => ASSESS_BANK.filter((q: any) => q.grade === g && q.skill === k).length;
    const list: string[] = [...new Set<string>(ASSESS_BANK.filter((q: any) => q.grade === g).map((q: any) => q.skill))];
    // Süreç değerlendirmesi karmadır: beceriler derslere göre gruplanır, farklı derslerden seçilebilir
    const bySubj: Record<string, string[]> = {};
    list.forEach((k) => { const su = ASSESS_SKILLS[k].subject; (bySubj[su] = bySubj[su] || []).push(k); });
    // Seçim sırası ekrandaki sıradır (prototipte input:checked sırası)
    const sel = Object.values(bySubj).flat().filter((k) => checked.includes(k));
    const n = sel.reduce((s, k) => s + Math.min(Number(per), poolSize(k)), 0);

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        setErr('');
        try {
            const ex = Store.createProcessCheck(Store.me(), { classId: cls, skills: sel, perSkill: Number(per), opensAt: op, closesAt: cl, title: ttl.trim() });
            toast('Süreç değerlendirmesi atandı.', 'ok');
            navigate('/ogretmen/degerlendirme/' + ex.id);
        } catch (ex) { setErr((ex as Error).message); }
    }

    return (
        <section className="container page narrow">
            <Link className="back" to="/ogretmen">← Panoya dön</Link>
            <h1>Süreç değerlendirmesi ata</h1>
            <p className="muted">Süreç değerlendirmesi karmadır: Türkçe, Matematik ve Hayat Bilgisi gibi farklı derslerden beceri seçebilirsiniz. Sistem her beceriden soru çeker ve soruları karıştırır; sınıftaki herkes aynı soruları çözer. Öğrenci soru başına dönüt almaz, sonunda hangi beceriyi tekrar etmesi gerektiğini görür.</p>
            <form id="pf" noValidate className="form" onSubmit={onSubmit}>
                <label className="field"><span>Sınıf</span>
                    <select id="cls" value={cls} onChange={(e) => { setCls(e.target.value); setChecked([]); }}>
                        {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.grade}. sınıf)</option>)}
                    </select></label>
                <fieldset className="field pc-skills"><legend>Dersler ve beceriler</legend><div id="skills">
                    {list.length ? Object.entries(bySubj).map(([su, ks]) => (
                        <div key={su} className="pc-subj" style={cssVars({ '--c': SUBJECTS[su].color })}><h3>{SUBJECTS[su].name}</h3>
                            {ks.map((k) => (
                                <label key={k} className="pc-skill">
                                    <input
                                        type="checkbox" name="sk" value={k} checked={checked.includes(k)}
                                        onChange={(e) => { const on = e.target.checked; setChecked((xs) => (on ? [...xs, k] : xs.filter((x) => x !== k))); }}
                                    />
                                    <span><b>{ASSESS_SKILLS[k].name}</b><span className="muted small">{poolSize(k)} soruluk havuz</span></span></label>
                            ))}</div>
                    )) : <p className="muted">Bu sınıf düzeyi için henüz soru havuzu yok.</p>}
                </div></fieldset>
                <label className="field"><span>Her beceriden soru sayısı</span>
                    <select id="per" value={per} onChange={(e) => setPer(e.target.value)}><option value="2">2 soru</option><option value="3">3 soru</option><option value="4">4 soru</option></select></label>
                <label className="field"><span>Başlık <span className="muted small">(boş bırakırsanız beceri adlarından oluşur)</span></span><input id="ttl" type="text" maxLength={60} placeholder="Örn. Kasım karma kontrolü" value={ttl} onChange={(e) => setTtl(e.target.value)} /></label>
                <div className="pc-dates">
                    <label className="field"><span>Açılış</span><input type="date" id="op" min={dates.today} value={op} onChange={(e) => setOp(e.target.value)} /></label>
                    <label className="field"><span>Son gün</span><input type="date" id="cl" min={dates.today} value={cl} onChange={(e) => setCl(e.target.value)} /></label>
                </div>
                <p className="pc-sum muted" id="sum" aria-live="polite">{sel.length ? `Toplam ${n} soru · yaklaşık ${Math.max(3, Math.round(n * 0.75))} dakika` : ''}</p>
                <p className="form-err" id="err" role="alert">{err}</p>
                <button className="btn btn-primary btn-lg" type="submit">Değerlendirmeyi ata</button>
            </form>
        </section>
    );
}

const STATUS_LABEL: Record<string, [string, string]> = { sonuc: ['good', 'Tamamladı'], devam: ['', 'Yarıda'], acik: ['', 'Başlamadı'], yakinda: ['', 'Henüz açılmadı'] };

export function ProcessResultsPage() {
    const t = useMe();
    const { id } = useParams();
    const e = Store.exam(id);
    if (!e || e.kind !== 'surec' || e.teacherId !== t.id) return <NotFoundPage />;
    const r = Store.processCheckResults(e);
    return (
        <section className="container page">
            <Link className="back" to="/ogretmen">← Panoya dön</Link>
            <div className="dash-head"><div><span className="tag">{e.classIds.join(', ')} · Süreç Değerlendirme</span><h1>{e.title}</h1>
                <p className="muted">{dateFmt(e.opensAt)} – {dateFmt(e.closesAt)} · {e.questions.length} soru · {r.doneCount}/{r.total} öğrenci tamamladı</p></div></div>
            <div className="results-grid">
                <div className="panel">
                    <h2>Beceriler</h2>
                    {r.doneCount ? (
                        <ul className="pc-skill-res">{r.skills.map((x: any) => (
                            <li key={x.skill}>
                                <div className="pc-skill-head"><b>{x.name} <small className="skill-subj" style={cssVars({ '--c': SUBJECTS[x.subject].color })}>{SUBJECTS[x.subject].name}</small></b><span className={`pill ${x.repeat.length ? 'warn' : 'good'}`}>{x.mastered.length}/{x.mastered.length + x.repeat.length} yapabiliyor</span></div>
                                {x.repeat.length
                                    ? <p className="small">Tekrar etmeli: <b>{x.repeat.map((s: any) => s.name).join(', ')}</b></p>
                                    : <p className="small muted">Tamamlayan herkes bu beceride başarılı.</p>}
                            </li>
                        ))}</ul>
                    ) : <p className="muted">Henüz tamamlayan öğrenci yok.</p>}
                </div>
                <div className="panel">
                    <h2>Öğrenciler</h2>
                    <ul className="stu-list">{r.rows.map((x: any) => {
                        const [cls, txt] = STATUS_LABEL[x.status];
                        return (
                            <li key={x.student.id}><b>{x.student.name}</b><span className={`pill ${cls}`}>{txt}</span>{x.status === 'sonuc' && (
                                <span className="muted small">{x.report.right}/{x.report.total} doğru · {x.report.msg}</span>
                            )}</li>
                        );
                    })}</ul>
                </div>
            </div>
        </section>
    );
}

// ---- Ödev ver ----
export function AssignFormPage() {
    const t = useMe();
    const navigate = useNavigate();
    const classes = Store.teacherClasses(t);
    const [dates] = useState(initDates);
    const [cls, setCls] = useState<string>(classes[0]?.id ?? '');
    const [topic, setTopic] = useState('');
    const [due, setDue] = useState(dates.def);
    const [err, setErr] = useState('');

    const g = Store.classOf(cls)?.grade;
    const courses = Object.entries(COURSES).filter(([, c]: [string, any]) => c.grade === g) as [string, any][];
    const meetings = Object.entries(TOPICS).filter(([, tp]: [string, any]) => tp.meeting && tp.grade === g) as [string, any][];

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        setErr('');
        if (!topic) { setErr('Bir konu seçin.'); return; }
        if (!due) { setErr('Son tarihi seçin.'); return; }
        try {
            const a = Store.createAssignment(Store.me(), { classId: cls, topicId: topic, due });
            toast('Ödev gönderildi.', 'ok');
            navigate('/ogretmen/odev/' + a.id);
        } catch (ex) { setErr((ex as Error).message); }
    }

    const radio = (id: string) => <input type="radio" name="topic" value={id} checked={topic === id} onChange={() => setTopic(id)} />;

    return (
        <section className="container page narrow">
            <Link className="back" to="/ogretmen">← Panoya dön</Link>
            <h1>Ödev ver</h1>
            <form id="af" noValidate className="form" onSubmit={onSubmit}>
                <label className="field"><span>Sınıf</span>
                    <select id="cls" value={cls} onChange={(e) => { setCls(e.target.value); setTopic(''); }}>
                        {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.grade}. sınıf)</option>)}
                    </select></label>
                <div className="field"><span>Konu</span><div id="topics" className="topic-pick">
                    {(courses.length || meetings.length) ? (
                        <>
                            {courses.map(([cid, c]) => (
                                <fieldset key={cid} className="tp-group"><legend>{courseTitle(c.grade, c.subject)}</legend>
                                    {c.units.map((u: any, ui: number) => (
                                        <UnitTopics key={ui} title={u.title} topics={u.topics} radio={radio} />
                                    ))}
                                </fieldset>
                            ))}
                            {meetings.map(([id, tp]) => (
                                <fieldset key={id} className="tp-group"><legend>Buluşma</legend><label className="tp">{radio(id)}<span><b>{tp.title}</b><span className="muted small">{tp.learned}</span></span></label></fieldset>
                            ))}
                        </>
                    ) : <p className="muted">Bu sınıf için henüz içerik yok.</p>}
                </div></div>
                <label className="field"><span>Son tarih</span><input type="date" id="due" min={dates.today} value={due} onChange={(e) => setDue(e.target.value)} /></label>
                <p className="form-err" id="err" role="alert">{err}</p>
                <button className="btn btn-primary btn-lg" type="submit">Ödevi gönder</button>
            </form>
        </section>
    );
}

function UnitTopics({ title, topics, radio }: { title: string; topics: string[]; radio: (id: string) => ReactNode }) {
    return (
        <>
            <div className="tp-unit">{title}</div>
            {topics.map((id) => (
                <label key={id} className="tp">{radio(id)}<span><b>{TOPICS[id].title}</b><span className="muted small">{TOPICS[id].learned}</span></span>
                    <Link className="link small" to={`/ornek-ders/${id}`} target="_blank" rel="noopener">Önizle</Link></label>
            ))}
        </>
    );
}

// ---- Ödev sonuçları ----
export function AssignmentResultsPage() {
    const t = useMe();
    const { id } = useParams();
    const a = Store.assignment(id);
    if (!a || a.teacherId !== t.id) return <NotFoundPage />;
    const r = Store.assignmentResults(a);
    return (
        <section className="container page">
            <Link className="back" to="/ogretmen">← Panoya dön</Link>
            <div className="dash-head"><div><span className="tag">{a.classId} · {subjName(r.topic)}</span><h1>{r.topic.title}</h1>
                <p className="muted">Son tarih {dateFmt(a.due)} · {r.doneCount}/{r.total} öğrenci tamamladı</p></div></div>
            <div className="results-grid">
                <div className="panel">
                    <h2>Zorlanılan sorular</h2>
                    {r.doneCount ? (
                        <ol className="struggle">{r.questions.map((x: any) => (
                            <li key={x.q.id} className={x.struggled ? '' : 'ok'}><div><b>{x.q.prompt}</b><span className="muted small">{x.q.skill}{x.topWrong && <> · en çok seçilen yanlış: <b>{x.topWrong}</b></>}</span></div>
                                <span className={`pill ${x.struggled ? 'warn' : 'good'}`}>{x.struggled}/{x.total} ilk denemede yanıldı</span></li>
                        ))}</ol>
                    ) : <p className="muted">Henüz tamamlayan öğrenci yok.</p>}
                </div>
                <div className="panel">
                    <h2>Öğrenciler</h2>
                    <ul className="stu-list">{r.rows.map((x: any) => (
                        <li key={x.student.id}><b>{x.student.name}</b>{x.done
                            ? <><span className="pill good">Tamamladı</span><span className="muted small">{x.wrongQs} soruda yanıldı · {x.hints} ipucu</span></>
                            : <span className="pill">Başlamadı</span>}</li>
                    ))}</ul>
                </div>
            </div>
        </section>
    );
}

// ---- Veli özeti ----
export function ParentHomePage() {
    const p = useMe();
    const kids = p.children.map(Store.user).filter(Boolean);
    return (
        <section className="container page">
            <h1>Merhaba {p.name.split(' ')[0]}</h1>
            <p className="muted">Çocuklarınızın bu haftası.</p>
            {kids.map((k: any) => {
                const s = Store.childSummary(k.id);
                const tips = [...new Set<string>(s.completed.map((c: any) => c.topic.homeTip))].slice(0, 2);
                return (
                    <article key={k.id} className="kid-summary">
                        <header><Char id="maskot" size="xs" label={false} /><div><h2>{k.name}</h2><span className="muted">{k.grade}. sınıf · {k.classId}</span></div>
                            <div className="ks-light"><LightDots n={s.light} /><span className="small muted">Bu hafta {s.completed.length} çalışma</span></div></header>
                        <div className="ks-grid">
                            <section><h3>✅ Neyi tamamladı?</h3>{s.completed.length ? <ul>{s.completed.map((c: any, i: number) => <li key={i}><b>{subjName(c.topic)}:</b> {c.topic.learned} <span className="muted small">({dayFmt(c.at)})</span></li>)}</ul> : <p className="muted">Bu hafta henüz çalışma yok.</p>}</section>
                            <section><h3>🔁 Neyi tekrar edebilir?</h3>{s.repeat.length ? <ul>{s.repeat.map((r: any) => <li key={r.skill}><b>{r.skill}</b> <span className="muted small">({r.topic.title})</span></li>)}</ul> : <p className="muted">Şu an tekrar gerektiren bir konu yok.</p>}</section>
                            <section><h3>📌 Ödevler</h3>{s.pending.length ? <ul>{s.pending.map((a: any) => <li key={a.id}>{TOPICS[a.topicId].title} <span className="muted small">son gün {dateFmt(a.due)}</span></li>)}</ul> : <p className="muted">Bekleyen ödev yok.</p>}</section>
                            {tips.length > 0 && <section className="tips"><h3>🏠 Evde birlikte</h3><ul>{tips.map((x, i) => <li key={i}>{x}</li>)}</ul></section>}
                        </div>
                    </article>
                );
            })}
        </section>
    );
}
