import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const focusableIn = (container: HTMLElement | null) =>
    Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
        .filter((node) => !node.hasAttribute('disabled'));

/**
 * Dialog focus behaviour: lock the page behind, move focus in on open, keep Tab inside, close on
 * Escape, and hand focus back to whatever opened it.
 *
 * Extracted so there is one implementation. Dialogs that carry their own markup and styling can have
 * the behaviour without adopting the Modal component's appearance — and without a second copy of the
 * effect that has to be fixed separately when it goes wrong.
 *
 * The split between the two effects is deliberate. Callers hold form state above the dialog and pass
 * an inline arrow as onClose, so onClose changes identity on every keystroke. Anything depending on it
 * re-runs that often, which is fine for an event listener and ruinous for focus: the open effect used
 * to tear down mid-typing, return focus to the page underneath, then pull it to the first control in
 * the dialog — the close button.
 */
export function useDialogFocus(
    isOpen: boolean,
    onClose: () => void,
    containerRef: RefObject<HTMLElement | null>,
) {
    // Open and close only — never onClose, for the reason above.
    useEffect(() => {
        if (!isOpen) return undefined;

        const previouslyFocused = document.activeElement as HTMLElement | null;
        document.body.style.overflow = 'hidden';

        window.requestAnimationFrame(() => {
            const nodes = focusableIn(containerRef.current);
            // Landing on the dismiss control means the first Enter throws the dialog away.
            const preferred = nodes.find((node) => !node.className.includes('close'));
            (preferred ?? nodes[0])?.focus();
        });

        return () => {
            document.body.style.overflow = '';
            previouslyFocused?.focus();
        };
    }, [isOpen, containerRef]);

    // Escape may depend on onClose honestly: re-attaching a listener moves no focus.
    useEffect(() => {
        if (!isOpen) return undefined;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Tab stays inside the dialog.
    useEffect(() => {
        if (!isOpen) return undefined;

        const handleTab = (event: KeyboardEvent) => {
            if (event.key !== 'Tab' || !containerRef.current) return;

            const nodes = focusableIn(containerRef.current);
            if (nodes.length === 0) return;

            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            const active = document.activeElement;

            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleTab);
        return () => document.removeEventListener('keydown', handleTab);
    }, [isOpen, containerRef]);
}
