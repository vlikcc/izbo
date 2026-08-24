import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastItem {
    id: number;
    kind: ToastKind;
    message: string;
}

interface ToastState {
    items: ToastItem[];
    push: (kind: ToastKind, message: string) => void;
    dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
    items: [],
    push: (kind, message) => {
        const id = nextId++;
        set((state) => ({ items: [...state.items, { id, kind, message }] }));
        window.setTimeout(() => {
            set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
        }, 5000);
    },
    dismiss: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
}));

export const toast = {
    info: (message: string) => useToastStore.getState().push('info', message),
    success: (message: string) => useToastStore.getState().push('success', message),
    error: (message: string) => useToastStore.getState().push('error', message),
};

export function installToastAsAlert(): void {
    window.alert = (message?: string) => {
        toast.info(String(message ?? ''));
    };
}
