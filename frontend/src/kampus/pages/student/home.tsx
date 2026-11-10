/* eslint-disable @typescript-eslint/no-explicit-any */
// Öğrenci paneli (prototipte pages-student.js): Ana Sayfa, Derslerim, Ödevlerim ve konu oynatıcı sayfası.
// Ana sayfa "Bugün yapmam gereken ne var?" sorusunu tek bakışta cevaplar.
import type { CSSProperties } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { CHARACTERS, COURSES, GRADES, SUBJECTS, Store, TOPICS, courseTitle, topicStops, useMe } from '../../core';
import { CharArt } from '../../components/Char';
import { StudentShell } from '../../student/StudentShell';
import { StopPlayer } from '../../stops';
import { TopicPlayer } from '../../player';
import { CupCard, QuestCard, TodoCard } from './cards';

// ---- Ana Sayfa ----
export function StudentHomePage() {
    const student = useMe();
    if (!student) return null;
    const items = Store.todo(student.id);
    const list = items.length ? (
        <div className="todo-list">{items.map((it: any, i: number) => <TodoCard key={`${it.kind}-${(it.a || it.e).id || i}`} item={it} />)}</div>
    ) : (
        <div className="todo-empty">
            <CharArt id="maskot" className="empty-maskot" />
            <div className="speech">Bugün bekleyen ödevin veya sınavın yok.</div>
            <Link className="yz-btn yz-btn-primary yz-btn-lg" to="/ogrenci/derslerim">Derslerime git</Link>
        </div>
    );
    return (
        <StudentShell student={student} active="ana" greet>
            <div className="yz-home">
                <section className="yz-todo" aria-labelledby="todo-h">
                    <h2 className="yz-h2" id="todo-h"><span className="yz-h2-ico" aria-hidden="true">✅</span> Yapılacaklar</h2>
                    {list}
                </section>
                <aside className="yz-side"><QuestCard sid={student.id} /><CupCard sid={student.id} /></aside>
            </div>
        </StudentShell>
    );
}

// ---- Derslerim ----
export function LessonsPage() {
    const student = useMe();
    if (!student) return null;
    const subjects: string[] = GRADES[student.grade];
    return (
        <StudentShell student={student} active="dersler" title="Derslerim" pill={`${student.grade}. Sınıf`}>
            <div className="lesson-grid" style={{ '--n': subjects.length } as CSSProperties}>
                {subjects.map((s) => {
                    const sub = SUBJECTS[s], cid = `${student.grade}-${s}`;
                    const img = sub.cardArt || (sub.char && CHARACTERS[sub.char] && CHARACTERS[sub.char].art);
                    return (
                        <Link
                            key={s}
                            className="lesson-card"
                            to={`/ogrenci/ders/${cid}`}
                            style={{ '--c': sub.color, '--bg': sub.bg || '#F4F6FB' } as CSSProperties}
                            aria-label={`${courseTitle(student.grade, s)} patikasını aç`}
                        >
                            <h2>{courseTitle(student.grade, s)}</h2>
                            <div className="lesson-art">{img ? <img className="lesson-img" src={img} alt="" /> : <span className="lesson-ph" aria-hidden="true">{sub.name[0]}</span>}</div>
                        </Link>
                    );
                })}
            </div>
        </StudentShell>
    );
}

// ---- Konu oynatıcı (tek durak ya da konunun tamamı) ----
// Geçersiz konu ya da başka sınıfın konusu: prototipteki gibi adres değişmeden ana sayfa gösterilir.
export function PlayPage() {
    const student = useMe();
    const { id = '' } = useParams();
    const [params] = useSearchParams();
    if (!student) return null;
    const t = TOPICS[id];
    if (!t) return <StudentHomePage />;
    const grade = t.meeting ? t.grade : COURSES[t.course].grade;
    if (grade !== student.grade) return <StudentHomePage />;
    const durak = params.get('durak');
    const stopId = durak && topicStops(t).some((x: any) => x.id === durak) ? durak : null;
    if (stopId === 'calisma') return <Navigate to={`/ogrenci/ders/${t.course}?konu=${id}&kagit=1`} replace />;
    const exit = t.meeting ? '/ogrenci/derslerim' : `/ogrenci/ders/${t.course}?konu=${id}`;
    return (
        <div id="player-root">
            {stopId
                ? <StopPlayer topicId={id} student={student} exitHref={exit} stopId={stopId} />
                : <TopicPlayer topicId={id} student={student} exitHref={exit} />}
        </div>
    );
}

// ---- Ödevlerim ----
export function HomeworkPage() {
    const student = useMe();
    if (!student) return null;
    const pending = Store.pendingAssignments(student.id);
    return (
        <StudentShell student={student} active="odevler" title="Ödevlerim">
            <h2 className="yz-h2">Bekleyen</h2>
            {pending.length
                ? <div className="todo-list">{pending.map((a: any) => <TodoCard key={a.id} item={{ kind: 'odev', a }} />)}</div>
                : <p className="muted">Bekleyen ödevin yok. 🎉</p>}
        </StudentShell>
    );
}
