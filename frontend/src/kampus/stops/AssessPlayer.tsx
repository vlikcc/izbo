/* eslint-disable @typescript-eslint/no-explicit-any */
// Değerlendirme oynatıcı (Sınavlar sekmesi; prototipte stops.js Stops.assess).
// Soru başına geri bildirim yok; cevaplar kaydedilir, sonuç ekranında beceri bazlı geri bildirim verilir.
// Yarım bırakılan değerlendirmeye dönüldüğünde aynı yerden devam edilir.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ASSESS_KINDS, ASSESS_SKILLS, SUBJECTS, Store, examSubject, sfx, toast } from '../core';
import { Question } from './Question';
import { isRight } from './questions';
import { qGiven, qInit, type QState } from './questionState';

export type AssessPlayerProps = { examId: string; student: any };

export function AssessPlayer({ examId, student }: AssessPlayerProps) {
    const navigate = useNavigate();
    const e = Store.exam(examId);
    const kind = ASSESS_KINDS[e.kind];
    // Prototip kaydı yerinde değiştirip saveExam ile yazıyordu; burada her adımda yeni kayıt yazılır (aynı biçim)
    const [st, setSt] = useState<any>(() => Store.examState(student.id, examId) || { idx: 0, answers: {}, done: false });
    const i: number = st.idx;
    const qs = e.questions;
    const sub = examSubject(e);
    const back = '/ogrenci/sinavlar';

    const toasted = useRef(false);
    useEffect(() => {
        if (toasted.current) return;
        toasted.current = true;
        if (st.idx > 0 && !st.done) toast(`Kaldığın yerden devam ediyorsun: ${st.idx + 1}. soru`);
    }, [st]);

    const q = qs[i];
    const next = (given: any) => {
        const ns: any = { ...st, answers: { ...st.answers, [q.id]: { given, ok: isRight(q, given) } }, idx: st.idx + 1 };
        if (ns.idx >= qs.length) { ns.done = true; ns.at = new Date().toISOString(); }
        Store.saveExam(student.id, examId, ns);
        if (ns.done) { sfx.done(); navigate(`/ogrenci/sinav/${examId}?bitti=1`); }
        else setSt(ns);
    };

    return (
        <div className="player stop-player assess-player" style={{ '--sc': sub.color } as CSSProperties}>
            <div className="player-top">
                <Link className="btn btn-ghost btn-sm" to={back} aria-label="Değerlendirmeden çık, kaldığın yer kaydedilir">✕ Çık</Link>
                <div className="player-title"><span className="sp-badge" aria-hidden="true">{kind.icon}</span> {e.kind === 'surec' ? '' : sub.name + ' · '}{e.title} <span className="muted sp-topic">· {kind.short}</span></div>
                <div className="sp-count" id="spc" aria-live="polite">{q ? `${i + 1}/${qs.length}` : ''}</div>
            </div>
            <div className="pbar" aria-hidden="true"><span style={{ width: (i / qs.length * 100) + '%' }} /></div>
            <section className="player-body assess-body" id="pbody">
                {q ? <AssessQuestion key={q.id} q={q} i={i} n={qs.length} kind={kind} surec={e.kind === 'surec'} onNext={next} /> : null}
            </section>
        </div>
    );
}

function AssessQuestion({ q, i, n, kind, surec, onNext }: { q: any; i: number; n: number; kind: any; surec: boolean; onNext: (given: any) => void }) {
    const [s, setS] = useState<QState>(() => qInit(q));
    const given = qGiven(q, s);
    const sk = surec ? ASSESS_SKILLS[q.skill] : null;
    return (
        <>
            <div className="question">
                <div className="q-meta">
                    {kind.short} · <b>{i + 1}/{n}</b>
                    {sk ? <> · <span className="q-subj" style={{ '--c': SUBJECTS[sk.subject].color } as CSSProperties}>{SUBJECTS[sk.subject].name}</span></> : null}
                </div>
                <h2 className="q-text">{q.prompt}</h2>
                <div id="qbox"><Question q={q} s={s} update={setS} /></div>
            </div>
            <div className="player-actions feedback" id="pfb">
                <div className="fb-msg muted">Cevabını seç, sonra ilerle. Sonuçları en sonda göreceksin.</div>
                <button className="btn btn-primary btn-lg" id="nx" type="button" disabled={given == null} onClick={() => onNext(given)}>{i === n - 1 ? 'Bitir ✓' : 'İleri →'}</button>
            </div>
        </>
    );
}
