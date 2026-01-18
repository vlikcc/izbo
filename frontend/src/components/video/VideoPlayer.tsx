import React, { useRef, useState, useEffect } from 'react';
import './VideoPlayer.css';

interface VideoPlayerProps {
    src: string;
    poster?: string;
    title?: string;
    onEnded?: () => void;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
    src,
    poster,
    title,
    onEnded,
    onTimeUpdate
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleLoadedMetadata = () => {
            setDuration(video.duration);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            onTimeUpdate?.(video.currentTime, video.duration);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            onEnded?.();
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('ended', handleEnded);
        };
    }, [onEnded, onTimeUpdate]);

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;

        if (isPlaying) {
            video.pause();
        } else {
            video.play();
        }
        setIsPlaying(!isPlaying);
    };

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;

        video.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const toggleFullscreen = () => {
        const container = videoRef.current?.parentElement;
        if (!container) return;

        if (!isFullscreen) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
        setIsFullscreen(!isFullscreen);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        setVolume(value);
        if (videoRef.current) {
            videoRef.current.volume = value;
            setIsMuted(value === 0);
        }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressRef.current || !videoRef.current) return;
        
        const rect = progressRef.current.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const newTime = percent * duration;
        
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handlePlaybackRateChange = (rate: number) => {
        if (videoRef.current) {
            videoRef.current.playbackRate = rate;
            setPlaybackRate(rate);
        }
        setShowSettings(false);
    };

    const skip = (seconds: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
        }
    };

    const formatTime = (time: number): string => {
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        const seconds = Math.floor(time % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeout.current) {
            clearTimeout(controlsTimeout.current);
        }
        if (isPlaying) {
            controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
        }
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div 
            className={`video-player ${isFullscreen ? 'fullscreen' : ''}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
        >
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                onClick={togglePlay}
                className="video-element"
            />

            {/* Play Overlay */}
            {!isPlaying && (
                <div className="play-overlay" onClick={togglePlay}>
                    <button className="play-button-large">▶</button>
                </div>
            )}

            {/* Controls */}
            <div className={`video-controls ${showControls ? 'visible' : ''}`}>
                {title && <div className="video-title">{title}</div>}

                {/* Progress Bar */}
                <div 
                    className="progress-container"
                    ref={progressRef}
                    onClick={handleProgressClick}
                >
                    <div className="progress-bar">
                        <div 
                            className="progress-filled"
                            style={{ width: `${progress}%` }}
                        ></div>
                        <div 
                            className="progress-handle"
                            style={{ left: `${progress}%` }}
                        ></div>
                    </div>
                </div>

                <div className="controls-row">
                    <div className="controls-left">
                        <button onClick={togglePlay} className="control-btn">
                            {isPlaying ? '⏸' : '▶'}
                        </button>
                        <button onClick={() => skip(-10)} className="control-btn skip">
                            -10s
                        </button>
                        <button onClick={() => skip(10)} className="control-btn skip">
                            +10s
                        </button>

                        <div className="volume-control">
                            <button onClick={toggleMute} className="control-btn">
                                {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="volume-slider"
                            />
                        </div>

                        <span className="time-display">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    <div className="controls-right">
                        <div className="settings-container">
                            <button 
                                onClick={() => setShowSettings(!showSettings)} 
                                className="control-btn"
                            >
                                ⚙️ {playbackRate}x
                            </button>
                            {showSettings && (
                                <div className="settings-menu">
                                    <div className="settings-title">Oynatma Hızı</div>
                                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                                        <button
                                            key={rate}
                                            onClick={() => handlePlaybackRateChange(rate)}
                                            className={`settings-item ${playbackRate === rate ? 'active' : ''}`}
                                        >
                                            {rate}x
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={toggleFullscreen} className="control-btn">
                            {isFullscreen ? '⛶' : '⛶'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
