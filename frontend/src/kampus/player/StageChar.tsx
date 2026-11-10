// Sahnedeki tek karakter: kendi tepki durumunu (useCharReact) tutar; üst bileşen ref ile
// react(durum, süre) çağırır (prototipte UI.react(charEl(id), …)). Birden çok karakterli
// buluşma konularında her karakter için bir tane çizilir.
import { useImperativeHandle, type Ref } from 'react';
import { Char } from '../components/Char';
import { useCharReact, type CharState } from '../components/useCharReact';

export type StageCharHandle = { react: (state: CharState, revertMs?: number) => void };

export function StageChar({ id, speaking = false, ref }: { id: string; speaking?: boolean; ref?: Ref<StageCharHandle> }) {
    const { state, nonce, react } = useCharReact();
    useImperativeHandle(ref, () => ({ react }), [react]);
    return <Char id={id} size="lg" state={state} nonce={nonce} speaking={speaking} />;
}
