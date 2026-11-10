/* eslint-disable @typescript-eslint/no-explicit-any */
// Sınavlar (prototipte pages-student.js exams / examDetail / assessPlay).
// Mini Testler konu patikasında kalır; burada yalnızca Tema / Ünite ve Süreç değerlendirmeleri listelenir.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ASSESS_KINDS, ASSESS_SKILLS, CHARACTERS, SUBJECTS, Store, confetti, examSubject, speak, useMe } from '../../core';
import { longDate } from '../../student/helpers';
import { CharArt } from '../../components/Char';
import { StudentShell } from '../../student/StudentShell';
import { AssessPlayer, answerText, givenText } from '../../stops';
import { ExamCard, ExamSubjects } from './cards';

const ORDER: Record<string, number> = { acik: 0, devam: 0, yakinda: 1, sonuc: 2 };

function ExamSection({ kind, all }: { kind: string; all: any[] }) {
    const k = ASSESS_KINDS[kind];
    const list = all.filter((x) => x.e.kind === kind).sort((x, y) => ORDER[x.status] - ORDER[y.status]);
    return (
        <section className="exam-sec" aria-labelledby={`h-${kind}`}>
            <h2 className="yz-h2" id={`h-${kind}`}><span className="yz-h2-ico" aria-hidden="true">{k.icon}</span> {k.label}</h2>
            <p className="exam-sec-desc">{k.desc}</p>
            {list.length
                ? <div className="todo-list">{list.map((x) => <ExamCard key={x.e.id} e={x.e} status={x.status} />)}</div>
                : <p className="muted">Şu an {kind === 'surec' ? 'atanmış bir süreç değerlendirmen' : 'bir tema değerlendirmen'} yok.</p>}
        </section>
    );
}

// ---- Sınavlar: iki bölüm ----
export function ExamsPage() {
    const student = useMe();
    if (!student) return null;
    const all = Store.examsOf(student.id);
    return (
        <StudentShell student={student} active="sinavlar" title="Sınavlar">
            <ExamSection kind="tema" all={all} />
            <ExamSection kind="surec" all={all} />
            <p className="exam-note">
                <span aria-hidden="true">✅</span> Konu sonundaki <b>Mini Testler</b> ders patikasında; istediğin zaman yeni sorularla tekrar çözebilirsin. <Link to="/ogrenci/derslerim">Derslerim</Link>
            </p>
        </StudentShell>
    );
}

// ---- Değerlendirme sonucu (çözülmemişse bilgi ekranı) ----
// Geçersiz ya da sınıfa atanmamış değerlendirme: prototipteki gibi adres değişmeden Sınavlar listesi gösterilir.
export function ExamDetailPage() {
    const student = useMe();
    const { id = '' } = useParams();
    const [params] = useSearchParams();
    if (!student) return null;
    const e = Store.exam(id);
    if (!e) return <ExamsPage />;  // sunucu yalnızca öğrencinin görebileceği değerlendirmeyi döner
    return <ExamDetail student={student} e={e} fresh={!!params.get('bitti')} />;
}

