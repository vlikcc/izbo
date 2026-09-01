import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-registers cleanup when vitest runs with `globals: true`, which this project
// does not. Without it every render stays in the document and later queries match several elements.
afterEach(cleanup);

// Node 26 ships its own experimental `localStorage` global that is `undefined` unless the process was
// started with --localstorage-file, and it shadows the one jsdom installs. Any module that reads
// storage at import time — the auth store reads the stored token to seed isAuthenticated — then dies
// on "Cannot read properties of undefined". Install a real in-memory Storage when none is usable.
function createStorage(): Storage {
    let entries = new Map<string, string>();

    return {
        get length() {
            return entries.size;
        },
        key: (index: number) => [...entries.keys()][index] ?? null,
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => {
            entries.set(key, String(value));
        },
        removeItem: (key: string) => {
            entries.delete(key);
        },
        clear: () => {
            entries = new Map();
        },
    } satisfies Storage;
}

function ensureStorage(name: 'localStorage' | 'sessionStorage') {
    const usable = (value: unknown): value is Storage =>
        typeof (value as Storage | undefined)?.getItem === 'function';

    if (usable(globalThis[name])) {
        return;
    }

    const storage = usable((globalThis as { window?: Window })?.window?.[name])
        ? (globalThis as unknown as { window: Window }).window[name]
        : createStorage();

    Object.defineProperty(globalThis, name, { value: storage, writable: true, configurable: true });

    if (typeof window !== 'undefined') {
        Object.defineProperty(window, name, { value: storage, writable: true, configurable: true });
    }
}

ensureStorage('localStorage');
ensureStorage('sessionStorage');
