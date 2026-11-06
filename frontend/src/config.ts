/** Settings the container writes into /config.js at start-up (see nginx.conf.template). */
interface RuntimeConfig {
    apiUrl?: string;
}

declare global {
    interface Window {
        __APP_CONFIG__?: RuntimeConfig;
    }
}

const LOCAL_API = 'http://localhost:5050';

/**
 * The API's base URL: the runtime value from the container first, so one image serves any domain; then the
 * build-time VITE_API_URL; then the local development gateway. A placeholder nginx left unrendered
 * ("${APP_API_URL}") counts as unset. Never ends with a slash.
 */
export function resolveApiUrl(runtime: RuntimeConfig | undefined, buildTime: string | undefined): string {
    const usable = (value: string | undefined) => {
        const trimmed = value?.trim();
        return trimmed && !trimmed.includes('${') ? trimmed : undefined;
    };

    return (usable(runtime?.apiUrl) ?? usable(buildTime) ?? LOCAL_API).replace(/\/+$/, '');
}

export const API_URL = resolveApiUrl(
    typeof window === 'undefined' ? undefined : window.__APP_CONFIG__,
    import.meta.env.VITE_API_URL as string | undefined);
