/* eslint-disable @typescript-eslint/no-explicit-any */
// Öğrenci paneli kartları (prototipte pages-student.js "Kartlar"): Yapılacaklar kartı, değerlendirme kartı,
// Günlük Görevler ve ana sayfadaki Yıldız Kupası özeti.
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ASSESS_KINDS, ASSESS_SKILLS, CupArt, SUBJECTS, SUBJECT_GIFS, Store, TOPICS, examSubject, examSubjects } from '../../core';
import { CharArt, RawHtml } from '../../components/Char';
import { dateLabel, subjectOfTopic } from '../../student/helpers';

const vars = (v: Record<string, string | number>) => v as CSSProperties;

/** Süreç değerlendirmesinin kapsadığı dersler (renkli etiketler). */
export function ExamSubjects({ e }: { e: any }) {
    return (
        <p className="exam-skills exam-subjects">
            {examSubjects(e).map((x: string) => <span key={x} style={vars({ '--c': SUBJECTS[x].color })}>{SUBJECTS[x].name}</span>)}
        </p>
    );
}

export function TodoCard({ item }: { item: any }) {
    if (item.kind === 'odev') {
        const a = item.a, subj = subjectOfTopic(a.topicId), sub = SUBJECTS[subj];
        const gif = (SUBJECT_GIFS[subj] || [])[0];
        return (
            <article className="todo-card todo-odev">
                <div className="todo-art">{gif ? <img className="todo-img" src={gif} alt="" /> : <CharArt id={sub.char} className="todo-img" />}</div>
                <div className="todo-info">
                    <span className="todo-type">Ödev</span>
                    <p className="todo-title"><b>{sub.name}</b> · {a.title || TOPICS[a.topicId].title}</p>
                    <span className="todo-date"><span aria-hidden="true">📅</span> {dateLabel(a.due)}</span>
                </div>
                <Link className="yz-btn yz-btn-primary" to={`/ogrenci/konu/${a.topicId}`}>Ödevi aç <span aria-hidden="true">▶</span></Link>
            </article>
        );
    }
    return <ExamCard e={item.e} status={item.status} compact />;
}

/** Değerlendirme kartı: durum düğmesi Başla / Devam et / Yakında / Sonucu gör. */
export function ExamCard({ e, status, compact = false }: { e: any; status: string; compact?: boolean }) {
    const sub = examSubject(e), kind = ASSESS_KINDS[e.kind];
    const skills: string[] = (e.skills || []).map((k: string) => ASSESS_SKILLS[k] && ASSESS_SKILLS[k].name).filter(Boolean);
    const btn = status === 'sonuc' ? <Link className="yz-btn yz-btn-outline" to={`/ogrenci/sinav/${e.id}`}>Sonucu gör</Link>
        : status === 'yakinda' ? <span className="yz-btn yz-btn-disabled" aria-disabled="true">Yakında</span>
        : <Link className="yz-btn yz-btn-primary" to={`/ogrenci/degerlendirme/${e.id}`}>{status === 'devam' ? 'Devam et' : 'Başla'} <span aria-hidden="true">▶</span></Link>;
    const when = status === 'yakinda' ? `${dateLabel(e.opensAt)} açılır` : status === 'sonuc' ? 'Tamamlandı' : `Son gün: ${dateLabel(e.closesAt)}`;
    return (
        <article className={`todo-card todo-sinav exam-card is-${e.kind} st-${status}`}>
            <div className="todo-art"><CharArt id={sub.char} className="todo-img" /></div>
            <div className="todo-info">
                <span className="todo-type">{kind.short}</span>
                <p className="todo-title">
                    {e.kind === 'surec' ? <b>{e.title}</b> : <><b>{sub.name}</b> · {e.theme ? e.theme.no + '. Tema · ' + e.theme.title : e.title}</>}
                </p>
                {e.kind === 'surec' && <ExamSubjects e={e} />}
                {!compact && skills.length > 0 && <p className="exam-skills">{skills.map((x, i) => <span key={i}>{x}</span>)}</p>}
                <span className="todo-date">
                    <span aria-hidden="true">{status === 'sonuc' ? '✓' : '📅'}</span> {when}
                    {e.questions.length ? ` · ${e.questions.length} soru` : ''}
                    {e.assignedBy && !compact ? ` · Öğretmenin: ${e.assignedBy}` : ''}
                </span>
            </div>
            {btn}
        </article>
    );
}

export function QuestCard({ sid }: { sid: string }) {
    const q = Store.dailyQuest(sid);
    return (
        <section className="side-card quest-card" aria-label="Günlük görevler">
            <h2><span aria-hidden="true">🎯</span> Günlük Görevler</h2>
            <p className="quest-title">{q.title}</p>
            <div className="quest-row">
                <span className="quest-bar" role="progressbar" aria-valuemin={0} aria-valuemax={q.target} aria-valuenow={q.done}><i style={{ width: `${q.done / q.target * 100}%` }} /></span>
                <b>{q.done}/{q.target}</b>
            </div>
            {q.done >= q.target
                ? <p className="quest-done">Bugünkü görevini tamamladın! +{q.bonus} 💎 KP 🎉</p>
                : <p className="small muted">Tamamlayınca +{q.bonus} 💎 KP</p>}
        </section>
    );
}

/** Ana sayfadaki Yıldız Kupası kartı: katılmadan önce görev ilerlemesi, katıldıktan sonra haftalık puan ve sıra. */
export function CupCard({ sid }: { sid: string }) {
    const c = Store.cupSummary(sid);
    const inner = c.joined ? (
        <div className="cup-row">
            <span className="cup-big">{c.points} ⭐</span>
            <div><p className="panom-lvl">Bu hafta</p><p className="league-meta">Grubunda {c.rank}. sıra · {c.total} kişi{c.inZone ? ' · 🏆 kupa bölgesi' : ''}</p></div>
        </div>
    ) : (
        <>
            <p className="quest-title">Katılım görevi · {c.progress.doneCount}/{c.progress.total}</p>
            <ul className="cup-mini">
                {c.progress.tasks.map((t: any, i: number) => (
                    <li key={t.id || i} className={t.done ? 'ok' : ''}><span aria-hidden="true">{t.done ? '✓' : t.icon}</span>{t.label}</li>
                ))}
            </ul>
            {c.progress.ready && <p className="quest-done">Kupaya katılmaya hazırsın!</p>}
        </>
    );
    return (
        <Link
            className="side-card cup-card"
            to="/ogrenci/kupa"
            aria-label={`Yıldız Kupası: ${c.joined ? `bu hafta ${c.points} Kupa Yıldızı, ${c.rank}. sıra` : `katılım görevi ${c.progress.doneCount}/${c.progress.total}`}`}
        >
            <h2><span aria-hidden="true">🏆</span> Yıldız Kupası</h2>
            <div className="cup-card-theme"><RawHtml className="cup-card-art" html={CupArt.svg(c.theme)} /><b>{c.theme.name}</b></div>
            {inner}
        </Link>
    );
}
