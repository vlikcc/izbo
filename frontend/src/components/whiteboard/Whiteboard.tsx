import React, { useRef, useState, useEffect, useCallback } from 'react';

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
    const [color, setColor] = useState('#f43f5e');
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const colors = [
        '#f43f5e', '#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4',
        '#10b981', '#84cc16', '#eab308', '#f97316', '#1f2937'
    ];

    const strokeWidths = [2, 4, 6, 8, 12];

    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas with light background
        ctx.fillStyle = '#fef2f2';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = 'rgba(251, 113, 133, 0.1)';
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
        <div className="flex flex-col bg-white rounded-2xl border border-rose-100 overflow-hidden">
            {!readOnly && (
                <div className="flex flex-wrap items-center gap-4 p-4 bg-rose-50 border-b border-rose-100">
                    {/* Tools */}
                    <div className="flex items-center gap-1 bg-white rounded-xl p-1">
                        <button
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                                tool === 'pen' ? 'bg-rose-500 text-white' : 'text-gray-600 hover:bg-rose-100'
                            }`}
                            onClick={() => setTool('pen')}
                            title="Kalem"
                        >
                            ✏️
                        </button>
                        <button
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                                tool === 'line' ? 'bg-rose-500 text-white' : 'text-gray-600 hover:bg-rose-100'
                            }`}
                            onClick={() => setTool('line')}
                            title="Çizgi"
                        >
                            📏
                        </button>
                        <button
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                                tool === 'rectangle' ? 'bg-rose-500 text-white' : 'text-gray-600 hover:bg-rose-100'
                            }`}
                            onClick={() => setTool('rectangle')}
                            title="Dikdörtgen"
                        >
                            ⬜
                        </button>
                        <button
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                                tool === 'circle' ? 'bg-rose-500 text-white' : 'text-gray-600 hover:bg-rose-100'
                            }`}
                            onClick={() => setTool('circle')}
                            title="Daire"
                        >
                            ⭕
                        </button>
                        <button
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                                tool === 'text' ? 'bg-rose-500 text-white' : 'text-gray-600 hover:bg-rose-100'
                            }`}
                            onClick={() => setTool('text')}
                            title="Metin"
                        >
                            🔤
                        </button>
                        <button
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                                tool === 'eraser' ? 'bg-rose-500 text-white' : 'text-gray-600 hover:bg-rose-100'
                            }`}
                            onClick={() => setTool('eraser')}
                            title="Silgi"
                        >
                            🧽
                        </button>
                    </div>

                    {/* Color Picker */}
                    <div className="relative">
                        <button
                            className="w-10 h-10 rounded-xl border-2 border-white shadow-md"
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            style={{ backgroundColor: color }}
                        />
                        {showColorPicker && (
                            <div className="absolute top-full left-0 mt-2 p-2 bg-white rounded-xl shadow-lg border border-rose-100 grid grid-cols-5 gap-1 z-10">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 ${
                                            color === c ? 'ring-2 ring-rose-500 ring-offset-2' : ''
                                        }`}
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

                    {/* Stroke Width */}
                    <div className="flex items-center gap-1 bg-white rounded-xl p-1">
                        {strokeWidths.map(w => (
                            <button
                                key={w}
                                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                                    strokeWidth === w ? 'bg-rose-100' : 'hover:bg-gray-100'
                                }`}
                                onClick={() => setStrokeWidth(w)}
                            >
                                <span 
                                    className="rounded-full bg-gray-700"
                                    style={{ width: w * 2, height: w * 2 }} 
                                />
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 bg-white rounded-xl p-1 ml-auto">
                        <button 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-600 hover:bg-rose-100 transition-colors"
                            onClick={undo} 
                            title="Geri Al"
                        >
                            ↩️
                        </button>
                        <button 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-600 hover:bg-rose-100 transition-colors"
                            onClick={clearCanvas} 
                            title="Temizle"
                        >
                            🗑️
                        </button>
                        <button 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-600 hover:bg-rose-100 transition-colors"
                            onClick={downloadCanvas} 
                            title="İndir"
                        >
                            💾
                        </button>
                    </div>
                </div>
            )}

            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="w-full cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            />
        </div>
    );
};
