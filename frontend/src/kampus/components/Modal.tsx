// Yardımcı pencere (prototipte Stops.modal): arka plana ya da ✕'e tıklayınca, Esc ile kapanır;
// açılınca kapat düğmesine odaklanır, kapanınca odak açan öğeye döner, sayfa kaydırması kilitlenir.
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { kampusRoot } from '../core';

export function KampusModal({ title, wide = false, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
    const closeRef = useRef<HTMLButtonElement>(null);
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });
    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        document.body.classList.add('no-scroll');
        closeRef.current?.focus();
        return () => {
            document.body.classList.remove('no-scroll');
            opener?.focus?.();
        };
    }, []);
    return createPortal(
        <div className="yz-modal" onKeyDown={(e) => { if (e.key === 'Escape') onCloseRef.current(); }}>
            <div className="konu-backdrop" onClick={onClose} />
            <div className={`yz-modal-box ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="mdl-h">
                <div className="konu-head">
                    <h2 id="mdl-h">{title}</h2>
                    <button ref={closeRef} className="yz-collapse" type="button" onClick={onClose} aria-label="Kapat">✕</button>
                </div>
                <div className="yz-modal-body">{children}</div>
            </div>
        </div>,
        kampusRoot(),
    );
}
