import React, { useEffect, useState } from 'react';
import { Tldraw, createTLStore, defaultShapeUtils, getSnapshot, loadSnapshot, DefaultColorStyle, type Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import type { HubConnection } from '@microsoft/signalr';
import { FloatingToolbar } from './FloatingToolbar';
import './Whiteboard.css';

interface WhiteboardDiffPayload {
    added: unknown[];
    updated: unknown[];
    removed: string[];
}

interface WhiteboardProps {
    connection: HubConnection;
    sessionId: string;
    isInstructor: boolean;
    onClose: () => void;
}

const TOOLS: Array<{ id: string; icon: string; label: string }> = [
    { id: 'select', icon: '↖️', label: 'Seç' },
    { id: 'draw', icon: '✏️', label: 'Kalem' },
    { id: 'eraser', icon: '🧹', label: 'Silgi' },
    { id: 'geo', icon: '▭', label: 'Dikdörtgen' },
    { id: 'arrow', icon: '➜', label: 'Ok' },
    { id: 'text', icon: 'T', label: 'Metin' },
];

const COLORS: Array<{ id: string; hex: string }> = [
    { id: 'black', hex: '#1d1d1d' },
    { id: 'red', hex: '#e03131' },
    { id: 'blue', hex: '#1971c2' },
    { id: 'green', hex: '#2f9e44' },
];

/// Shared drawing surface for a live class. Only the instructor can draw — students get a
/// read-only view. Changes sync as tldraw store diffs over the room's existing SignalR
/// connection (ClassroomHub); a late-joining student receives a one-time full snapshot from
/// the instructor's client so they see what's already on the board. tldraw's own default UI is
/// hidden (hideUi) and replaced by our draggable FloatingToolbar so it doesn't permanently
/// overlap the live-class controls bar.
export const Whiteboard: React.FC<WhiteboardProps> = ({ connection, sessionId, isInstructor, onClose }) => {
    const [store] = useState(() => createTLStore({ shapeUtils: defaultShapeUtils }));
    const [editor, setEditor] = useState<Editor | null>(null);
    const [activeTool, setActiveTool] = useState('draw');

    useEffect(() => {
        const handleDiff = (diffJson: string) => {
            const diff: WhiteboardDiffPayload = JSON.parse(diffJson);
            store.mergeRemoteChanges(() => {
                if (diff.added.length || diff.updated.length) {
                    store.put([...diff.added, ...diff.updated] as Parameters<typeof store.put>[0]);
                }
                if (diff.removed.length) {
                    store.remove(diff.removed as Parameters<typeof store.remove>[0]);
                }
            });
        };

        const handleSnapshot = (snapshotJson: string) => {
            const document = JSON.parse(snapshotJson);
            loadSnapshot(store, { document });
        };

        connection.on('WhiteboardDiff', handleDiff);
        connection.on('WhiteboardSnapshot', handleSnapshot);

        // Instructor: push the current board to anyone who joins the room after drawing started.
        const handleParticipantJoined = (participant: { userId: string }) => {
            if (!isInstructor) return;
            const { document } = getSnapshot(store);
            connection.invoke('SendWhiteboardSnapshot', sessionId, participant.userId, JSON.stringify(document));
        };
        if (isInstructor) {
            connection.on('ParticipantJoined', handleParticipantJoined);
        }

        return () => {
            connection.off('WhiteboardDiff', handleDiff);
            connection.off('WhiteboardSnapshot', handleSnapshot);
            if (isInstructor) connection.off('ParticipantJoined', handleParticipantJoined);
        };
    }, [connection, sessionId, isInstructor, store]);

    const handleMount = (mountedEditor: Editor) => {
        if (!isInstructor) {
            mountedEditor.updateInstanceState({ isReadonly: true });
            return;
        }

        mountedEditor.setCurrentTool('draw');
        setEditor(mountedEditor);

        mountedEditor.store.listen(
            (entry) => {
                const diff: WhiteboardDiffPayload = {
                    added: Object.values(entry.changes.added),
                    updated: Object.values(entry.changes.updated).map(([, to]) => to),
                    removed: Object.keys(entry.changes.removed),
                };
                if (!diff.added.length && !diff.updated.length && !diff.removed.length) return;
                connection.invoke('SendWhiteboardDiff', sessionId, JSON.stringify(diff));
            },
            { source: 'user', scope: 'document' }
        );
    };

    const selectTool = (toolId: string) => {
        editor?.setCurrentTool(toolId);
        setActiveTool(toolId);
    };

    const selectColor = (colorId: string) => {
        editor?.setStyleForNextShapes(DefaultColorStyle, colorId);
    };

    const clearBoard = () => {
        if (!editor) return;
        editor.selectAll();
        editor.deleteShapes(editor.getSelectedShapeIds());
        editor.selectNone();
    };

    return (
        <div className="whiteboard-overlay">
            <div className="whiteboard-canvas">
                <Tldraw store={store} onMount={handleMount} hideUi />
            </div>

            <FloatingToolbar storageKey="whiteboard-controls" defaultPosition={() => ({ x: 16, y: 16 })}>
                <span className="whiteboard-toolbar-title">
                    🖊️ Tahta{!isInstructor && ' (görüntüleme)'}
                </span>
                {isInstructor && (
                    <>
                        {TOOLS.map((tool) => (
                            <button
                                key={tool.id}
                                className={`whiteboard-tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                                onClick={() => selectTool(tool.id)}
                                title={tool.label}
                            >
                                {tool.icon}
                            </button>
                        ))}
                        <span className="whiteboard-toolbar-divider" />
                        {COLORS.map((color) => (
                            <button
                                key={color.id}
                                className="whiteboard-color-btn"
                                style={{ background: color.hex }}
                                onClick={() => selectColor(color.id)}
                                title={color.id}
                            />
                        ))}
                        <span className="whiteboard-toolbar-divider" />
                        <button className="whiteboard-tool-btn" onClick={() => editor?.undo()} title="Geri al">↩️</button>
                        <button className="whiteboard-tool-btn" onClick={() => editor?.redo()} title="Yinele">↪️</button>
                        <button className="whiteboard-tool-btn" onClick={clearBoard} title="Tahtayı temizle">🗑️</button>
                    </>
                )}
                <span className="whiteboard-toolbar-divider" />
                <button className="whiteboard-tool-btn" onClick={onClose} title="Kapat">✕</button>
            </FloatingToolbar>
        </div>
    );
};

export default Whiteboard;
