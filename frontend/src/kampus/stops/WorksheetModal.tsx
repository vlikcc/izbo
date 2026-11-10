/* eslint-disable @typescript-eslint/no-explicit-any */
// Çalışma Kâğıdı penceresi (prototipte stops.js openWorksheet): önizleme, indirme, yazdırma.
// onUse: öğrenci indirince, yazdırınca ya da "Çalıştım" deyince çağrılır (durak tamamlanır).
import { KampusModal } from '../components/Modal';
import { printPdf } from './print';

export type WorksheetModalProps = { ws: any; onUse?: () => void; done?: boolean; onClose: () => void };

export function WorksheetModal({ ws, onUse, done, onClose }: WorksheetModalProps) {
    const used = () => { if (onUse) onUse(); };
    return (
        <KampusModal title="Çalışma Kâğıdı" wide onClose={onClose}>
            <p className="ws-title">{ws.title}</p>
            <div className="ws-preview">
                {ws.preview
                    ? <img src={ws.preview} alt="Çalışma kâğıdının önizlemesi" />
                    : <iframe src={`${ws.file}#toolbar=0&view=FitH`} title="Çalışma kâğıdı önizlemesi" />}
            </div>
            <div className="ws-actions">
                <a className="yz-btn yz-btn-primary" href={ws.file} download onClick={used}>⬇ PDF indir</a>
                <button className="yz-btn yz-btn-outline" id="ws-print" type="button" onClick={() => { printPdf(ws.file); used(); }}>🖨 Yazdır</button>
                <a className="yz-btn yz-btn-outline" href={ws.file} target="_blank" rel="noopener">↗ Yeni sekmede aç</a>
                {onUse ? (
                    <button className={`yz-btn ${done ? 'yz-btn-disabled' : 'yz-btn-outline'} ws-done`} id="ws-done" type="button" disabled={!!done} onClick={() => { used(); onClose(); }}>
                        {done ? '✓ Tamamlandı' : '✓ Çalıştım'}
                    </button>
                ) : null}
            </div>
        </KampusModal>
    );
}
