// Karakterin konuşma balonu (prototipte say()). Her yeni söyleyişte "pop" animasyonu baştan oynar;
// balon öğesi yerinde kalır ki aria-live duyurusu kesilmesin.
import { useLayoutEffect, useRef } from 'react';

type Props = {
    text: string;
    /** Yeniden dinleme düğmesi; yoksa düğme çizilmez. */
    onReplay?: (() => void) | null;
    replayLabel: string;
    /** Değiştikçe animasyon yeniden başlar. */
    popKey: string | number;
};

export function Bubble({ text, onReplay, replayLabel, popKey }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.classList.remove('pop');
        el.getBoundingClientRect(); // yeniden akış: animasyon baştan başlasın
        el.classList.add('pop');
    }, [popKey]);
    return (
        <div className="bubble" id="pbubble" aria-live="polite" ref={ref}>
            <span className="bubble-text">{text}</span>
            {onReplay ? <button className="btn-voice" type="button" aria-label={replayLabel} onClick={onReplay}>🔊</button> : null}
        </div>
    );
}
