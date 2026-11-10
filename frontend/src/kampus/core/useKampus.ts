import { useSyncExternalStore } from 'react';
import { Store } from './store';

/**
 * Store'daki her kayıttan sonra bileşeni yeniden çizer. Prototip her değişiklikte sayfayı baştan
 * çiziyordu; burada sayfa bileşenleri bu kancayı çağırıp Store'u çizim sırasında okur.
 */
export function useKampus(): number {
    return useSyncExternalStore(Store.subscribe, Store.getVersion);
}

/** Oturumdaki kullanıcı (yoksa null). Değişiklikleri izler. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useMe(): any {
    useKampus();
    return Store.me();
}
