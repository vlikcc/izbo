import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSignalR } from '../../hooks/useSignalR';
import { useAuthStore } from '../../stores/authStore';
import './LiveSession.css';

interface Participant {
    id: string;
    name: string;
    isMuted: boolean;
    isVideoOff: boolean;
    isHandRaised: boolean;
}

interface ChatMessage {
    userId: string;
    userName: string;
    message: string;
    timestamp: Date;
}

export const LiveSessionPage: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { invokeWhenReady, invoke, on, isConnected, connectionError } = useSignalR('/hubs/live');

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isJoining, setIsJoining] = useState(true);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [mediaError, setMediaError] = useState<string | null>(null);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [screenShareUserId, setScreenShareUserId] = useState<string | null>(null);

    const [isHandRaised, setIsHandRaised] = useState(false);
    const [showChat, setShowChat] = useState(true);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const screenShareRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const hasJoined = useRef(false);
    const eventListenersSet = useRef(false);
    const [localStreamReady, setLocalStreamReady] = useState(false);
    const [screenStreamReady, setScreenStreamReady] = useState(false);

    const isInstructor = user?.role === 'Instructor';

    // Attach local stream to video element when both are ready
    useEffect(() => {
        if (localStreamReady && localVideoRef.current && localStreamRef.current) {
            const video = localVideoRef.current;
            video.srcObject = localStreamRef.current;

            const playVideo = () => {
                video.play().catch(e => {
                    console.log('Video play failed, retrying:', e);
                    // Retry after a short delay
                    setTimeout(() => {
                        video.play().catch(err => console.error('Video play retry failed:', err));
                    }, 100);
                });
            };

            // Wait for metadata to be loaded before playing
            if (video.readyState >= 2) {
                playVideo();
            } else {
                video.onloadedmetadata = playVideo;
            }
        }
    }, [localStreamReady]);

    // Attach screen share stream to video element when both are ready
    useEffect(() => {
        if (screenStreamReady && screenShareRef.current && screenStreamRef.current) {
            const video = screenShareRef.current;
            video.srcObject = screenStreamRef.current;

            const playVideo = () => {
                video.play().catch(e => {
                    console.log('Screen share play failed, retrying:', e);
                    setTimeout(() => {
                        video.play().catch(err => console.error('Screen share play retry failed:', err));
                    }, 100);
                });
            };

            if (video.readyState >= 2) {
                playVideo();
            } else {
                video.onloadedmetadata = playVideo;
            }
        }
    }, [screenStreamReady, isScreenSharing]);

    // Setup event listeners once
    const setupEventListeners = useCallback(() => {
        if (eventListenersSet.current) return;
        eventListenersSet.current = true;

        on('UserJoined', (...args: unknown[]) => {
            const data = args[0] as { userId: string; userName: string; participantCount: number };
            // Don't add ourselves
            if (data.userId === user?.id) return;
            setParticipants(prev => {
                // Prevent duplicates
                if (prev.some(p => p.id === data.userId)) return prev;
                return [...prev, {
                    id: data.userId,
                    name: data.userName || 'Anonim',
                    isMuted: false,
                    isVideoOff: false,
                    isHandRaised: false
                }];
            });
        });

        on('UserLeft', (...args: unknown[]) => {
            const data = args[0] as { userId: string };
            setParticipants(prev => prev.filter(p => p.id !== data.userId));
        });

        on('ReceiveMessage', (...args: unknown[]) => {
            const data = args[0] as ChatMessage;
            setMessages(prev => [...prev, { ...data, timestamp: new Date(data.timestamp) }]);
        });

        on('HandRaised', (...args: unknown[]) => {
            const data = args[0] as { userId: string };
            setParticipants(prev => prev.map(p =>
                p.id === data.userId ? { ...p, isHandRaised: true } : p
            ));
        });

        on('HandLowered', (...args: unknown[]) => {
            const data = args[0] as { userId: string };
            setParticipants(prev => prev.map(p =>
                p.id === data.userId ? { ...p, isHandRaised: false } : p
            ));
        });

        on('UserMuteChanged', (...args: unknown[]) => {
            const data = args[0] as { userId: string; isMuted: boolean };
            setParticipants(prev => prev.map(p =>
                p.id === data.userId ? { ...p, isMuted: data.isMuted } : p
            ));
        });

        on('UserVideoChanged', (...args: unknown[]) => {
            const data = args[0] as { userId: string; isVideoOff: boolean };
            setParticipants(prev => prev.map(p =>
                p.id === data.userId ? { ...p, isVideoOff: data.isVideoOff } : p
            ));
        });

        on('ScreenShareStarted', (...args: unknown[]) => {
            const data = args[0] as { userId: string };
            setScreenShareUserId(data.userId);
        });

        on('ScreenShareStopped', () => {
            setScreenShareUserId(null);
        });

        on('SessionEnded', () => {
            alert('Ders sona erdi');
            navigate('/dashboard');
        });
    }, [on, navigate, user?.id]);

    useEffect(() => {
        if (isConnected && !hasJoined.current) {
            hasJoined.current = true;
            setupEventListeners();
            joinSession();
        }

        return () => {
            if (hasJoined.current) {
                leaveSession();
                cleanupMedia();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, sessionId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const joinSession = async () => {
        try {
            setIsJoining(true);
            setJoinError(null);
            await invokeWhenReady('JoinSession', sessionId);
            await startLocalMedia();
            setIsJoining(false);
        } catch (error) {
            console.error('Failed to join session:', error);
            setJoinError(error instanceof Error ? error.message : 'Bağlantı hatası');
            setIsJoining(false);
        }
    };

    const leaveSession = async () => {
        try {
            if (isConnected) {
                await invoke('LeaveSession', sessionId);
            }
        } catch (error) {
            console.error('Failed to leave session:', error);
        }
    };

    const startLocalMedia = async () => {
        try {
            setMediaError(null);
            setLocalStreamReady(false);

            // First try with both video and audio
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            localStreamRef.current = stream;
            console.log('Media stream acquired:', stream.getTracks().map(t => `${t.kind}: ${t.label}`));

            // Trigger useEffect to attach stream to video element
            setLocalStreamReady(true);
        } catch (error) {
            console.error('Failed to get media:', error);
            // Try with just audio if video fails
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                localStreamRef.current = audioStream;
                setIsVideoOff(true);
                setLocalStreamReady(true);
                setMediaError('Kamera erişimi sağlanamadı. Sadece ses ile devam ediliyor.');
            } catch (audioError) {
                console.error('Failed to get audio:', audioError);
                setMediaError('Mikrofon ve kamera erişimi sağlanamadı. Ayarlarınızı kontrol edin.');
            }
        }
    };

    const cleanupMedia = () => {
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        screenStreamRef.current?.getTracks().forEach(track => track.stop());
    };

    const toggleMute = async () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
                try {
                    await invoke('ToggleMute', sessionId, !audioTrack.enabled);
                } catch (e) {
                    console.error('Failed to sync mute state:', e);
                }
            }
        }
    };

    const toggleVideo = async () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
                try {
                    await invoke('ToggleVideo', sessionId, !videoTrack.enabled);
                } catch (e) {
                    console.error('Failed to sync video state:', e);
                }
            } else {
                // No video track, try to add one
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    const newVideoTrack = stream.getVideoTracks()[0];
                    localStreamRef.current.addTrack(newVideoTrack);
                    // Re-trigger stream attachment
                    setLocalStreamReady(false);
                    setTimeout(() => setLocalStreamReady(true), 50);
                    setIsVideoOff(false);
                    setMediaError(null);
                } catch (e) {
                    console.error('Failed to enable video:', e);
                    setMediaError('Kamera etkinleştirilemedi.');
                }
            }
        }
    };

    const toggleHandRaise = async () => {
        try {
            if (isHandRaised) {
                await invoke('LowerHand', sessionId);
            } else {
                await invoke('RaiseHand', sessionId);
            }
            setIsHandRaised(!isHandRaised);
        } catch (e) {
            console.error('Failed to toggle hand:', e);
        }
    };

    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            // Stop screen sharing
            screenStreamRef.current?.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
            setIsScreenSharing(false);
            setScreenStreamReady(false);
            try {
                await invoke('StopScreenShare', sessionId);
            } catch (e) {
                console.error('Failed to stop screen share:', e);
            }
        } else {
            // Start screen sharing
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        displaySurface: 'monitor'
                    },
                    audio: true
                });

                screenStreamRef.current = stream;
                console.log('Screen share stream acquired:', stream.getTracks().map(t => `${t.kind}: ${t.label}`));

                // First set screen sharing state, then trigger stream ready
                setIsScreenSharing(true);
                // Use setTimeout to ensure the video element is rendered before attaching stream
                setTimeout(() => {
                    setScreenStreamReady(true);
                }, 50);

                await invoke('StartScreenShare', sessionId);

                // Handle when user stops sharing via browser UI
                stream.getVideoTracks()[0].onended = async () => {
                    setIsScreenSharing(false);
                    setScreenStreamReady(false);
                    screenStreamRef.current = null;
                    try {
                        await invoke('StopScreenShare', sessionId);
                    } catch (e) {
                        console.error('Failed to notify screen share stop:', e);
                    }
                };
            } catch (e) {
                console.error('Failed to start screen share:', e);
            }
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !isConnected) return;
        try {
            await invoke('SendMessage', sessionId, newMessage);
            setNewMessage('');
        } catch (e) {
            console.error('Failed to send message:', e);
        }
    };

    const handleLeave = () => {
        if (confirm('Dersten ayrılmak istediğinize emin misiniz?')) {
            cleanupMedia();
            navigate('/dashboard');
        }
    };

    // Show loading or error state
    if (isJoining || !isConnected) {
        return (
            <div className="live-session">
                <div className="live-loading">
                    {connectionError || joinError ? (
                        <>
                            <h2>❌ Bağlantı Hatası</h2>
                            <p>{connectionError || joinError}</p>
                            <button onClick={() => navigate('/dashboard')} className="back-btn">
                                Dashboard'a Dön
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="spinner"></div>
                            <h2>Derse Bağlanılıyor...</h2>
                            <p>Lütfen bekleyin</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="live-session">
            <header className="live-header">
                <div className="live-info">
                    <span className="live-badge">🔴 CANLI</span>
                    <h1>Canlı Ders</h1>
                    <span className="header-participant-count">👥 {participants.length + 1} katılımcı</span>
                    {isInstructor && <span className="instructor-badge">👨‍🏫 Öğretmen</span>}
                </div>
                <button className="leave-btn" onClick={handleLeave}>
                    Dersten Ayrıl
                </button>
            </header>

            {mediaError && (
                <div className="media-error-banner">
                    ⚠️ {mediaError}
                </div>
            )}

            <div className="live-content">
                <main className="video-area">
                    {/* Screen Share View - shows when someone is sharing */}
                    {(isScreenSharing || screenShareUserId) && (
                        <div className="screen-share-container">
                            {isScreenSharing ? (
                                <>
                                    <video
                                        ref={screenShareRef}
                                        autoPlay
                                        playsInline
                                        className="screen-share-video"
                                    />
                                    <span className="screen-share-label">📺 Ekranınızı paylaşıyorsunuz</span>
                                </>
                            ) : (
                                <div className="screen-share-placeholder">
                                    <span>📺 Ekran paylaşımı görüntüleniyor</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className={`videos-container ${isScreenSharing || screenShareUserId ? 'minimized' : ''}`}>
                        <div className="main-video">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className={`local-video ${isVideoOff ? 'hidden' : ''}`}
                            />
                            {isVideoOff && (
                                <div className="video-off-overlay">
                                    <span className="avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</span>
                                </div>
                            )}
                            <span className="video-label">
                                {isMuted && '🔇 '}
                                {user?.firstName} {user?.lastName} (Sen)
                            </span>
                        </div>

                        <div className="participant-grid">
                            {participants.map(p => (
                                <div key={p.id} className="participant-video">
                                    <div className="video-placeholder">
                                        <span className="avatar">
                                            {p.name?.split(' ').map(n => n?.[0] || '').join('') || '?'}
                                        </span>
                                    </div>
                                    <span className="video-label">
                                        {p.isHandRaised && '✋ '}
                                        {p.isMuted && '🔇 '}
                                        {p.isVideoOff && '📷 '}
                                        {p.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>

                {showChat && (
                    <aside className="chat-panel">
                        <div className="chat-header">
                            <h3>💬 Sohbet</h3>
                            <button onClick={() => setShowChat(false)}>✕</button>
                        </div>
                        <div className="chat-messages">
                            {messages.length === 0 && (
                                <div className="chat-empty">
                                    <p>Henüz mesaj yok. İlk mesajı siz gönderin!</p>
                                </div>
                            )}
                            {messages.map((msg, i) => (
                                <div key={i} className={`chat-message ${msg.userId === user?.id ? 'own' : ''}`}>
                                    <span className="message-sender">{msg.userName}</span>
                                    <p className="message-text">{msg.message}</p>
                                    <span className="message-time">
                                        {msg.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="chat-input">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                placeholder="Mesaj yazın..."
                                disabled={!isConnected}
                            />
                            <button onClick={sendMessage} disabled={!isConnected || !newMessage.trim()}>
                                Gönder
                            </button>
                        </div>
                    </aside>
                )}
            </div>

            <footer className="live-controls">
                <button className={`control-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute}>
                    {isMuted ? '🔇' : '🎤'}
                    <span>{isMuted ? 'Mikrofonu Aç' : 'Sessize Al'}</span>
                </button>
                <button className={`control-btn ${isVideoOff ? 'active' : ''}`} onClick={toggleVideo}>
                    {isVideoOff ? '📷' : '🎥'}
                    <span>{isVideoOff ? 'Kamerayı Aç' : 'Kamerayı Kapat'}</span>
                </button>
                {isInstructor && (
                    <button
                        className={`control-btn ${isScreenSharing ? 'active screen-share' : ''}`}
                        onClick={toggleScreenShare}
                    >
                        {isScreenSharing ? '🛑' : '📺'}
                        <span>{isScreenSharing ? 'Paylaşımı Durdur' : 'Ekran Paylaş'}</span>
                    </button>
                )}
                <button className={`control-btn ${isHandRaised ? 'active raised' : ''}`} onClick={toggleHandRaise}>
                    ✋
                    <span>{isHandRaised ? 'El İndir' : 'El Kaldır'}</span>
                </button>
                <button className="control-btn" onClick={() => setShowChat(!showChat)}>
                    💬
                    <span>{showChat ? 'Sohbeti Gizle' : 'Sohbeti Göster'}</span>
                </button>
            </footer>
        </div>
    );
};
