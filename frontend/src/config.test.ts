import { describe, expect, it } from 'vitest';
import { resolveApiUrl } from './config';

describe('resolveApiUrl', () => {
    it('prefers the address the container provides at runtime', () => {
        expect(resolveApiUrl({ apiUrl: 'https://api.yzkampus.velikececi.com/' }, 'https://api.old.example'))
            .toBe('https://api.yzkampus.velikececi.com');
    });

    it('falls back to the build-time address when the runtime one is empty or unrendered', () => {
        expect(resolveApiUrl({ apiUrl: '' }, 'https://api.build.example')).toBe('https://api.build.example');
        expect(resolveApiUrl({ apiUrl: '${APP_API_URL}' }, 'https://api.build.example')).toBe('https://api.build.example');
        expect(resolveApiUrl(undefined, 'https://api.build.example')).toBe('https://api.build.example');
    });

    it('uses the local gateway when nothing is configured', () => {
        expect(resolveApiUrl({}, '')).toBe('http://localhost:5050');
    });
});
