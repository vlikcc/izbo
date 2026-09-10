import React, { useEffect, useRef } from 'react';
import './Modal.css';

const FOCUSABLE_SELECTOR =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    // Opening and closing only. Keeping onClose out of the dependencies is the point: callers pass an
    // inline arrow and hold the form state above the dialog, so every keystroke handed this effect a
    // new function. It then tore down and re-ran mid-typing — restoring focus to the page underneath,
    // then pulling it to the first control in the dialog — which read as the close button stealing
    // focus on every key.
    useEffect(() => {
        if (!isOpen) return undefined;

        previouslyFocused.current = document.activeElement as HTMLElement | null;
        document.body.style.overflow = 'hidden';
        window.requestAnimationFrame(() => {
            const nodes = Array.from(
                modalRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
            ).filter((node) => !node.hasAttribute('disabled'));
            // Landing on the dismiss control means the first Enter throws the dialog away.
            const preferred = nodes.find((node) => !node.classList.contains('modal-close'));
            (preferred ?? nodes[0])?.focus();
        });

        return () => {
            document.body.style.overflow = '';
            previouslyFocused.current?.focus();
        };
    }, [isOpen]);

    // Escape lives on its own so it can depend on onClose honestly. Re-attaching a listener when the
    // callback changes costs nothing and moves no focus.
    useEffect(() => {
        if (!isOpen) return undefined;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleTab = (event: KeyboardEvent) => {
            if (event.key !== 'Tab' || !modalRef.current) return;
            const nodes = Array.from(
                modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
            ).filter((node) => !node.hasAttribute('disabled'));
            if (nodes.length === 0) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleTab);
        return () => document.removeEventListener('keydown', handleTab);
    }, [isOpen]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div
                className={`modal modal-${size}`}
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? 'modal-title' : undefined}
            >
                {title && (
                    <div className="modal-header">
                        <h2 className="modal-title" id="modal-title">{title}</h2>
                        <button type="button" className="modal-close" onClick={onClose} aria-label="Kapat">
                            ✕
                        </button>
                    </div>
                )}
                <div className="modal-body">{children}</div>
            </div>
        </div>
    );
};

export default Modal;
