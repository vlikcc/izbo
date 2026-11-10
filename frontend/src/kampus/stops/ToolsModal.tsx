/* eslint-disable @typescript-eslint/no-explicit-any */
// Ders Araçları penceresi (prototipte stops.js openTools): sayı doğrusu ve taban blokları.
import { useEffect, useRef, useState } from 'react';
import { SUBJECT_TOOLS, sfx } from '../core';
import { KampusModal } from '../components/Modal';
import { numberLineSvg } from './numberLine';

export type ToolsModalProps = { subject: string; onClose: () => void };

export function ToolsModal({ subject, onClose }: ToolsModalProps) {
    const tools: any[] = SUBJECT_TOOLS[subject] || [];
    // Sekmeye her dokunuşta araç baştan kurulur (prototipte show() aracı yeniden çiziyordu)
    const [tab, setTab] = useState<{ id: string | undefined; n: number }>({ id: tools[0]?.id, n: 0 });
    return (
        <KampusModal title="Ders Araçları" wide onClose={onClose}>
            <div className="tool-tabs" role="tablist">
                {tools.map((t) => (
                    <button key={t.id} type="button" role="tab" className={`tool-tab ${tab.id === t.id ? 'on' : ''}`} aria-selected={tab.id === t.id} data-t={t.id} onClick={() => setTab((p) => ({ id: t.id, n: p.n + 1 }))}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>
            <div id="tool-area">
                {tab.id == null ? null : tab.id === 'sayi-dogrusu' ? <NumberLineTool key={tab.n} /> : <BlocksTool key={tab.n} />}
            </div>
        </KampusModal>
    );
}

function NumberLineTool() {
    const [start, setStart] = useState(300);
    const [step, setStep] = useState(10);
    const [marks, setMarks] = useState<number[]>([]);
    const [rev, setRev] = useState(0);
    const clamp = (v: number, st = step) => Math.max(0, Math.min(1000 - st * 10, v));
    // Başlangıç kutusu prototipteki gibi "change" olayında (Enter, odak kaybı, oklar) uygulanır
    const sRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        const el = sRef.current;
        if (!el) return;
        const h = () => { setRev((r) => r + 1); setStart(Math.max(0, Math.min(1000 - step * 10, Math.round(Number(el.value) / step) * step || 0))); };
        el.addEventListener('change', h);
        return () => el.removeEventListener('change', h);
    }, [start, step, rev]);
    const sorted = [...marks].sort((a, b) => a - b);
    return (
        <>
            <div className="tool-row">
                <label>Başlangıç <input key={`${start}-${step}-${rev}`} ref={sRef} id="nl-s" type="number" min={0} max={990} step={step} defaultValue={start} /></label>
                <label>Aralık{' '}
                    <select id="nl-st" value={step} onChange={(e) => { const ns = Number(e.target.value); setStep(ns); setStart(clamp(Math.floor(start / (ns * 10)) * ns * 10, ns)); }}>
                        <option value="1">birer</option><option value="10">onar</option><option value="100">yüzer</option>
                    </select>
                </label>
                <button className="yz-btn yz-btn-outline" id="nl-l" type="button" aria-label="Sola kaydır" onClick={() => setStart(clamp(start - step * 10))}>◀</button>
                <button className="yz-btn yz-btn-outline" id="nl-r" type="button" aria-label="Sağa kaydır" onClick={() => setStart(clamp(start + step * 10))}>▶</button>
                <button className="yz-btn yz-btn-outline" id="nl-c" type="button" onClick={() => setMarks([])}>Temizle</button>
            </div>
            <div
                className="tool-canvas"
                dangerouslySetInnerHTML={{ __html: numberLineSvg(start, start + step * 10, step, sorted, true) }}
                onClick={(e) => {
                    const h = (e.target as Element).closest('.nl-hit');
                    if (!h) return;
                    const n = Number(h.getAttribute('data-n'));
                    setMarks((m) => (m.includes(n) ? m.filter((x) => x !== n) : [...m, n]));
                    sfx.tap();
                }}
            />
            <p className="muted small">Bir çizgiye dokunarak sayıyı işaretle. Sağdaki sayı her zaman daha büyüktür.</p>
        </>
    );
}

const NAMES: Record<'y' | 'o' | 'b', string> = { y: 'yüzlük', o: 'onluk', b: 'birlik' };

function BlocksTool() {
    const [v, setV] = useState({ y: 3, o: 4, b: 2 });
    const n = v.y * 100 + v.o * 10 + v.b;
    const add = (k: 'y' | 'o' | 'b', d: number) => { setV((p) => ({ ...p, [k]: Math.max(0, Math.min(9, p[k] + d)) })); sfx.tap(); };
    return (
        <>
            <div className="blocks-total" aria-live="polite"><b>{n}</b><span>{v.y} yüzlük + {v.o} onluk + {v.b} birlik</span></div>
            <div className="blocks">
                {(['y', 'o', 'b'] as const).map((k) => (
                    <div className="blk-col" key={k}>
                        <div className="blk-head">{NAMES[k][0].toLocaleUpperCase('tr') + NAMES[k].slice(1)}</div>
                        <div className={`blk-stack blk-${k}`}>{Array.from({ length: v[k] }, (_, i) => <i key={i} className={`blk blk-${k}`} />)}</div>
                        <div className="blk-ctl">
                            <button type="button" className="yz-btn yz-btn-outline" data-k={k} data-d="-1" aria-label={`Bir ${NAMES[k]} çıkar`} disabled={v[k] === 0} onClick={() => add(k, -1)}>−</button>
                            <b>{v[k]}</b>
                            <button type="button" className="yz-btn yz-btn-outline" data-k={k} data-d="1" aria-label={`Bir ${NAMES[k]} ekle`} disabled={v[k] === 9} onClick={() => add(k, 1)}>+</button>
                        </div>
                    </div>
                ))}
            </div>
            <p className="muted small">10 birlik bir onluk, 10 onluk bir yüzlük eder. İki sayıyı karşılaştırırken önce yüzlüklere bak.</p>
        </>
    );
}
