import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import contentService from '../../services/content.service';
import './Media.css';

interface VideoPlayerProps {
    itemId: string;
    /** Where the learner left off; playback starts here. */
    startAt?: number;
    /** Whether watching is recorded (students); previews by teachers and admins are not. */
    trackProgress?: boolean;
    onProgressSaved?: (positionSeconds: number, completed: boolean) => void;
}

const SAVE_EVERY_MS = 15_000;

/**
 * Plays a content item's HLS stream. Playlists and segments come from the API behind the same access
 * check as the item, so every request carries the learner's bearer token, read fresh each time so a
 * refreshed token is picked up mid-video.
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({ itemId, startAt = 0, trackProgress = true, onProgressSaved }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastSaved = useRef(0);
    const [error, setError] = useState('');
    // Without MediaSource there is no way to attach the token to segment requests.
    const [supported] = useState(() => Hls.isSupported());

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !supported) return;

        const src = contentService.hlsUrl(itemId);
        let triedRefresh = false;

        const seekToStart = () => {
            if (startAt > 5 && video.duration && startAt < video.duration - 5) {
                video.currentTime = startAt;
            }
        };

        const hls = new Hls({
            xhrSetup: xhr => {
                const token = localStorage.getItem('accessToken');
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            },
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.addEventListener('loadedmetadata', seekToStart, { once: true });
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            const status = (data.response as { code?: number } | undefined)?.code;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && status === 401 && !triedRefresh) {
                // The access token expired mid-video: any API call runs the refresh interceptor.
                triedRefresh = true;
                contentService.getItem(itemId).then(() => hls.startLoad()).catch(() => setError('Oturum süresi doldu; sayfayı yenileyin.'));
                return;
            }
            setError(status === 404 ? 'Video henüz hazır değil.' : 'Video oynatılamadı.');
            hls?.destroy();
        });
        hls.loadSource(src);
        hls.attachMedia(video);

        return () => {
            hls.destroy();
        };
    }, [itemId, startAt, supported]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !trackProgress) return;

        const save = (completed = false) => {
            const position = Math.floor(video.currentTime);
            if (!completed && Math.abs(position - lastSaved.current) < 5) return;
            lastSaved.current = position;
            contentService.saveProgress(itemId, position, completed)
                .then(p => onProgressSaved?.(p.positionSeconds, p.completed))
                .catch(() => { /* progress is best-effort; the next save retries */ });
        };

        const timer = window.setInterval(() => {
            if (!video.paused) save();
        }, SAVE_EVERY_MS);
        const onPause = () => save();
        const onEnded = () => save(true);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);

        return () => {
            window.clearInterval(timer);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('ended', onEnded);
            if (video.currentTime > 0) save();
        };
    }, [itemId, trackProgress, onProgressSaved]);

    return (
        <div className="media-frame">
            <video ref={videoRef} className="media-video" controls playsInline preload="metadata" />
            {(error || !supported) && (
                <div className="media-error" role="alert">
                    {error || 'Bu tarayıcı video oynatmayı desteklemiyor. Güncel bir Chrome, Edge, Firefox veya Safari kullanın.'}
                </div>
            )}
        </div>
    );
};

export default VideoPlayer;
