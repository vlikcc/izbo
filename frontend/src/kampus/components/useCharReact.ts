import { useCallback, useEffect, useRef, useState } from 'react';

export type CharState = 'idle' | 'correct' | 'hint' | 'happy';

/**
 * UI.react karşılığı: karakterin durumunu değiştirir, istenirse bir süre sonra beklemeye döner.
 * Dönen `nonce` Char'a verilir; aynı duruma tekrar geçildiğinde animasyon yeniden oynar.
 */
export function useCharReact(initial: CharState = 'idle') {
    const [st, setSt] = useState<{ state: CharState; nonce: number }>({ state: initial, nonce: 0 });
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);
    const react = useCallback((state: CharState, revertMs?: number) => {
        clearTimeout(timer.current);
        setSt((p) => ({ state, nonce: p.nonce + 1 }));
        if (revertMs) timer.current = setTimeout(() => setSt((p) => ({ state: 'idle', nonce: p.nonce + 1 })), revertMs);
    }, []);
    return { state: st.state, nonce: st.nonce, react };
}
