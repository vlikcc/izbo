import React, { useEffect, useRef, useState } from 'react';
import './FloatingToolbar.css';

type Orientation = 'horizontal' | 'vertical';

interface StoredState {
    x: number;
    y: number;
    orientation: Orientation;
}

function loadStored(storageKey: string): StoredState | null {
    try {
        const raw = localStorage.getItem(storageKey);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), Math.max(min, max));
}

interface FloatingToolbarProps {
    storageKey: string;
    defaultPosition: () => { x: number; y: number };
    defaultOrientation?: Orientation;
    children: React.ReactNode;
}

/// A draggable, dockable-orientation toolbar shell. Used for both the live-class controls
/// (mic/camera/hand/etc.) and the whiteboard's drawing tools so a teacher can move either one
/// out of the way instead of the two permanently overlapping at the bottom of the screen.
export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
    storageKey,
    defaultPosition,
    defaultOrientation = 'horizontal',
    children,
}) => {
    const toolbarRef = useRef<HTMLDivElement>(null);
    const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
    const [position, setPosition] = useState(() => {
        const stored = loadStored(storageKey);
        const { x, y } = stored ? { x: stored.x, y: stored.y } : defaultPosition();
        // toolbarRef isn't attached yet on first render, so clamp against an estimated size —
        // good enough to keep a stale stored position from landing fully off-screen.
        return { x: clamp(x, 8, window.innerWidth - 68), y: clamp(y, 8, window.innerHeight - 68) };
    });
    const [orientation, setOrientation] = useState<Orientation>(() => loadStored(storageKey)?.orientation ?? defaultOrientation);

    const persist = (next: Partial<StoredState>) => {
        try {
            localStorage.setItem(storageKey, JSON.stringify({ ...position, orientation, ...next }));
        } catch {
            // Ignore storage failures (private mode, quota, etc.) — dragging still works for this session.
        }
    };

    const clampToViewport = (x: number, y: number) => {
        const el = toolbarRef.current;
        const width = el?.offsetWidth ?? 60;
        const height = el?.offsetHeight ?? 60;
        return {
            x: clamp(x, 8, window.innerWidth - width - 8),
            y: clamp(y, 8, window.innerHeight - height - 8),
        };
    };

    // Re-clamp on viewport resize so the toolbar never drifts off-screen (the initial position
    // is already clamped in the useState initializer above using the window size at mount time).
    useEffect(() => {
        const onResize = () => setPosition((prev) => clampToViewport(prev.x, prev.y));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        dragState.current = { startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y };

        const handleMove = (moveEvent: PointerEvent) => {
            if (!dragState.current) return;
            const dx = moveEvent.clientX - dragState.current.startX;
            const dy = moveEvent.clientY - dragState.current.startY;
            setPosition(clampToViewport(dragState.current.originX + dx, dragState.current.originY + dy));
        };

        const handleUp = () => {
            dragState.current = null;
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            setPosition((prev) => {
                persist({ x: prev.x, y: prev.y });
                return prev;
            });
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
    };

    const toggleOrientation = () => {
        setOrientation((prev) => {
            const next = prev === 'horizontal' ? 'vertical' : 'horizontal';
            persist({ orientation: next });
            return next;
        });
    };

    return (
        <div
            ref={toolbarRef}
            className={`floating-toolbar ${orientation}`}
            style={{ left: position.x, top: position.y }}
        >
            <button
                className="floating-toolbar-handle"
                onPointerDown={handlePointerDown}
                title="Taşımak için sürükleyin"
                aria-label="Taşı"
            >
                ⠿
            </button>
            <div className="floating-toolbar-items">{children}</div>
            <button
                className="floating-toolbar-rotate"
                onClick={toggleOrientation}
                title={orientation === 'horizontal' ? 'Dikey çevir' : 'Yatay çevir'}
                aria-label="Yönü değiştir"
            >
                ⤾
            </button>
        </div>
    );
};

export default FloatingToolbar;
