import React, { useEffect, useRef, useState } from 'react';
import contentService from '../../services/content.service';
import './Media.css';

interface PdfViewerProps {
    itemId: string;
    fileName?: string | null;
    onOpened?: () => void;
}

/**
 * Renders a document item page by page with pdf.js. The file is fetched with the caller's token (a plain
 * link or iframe could not carry it) and drawn onto canvases, which the page's CSP allows.
 */
export const PdfViewer: React.FC<PdfViewerProps> = ({ itemId, fileName, onOpened }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [pageCount, setPageCount] = useState(0);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let url: string | null = null;
        const container = containerRef.current;
        setStatus('loading');

        (async () => {
            try {
                const [data, pdfjsLib, { default: worker }] = await Promise.all([
                    contentService.getFile(itemId),
                    import('pdfjs-dist'),
                    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
                ]);
                if (cancelled || !container) return;

                url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
                setBlobUrl(url);

                pdfjsLib.GlobalWorkerOptions.workerSrc = worker;
                const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
                if (cancelled) return;
                setPageCount(pdf.numPages);
                container.replaceChildren();

                const width = Math.min(container.clientWidth || 800, 1000);
                for (let n = 1; n <= pdf.numPages && !cancelled; n++) {
                    const page = await pdf.getPage(n);
                    const base = page.getViewport({ scale: 1 });
                    const scale = width / base.width;
                    const viewport = page.getViewport({ scale: scale * window.devicePixelRatio });
                    const canvas = document.createElement('canvas');
                    canvas.className = 'pdf-page';
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    canvas.style.width = `${width}px`;
                    canvas.setAttribute('aria-label', `Sayfa ${n}`);
                    container.appendChild(canvas);
                    await page.render({ canvas, viewport }).promise;
                    if (n === 1) {
                        setStatus('ready');
                        onOpened?.();
                    }
                }
            } catch {
                if (!cancelled) setStatus('error');
            }
        })();

        return () => {
            cancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, [itemId, onOpened]);

    return (
        <div className="pdf-viewer">
            <div className="pdf-toolbar">
                <span>{status === 'ready' ? `${pageCount} sayfa` : status === 'loading' ? 'Belge yükleniyor…' : ''}</span>
                {blobUrl && (
                    <a href={blobUrl} download={fileName || 'belge.pdf'} className="pdf-download">İndir / Yazdır</a>
                )}
            </div>
            {status === 'error' && <div className="media-error" role="alert">Belge açılamadı.</div>}
            <div ref={containerRef} className="pdf-pages" />
        </div>
    );
};

export default PdfViewer;