function ExamDetail({ student, e, fresh }: { student: any; e: any; fresh: boolean }) {
    const resultRef = useRef<HTMLElement>(null);
    const sub = examSubject(e), kind = ASSESS_KINDS[e.kind];
    const status = Store.examStatus(student.id, e);
    const r = status === 'sonuc' ? Store.examReport(student.id, e.id) : null;
    const msg: string | undefined = r ? r.msg : undefined;
    // Yeni bitirildiyse konfeti ve sesli geri bildirim (sayfa çizildikten sonra; StrictMode'da bir kez)
    useEffect(() => {
        if (!fresh || msg == null) return;
        const t = setTimeout(() => { confetti(resultRef.current); speak(msg); }, 0);
        return () => clearTimeout(t);
    }, [fresh, msg]);

    const head = (
        <>
            <Link className="back" to="/ogrenci/sinavlar">← Sınavlar</Link>
            <div className="exam-head">
                {status !== 'sonuc' && <CharArt id={sub.char} className="todo-img" />}
                <div>
                    <span className="todo-type">{kind.short}</span>
                    <h2>{e.kind === 'surec' ? e.title : `${sub.name} · ${e.theme ? e.theme.no + '. Tema · ' + e.theme.title : e.title}`}</h2>
                    {e.kind === 'surec' && <ExamSubjects e={e} />}
                </div>
            </div>
        </>
    );

    if (!r) {
        const skills = (e.skills || []).map((k: string) => ASSESS_SKILLS[k]).filter(Boolean);
        return (
            <StudentShell student={student} active="sinavlar" title="Sınavlar">
                {head}
                <article className="exam-detail">
                    <dl className="exam-facts">
                        <div><dt>{status === 'yakinda' ? 'Açılış' : 'Son gün'}</dt><dd>{longDate(status === 'yakinda' ? e.opensAt : e.closesAt)}</dd></div>
                        <div><dt>Soru sayısı</dt><dd>{e.questions.length || '—'}</dd></div>
                        {e.assignedBy && <div><dt>Atayan</dt><dd>{e.assignedBy}</dd></div>}
                    </dl>
                    <h3>Ölçülen beceriler</h3>
                    <ul className="exam-scope">{skills.map((x: any, i: number) => <li key={i}>{x.name}</li>)}</ul>
                    {status === 'yakinda'
                        ? <span className="yz-btn yz-btn-disabled" aria-disabled="true">Yakında</span>
                        : <Link className="yz-btn yz-btn-primary" to={`/ogrenci/degerlendirme/${e.id}`}>{status === 'devam' ? 'Devam et' : 'Başla'} ▶</Link>}
                </article>
            </StudentShell>
        );
    }

    const charId = sub.char && CHARACTERS[sub.char] ? sub.char : 'maskot';
    return (
        <StudentShell student={student} active="sinavlar" title="Sınavlar">
            {head}
            <section className="exam-result" ref={resultRef}>
                <div className="score-ring" style={{ '--p': r.right / r.total * 100 } as CSSProperties}><b>{r.right}/{r.total}</b><span>doğru</span></div>
                <div className="exam-feedback">
                    <CharArt id={charId} className="exam-fb-char" state={r.weak.length ? 'hint' : 'happy'} />
                    <div className="speech exam-speech">{r.msg}</div>
                </div>
            </section>
            <h3 className="yz-h3">Beceri beceri sonucun</h3>
            <ul className="skill-list">
                {r.skills.map((x: any) => {
                    const ok = x.right / x.total >= 0.75;
                    const link = x.topicId ? `/ogrenci/ders/${x.course}?konu=${x.topicId}` : `/ogrenci/ders/${x.course}`;
                    return (
                        <li key={x.skill} className={`skill-row ${ok ? 'ok' : 'tekrar'}`}>
                            <span className="skill-ico" aria-hidden="true">{ok ? '✓' : '↻'}</span>
                            <div className="skill-main">
                                <b>{x.name}{e.kind === 'surec' && x.subject ? <> <small className="skill-subj" style={{ '--c': SUBJECTS[x.subject].color } as CSSProperties}>{SUBJECTS[x.subject].name}</small></> : null}</b>
                                <span className="skill-bar" role="img" aria-label={`${x.total} sorudan ${x.right} doğru`}><i style={{ width: `${x.right / x.total * 100}%` }} /></span>
                            </div>
                            <span className="skill-score">{x.right}/{x.total}</span>
                            {ok ? <span className="skill-tag">Yapabiliyorsun</span> : <Link className="yz-btn yz-btn-primary skill-go" to={link}>Tekrar çalış</Link>}
                        </li>
                    );
                })}
            </ul>
            <details className="exam-review">
                <summary>Soruları gözden geçir</summary>
                <ol className="test-review">
                    {r.e.questions.map((q: any) => {
                        const a = r.st.answers[q.id] || {};
                        return (
                            <li key={q.id} className={a.ok ? 'ok' : 'no'}>
                                <span aria-hidden="true">{a.ok ? '✓' : '✗'}</span> {q.prompt}
                                {!a.ok && <small>Senin cevabın: {givenText(q, a.given)} · Doğru cevap: {answerText(q)}</small>}
                            </li>
                        );
                    })}
                </ol>
            </details>
        </StudentShell>
    );
}

// ---- Değerlendirmeyi çözme ekranı ----
export function AssessPlayPage() {
    const student = useMe();
    const { id = '' } = useParams();
    if (!student) return null;
    const e = Store.exam(id);
    if (!e) return <ExamsPage />;  // sunucu yalnızca öğrencinin görebileceği değerlendirmeyi döner
    return <AssessPlay student={student} id={id} e={e} />;
}

function AssessPlay({ student, id, e }: { student: any; id: string; e: any }) {
    // Durum açılışta bir kez okunur: değerlendirme bitince oynatıcı kendisi sonuca (?bitti=1) geçer;
    // Store değişikliğiyle yeniden çizimde buradaki yönlendirme onunla yarışmasın.
    const [status] = useState(() => Store.examStatus(student.id, e));
    if (status === 'yakinda' || status === 'sonuc') return <Navigate to={`/ogrenci/sinav/${id}`} replace />;
    return <div id="player-root"><AssessPlayer examId={id} student={student} /></div>;
}
