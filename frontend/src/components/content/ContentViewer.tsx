import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui';
import { VideoPlayer } from '../media/VideoPlayer';
import { PdfViewer } from '../media/PdfViewer';
import contentService from '../../services/content.service';
import type { ContentItem } from '../../types/content';
import { isDocumentType, isVideoType } from '../../utils/content';
import '../media/Media.css';

interface ContentViewerProps {
    item: ContentItem;
    /** Students record progress; teachers and admins only preview. */
    trackProgress: boolean;
    onCompleted?: () => void;
}

/** Shows any content item the way its type needs: HLS video, paged PDF, or an embedded activity. */
export const ContentViewer: React.FC<ContentViewerProps> = ({ item, trackProgress, onCompleted }) => {
    const markDone = useCallback(() => {
        if (!trackProgress || item.progress?.completed) return;
        contentService.saveProgress(item.id, 0, true).then(() => onCompleted?.()).catch(() => undefined);
    }, [item.id, item.progress?.completed, trackProgress, onCompleted]);

    const onVideoProgress = useCallback((_position: number, completed: boolean) => {
        if (completed) onCompleted?.();
    }, [onCompleted]);
    const navigate = useNavigate();

    if (item.locked) {
        return (
            <div className="media-frame">
                <div className="media-error content-locked" role="note">
                    <span className="content-locked-icon" aria-hidden="true">🔒</span>
                    <strong>Bu içerik paketlere dahil</strong>
                    <span>Temel, Plus ve Premium paketlerde, kendi sınıf düzeyinde açılır.</span>
                    <Button variant="primary" size="sm" onClick={() => navigate('/app/paketler')}>Paketleri gör</Button>
                </div>
            </div>
        );
    }

    if (item.processingStatus !== 'Ready' && item.type !== 'Embed') {
        return (
            <div className="media-frame">
                <div className="media-error">
                    {item.processingStatus === 'Failed'
                        ? 'Bu içerik hazırlanırken bir hata oluştu.'
                        : 'Bu içerik henüz hazırlanıyor. Biraz sonra tekrar deneyin.'}
                </div>
            </div>
        );
    }

    if (isVideoType(item.type)) {
        return (
            <VideoPlayer
                itemId={item.id}
                startAt={item.progress?.completed ? 0 : item.progress?.positionSeconds ?? 0}
                trackProgress={trackProgress}
                onProgressSaved={onVideoProgress}
            />
        );
    }

    if (isDocumentType(item.type)) {
        // Opening a document is as far as we can tell it was read.
        return <PdfViewer itemId={item.id} fileName={item.originalFileName} onOpened={markDone} />;
    }

    if (item.type === 'Embed' && item.embedUrl) {
        return (
            <div>
                <div className="media-frame">
                    <iframe
                        className="media-embed"
                        src={item.embedUrl}
                        title={item.title}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                        allow="fullscreen; autoplay; encrypted-media"
                        referrerPolicy="no-referrer"
                    />
                </div>
                <div className="row-actions" style={{ marginTop: 12 }}>
                    <a href={item.embedUrl} target="_blank" rel="noopener noreferrer">Yeni sekmede aç ↗</a>
                    {trackProgress && !item.progress?.completed && (
                        <Button size="sm" variant="secondary" onClick={markDone}>Tamamladım</Button>
                    )}
                </div>
            </div>
        );
    }

    return <p className="content-muted">Bu içerik görüntülenemiyor.</p>;
};

export default ContentViewer;
