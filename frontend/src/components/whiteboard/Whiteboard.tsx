import React, { useRef, useState, useEffect, useCallback } from 'react';
import './Whiteboard.css';

interface Point {
    x: number;
    y: number;
}

interface DrawElement {
    id: string;
    type: 'path' | 'line' | 'rectangle' | 'circle' | 'text';
    points?: Point[];
    start?: Point;
    end?: Point;
    color: string;
    strokeWidth: number;
    text?: string;
}

interface WhiteboardProps {
    width?: number;
    height?: number;
    onElementsChange?: (elements: DrawElement[]) => void;
    initialElements?: DrawElement[];
    readOnly?: boolean;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
    width = 1200,
    height = 800,
    onElementsChange,
    initialElements = [],
    readOnly = false
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [elements, setElements] = useState<DrawElement[]>(initialElements);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentElement, setCurrentElement] = useState<DrawElement | null>(null);
    const [tool, setTool] = useState<'pen' | 'line' | 'rectangle' | 'circle' | 'eraser' | 'text'>('pen');
    const [color, setColor] = useState('#ffffff');
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const colors = [
        '#ffffff', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
        '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe', '#667eea'
    ];

    const strokeWidths = [2, 4, 6, 8, 12];

    // Render all elements to canvas
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        const gridSize = 20;
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Draw all elements
        [...elements, currentElement].filter(Boolean).forEach(element => {
            if (!element) return;

            ctx.strokeStyle = element.color;
            ctx.fillStyle = element.color;
            ctx.lineWidth = element.strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            switch (element.type) {
                case 'path':
                    if (element.points && element.points.length > 1) {
                        ctx.beginPath();
                        ctx.moveTo(element.points[0].x, element.points[0].y);
                        for (let i = 1; i < element.points.length; i++) {
                            ctx.lineTo(element.points[i].x, element.points[i].y);
                        }
                        ctx.stroke();
                    }
                    break;

                case 'line':
                    if (element.start && element.end) {
                        ctx.beginPath();
                        ctx.moveTo(element.start.x, element.start.y);
                        ctx.lineTo(element.end.x, element.end.y);
                        ctx.stroke();
                    }
                    break;

                case 'rectangle':
                    if (element.start && element.end) {
                        const w = element.end.x - element.start.x;
                        const h = element.end.y - element.start.y;
                        ctx.strokeRect(element.start.x, element.start.y, w, h);
                    }
                    break;

                case 'circle':
                    if (element.start && element.end) {
                        const radiusX = Math.abs(element.end.x - element.start.x) / 2;
                        const radiusY = Math.abs(element.end.y - element.start.y) / 2;
                        const centerX = (element.start.x + element.end.x) / 2;
                        const centerY = (element.start.y + element.end.y) / 2;
                        ctx.beginPath();
                        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
                        ctx.stroke();
                    }
                    break;

                case 'text':
                    if (element.start && element.text) {
                        ctx.font = `${element.strokeWidth * 6}px Inter, sans-serif`;
                        ctx.fillText(element.text, element.start.x, element.start.y);
                    }
                    break;
            }
        });
    }, [elements, currentElement]);

    useEffect(() => {
        render();
    }, [render]);

    useEffect(() => {
        onElementsChange?.(elements);
    }, [elements, onElementsChange]);

    const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (readOnly) return;

        const pos = getMousePos(e);
        setIsDrawing(true);

        if (tool === 'text') {
            const text = prompt('Metin girin:');
            if (text) {
                const newElement: DrawElement = {
                    id: Date.now().toString(),
                    type: 'text',
                    start: pos,
                    color,
                    strokeWidth,
                    text
                };
                setElements(prev => [...prev, newElement]);
            }
            return;
        }

        if (tool === 'eraser') {
            // Find and remove element near click
            const threshold = 20;
            setElements(prev => prev.filter(el => {
                if (el.type === 'path' && el.points) {
                    return !el.points.some(p => 
                        Math.abs(p.x - pos.x) < threshold && 
                        Math.abs(p.y - pos.y) < threshold
                    );
                }
                return true;
            }));
            return;
        }

        const newElement: DrawElement = {
            id: Date.now().toString(),
            type: tool === 'pen' ? 'path' : tool,
            points: tool === 'pen' ? [pos] : undefined,
            start: tool !== 'pen' ? pos : undefined,
            end: tool !== 'pen' ? pos : undefined,
            color,
            strokeWidth
        };

        setCurrentElement(newElement);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !currentElement || readOnly) return;

        const pos = getMousePos(e);

        if (currentElement.type === 'path') {
            setCurrentElement(prev => prev ? {
                ...prev,
                points: [...(prev.points || []), pos]
            } : null);
        } else {
            setCurrentElement(prev => prev ? {
                ...prev,
                end: pos
            } : null);
        }
    };

    const handleMouseUp = () => {
        if (currentElement && !readOnly) {
            setElements(prev => [...prev, currentElement]);
            setCurrentElement(null);
        }
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        setElements([]);
    };

    const undo = () => {
        setElements(prev => prev.slice(0, -1));
    };

    const downloadCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = `whiteboard-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    };

    return (
        <div className="whiteboard-container">
            {!readOnly && (
                <div className="whiteboard-toolbar">
                    <div className="tool-group">
                        <button
                            className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
                            onClick={() => setTool('pen')}
                            title="Kalem"
                        >
                            ✏️
                        </button>
                        <button
                            className={`tool-btn ${tool === 'line' ? 'active' : ''}`}
                            onClick={() => setTool('line')}
                            title="Çizgi"
                        >
                            📏
                        </button>
                        <button
                            className={`tool-btn ${tool === 'rectangle' ? 'active' : ''}`}
                            onClick={() => setTool('rectangle')}
                            title="Dikdörtgen"
                        >
                            ⬜
                        </button>
                        <button
                            className={`tool-btn ${tool === 'circle' ? 'active' : ''}`}
                            onClick={() => setTool('circle')}
                            title="Daire"
                        >
                            ⭕
                        </button>
                        <button
                            className={`tool-btn ${tool === 'text' ? 'active' : ''}`}
                            onClick={() => setTool('text')}
                            title="Metin"
                        >
                            🔤
                        </button>
                        <button
                            className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                            onClick={() => setTool('eraser')}
                            title="Silgi"
                        >
                            🧽
                        </button>
                    </div>

                    <div className="tool-group">
                        <div className="color-picker-container">
                            <button
                                className="tool-btn color-btn"
                                onClick={() => setShowColorPicker(!showColorPicker)}
                                style={{ backgroundColor: color }}
                            />
                            {showColorPicker && (
                                <div className="color-picker-dropdown">
                                    {colors.map(c => (
                                        <button
                                            key={c}
                                            className={`color-option ${color === c ? 'active' : ''}`}
                                            style={{ backgroundColor: c }}
                                            onClick={() => {
                                                setColor(c);
                                                setShowColorPicker(false);
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="tool-group stroke-group">
                        {strokeWidths.map(w => (
                            <button
                                key={w}
                                className={`stroke-btn ${strokeWidth === w ? 'active' : ''}`}
                                onClick={() => setStrokeWidth(w)}
                            >
                                <span style={{ width: w * 2, height: w * 2 }} />
                            </button>
                        ))}
                    </div>

                    <div className="tool-group">
                        <button className="tool-btn" onClick={undo} title="Geri Al">
                            ↩️
                        </button>
                        <button className="tool-btn" onClick={clearCanvas} title="Temizle">
                            🗑️
                        </button>
                        <button className="tool-btn" onClick={downloadCanvas} title="İndir">
                            💾
                        </button>
                    </div>
                </div>
            )}

            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="whiteboard-canvas"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            />
        </div>
    );
};
