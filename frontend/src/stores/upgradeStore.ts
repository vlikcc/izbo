import { create } from 'zustand';
import type { QuotaExceededInfo } from '../types';

interface UpgradeState {
    isOpen: boolean;
    info: QuotaExceededInfo | null;
    open: (info: QuotaExceededInfo) => void;
    close: () => void;
}

export const useUpgradeStore = create<UpgradeState>((set) => ({
    isOpen: false,
    info: null,
    open: (info: QuotaExceededInfo) => set({ isOpen: true, info }),
    close: () => set({ isOpen: false, info: null }),
}));

export default useUpgradeStore;
