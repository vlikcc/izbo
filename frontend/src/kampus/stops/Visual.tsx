/* eslint-disable @typescript-eslint/no-explicit-any */
// Konu Anlatımı sahne görselleri (prototipte stops.js visual()): sayı çifti, basamak tablosu,
// sayı doğrusu, metin. Prototipte dışa açılıyordu; Konu Anlatımı şimdilik videoyla verildiği için
// oynatıcılar kullanmıyor.
import { Fragment } from 'react';
import { RawHtml } from '../components/Char';
import { numberLineSvg } from './numberLine';

/** Satır sonlarını <br> ile gösterir (prototipte esc(t).replace(/\n/g, '<br>')). */
export function Lines({ text }: { text: unknown }) {
    const parts = String(text == null ? '' : text).split('\n');
    return <>{parts.map((p, k) => <Fragment key={k}>{k > 0 && <br />}{p}</Fragment>)}</>;
}

export function Visual({ v }: { v: any }) {
    if (!v) return null;
    if (v.kind === 'pair') {
        return (
            <>
                <div className="vz-pair">
                    <div className="vz-num">{v.labelA ? <small>{v.labelA}</small> : null}<b>{v.a}</b></div>
                    <div className={`vz-sign ${v.sign ? 'is-on' : ''}`}>{v.sign || '?'}</div>
                    <div className="vz-num">{v.labelB ? <small>{v.labelB}</small> : null}<b>{v.b}</b></div>
                </div>
                {v.note ? <p className="vz-note">{v.note}</p> : null}
            </>
        );
    }
    if (v.kind === 'place') {
        const H = ['Yüzler', 'Onlar', 'Birler'];
        const cls = (i: number) => (i === v.focus ? 'is-focus' : i < v.focus ? 'is-past' : '');
        const pad = (n: unknown) => String(n).padStart(3, ' ').split('');
        return (
            <table className="vz-place">
                <thead><tr>{H.map((h, i) => <th key={h} className={cls(i)}>{h}</th>)}</tr></thead>
                <tbody>{v.rows.map((r: any, ri: number) => <tr key={ri}>{pad(r).map((d, i) => <td key={i} className={cls(i)}>{d.trim()}</td>)}</tr>)}</tbody>
            </table>
        );
    }
    if (v.kind === 'line') return <RawHtml html={numberLineSvg(v.from, v.to, v.step, v.marks || [])} />;
    return <div className="vz-text"><Lines text={v.text || ''} /></div>;
}
