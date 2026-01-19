import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSignalR } from '../../hooks/useSignalR';
import { useAuthStore } from '../../stores/authStore';

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

    useEffect(() => {
        if (localStreamReady && localVideoRef.current && localStreamRef.current) {
            const video = localVideoRef.current;
            video.srcObject = localStreamRef.current;

            const playVideo = () => {
                video.play().catch(e => {
                    console.log('Video play failed, retrying:', e);
                    setTimeout(() => {
                        video.play().catch(err => console.error('Video play retry failed:', err));
                    }, 100);
                });
            };

            if (video.readyState >= 2) {
                playVideo();
            } else {
                video.onloadedmetadata = playVideo;
            }
        }
    }, [localStreamReady]);

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

    const setupEventListeners = useCallback(() => {
        if (eventListenersSet.current) return;
        eventListenersSet.current = true;

        on('UserJoined', (...args: unknown[]) => {
            const data = args[0] as { userId: string; userName: string; participantCount: number };
            if (data.userId === user?.id) return;
            setParticipants(prev => {
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
            setLocalStreamReady(true);
        } catch (error) {
            console.error('Failed to get media:', error);
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
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    const newVideoTrack = stream.getVideoTracks()[0];
                    localStreamRef.current.addTrack(newVideoTrack);
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
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { displaySurface: 'monitor' },
                    audio: true
                });

                screenStreamRef.current = stream;
                setIsScreenSharing(true);
                setTimeout(() => setScreenStreamReady(true), 50);

                await invoke('StartScreenShare', sessionId);

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

    if (isJoining || !isConnected) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 flex items-center justify-center">
                <div className="text-center">
                    {connectionError || joinError ? (
                        <>
                            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center text-3xl">
                                ❌
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">Bağlantı Hatası</h2>
                            <p className="text-gray-500 mb-4">{connectionError || joinError}</p>
                            <button 
                                onClick={() => navigate('/dashboard')} 
                                className="px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all"
                            >
                                Dashboard'a Dön
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="w-12 h-12 mx-auto mb-4 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">Derse Bağlanılıyor...</h2>
                            <p className="text-gray-500">Lütfen bekleyin</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col">
            {/* Header */}
            <header className="bg-gray-800 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2 px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-full">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                        CANLI
                    </span>
                    <h1 className="text-white font-semibold">Canlı Ders</h1>
                    <span className="text-gray-400 text-sm">👥 {participants.length + 1} katılımcı</span>
                    {isInstructor && (
                        <span className="px-2 py-1 bg-rose-500/20 text-rose-300 text-xs font-medium rounded-full">
                            👨‍🏫 Öğretmen
                        </span>
                    )}
                </div>
                <button 
                    className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
                    onClick={handleLeave}
                >
                    Dersten Ayrıl
                </button>
            </header>

            {/* Media Error Banner */}
            {mediaError && (
                <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm">
                    ⚠️ {mediaError}
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Video Area */}
                <main className="flex-1 p-4 flex flex-col">
                    {/* Screen Share */}
                    {(isScreenSharing || screenShareUserId) && (
                        <div className="mb-4 bg-gray-800 rounded-xl overflow-hidden relative">
                            {isScreenSharing ? (
                                <>
                                    <video
                                        ref={screenShareRef}
                                        autoPlay
                                        playsInline
                                        className="w-full h-auto max-h-[60vh] object-contain"
                                    />
                                    <span className="absolute bottom-4 left-4 px-3 py-1 bg-rose-500 text-white text-sm font-medium rounded-full">
                                        📺 Ekranınızı paylaşıyorsunuz
                                    </span>
                                </>
                            ) : (
                                <div className="h-64 flex items-center justify-center text-gray-400">
                                    📺 Ekran paylaşımı görüntüleniyor
                                </div>
                            )}
                        </div>
                    )}

                    {/* Video Grid */}
                    <div className={`flex-1 grid gap-4 ${
                        participants.length === 0 ? 'grid-cols-1' :
                        participants.length <= 1 ? 'grid-cols-2' :
                        participants.length <= 3 ? 'grid-cols-2' :
                        'grid-cols-3'
                    }`}>
                        {/* Local Video */}
                        <div className="bg-gray-800 rounded-xl overflow-hidden relative min-h-[200px]">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
                            />
                            {isVideoOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                                    <span className="w-20 h-20 bg-gradient-to-br from-rose-400 to-rose-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                                    </span>
                                </div>
                            )}
                            <span className="absolute bottom-3 left-3 px-3 py-1 bg-black/50 text-white text-sm rounded-full">
                                {isMuted && '🔇 '}
                                {user?.firstName} {user?.lastName} (Sen)
                            </span>
                        </div>

                        {/* Participant Videos */}
                        {participants.map(p => (
                            <div key={p.id} className="bg-gray-800 rounded-xl overflow-hidden relative min-h-[200px]">
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                                    <span className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                        {p.name?.split(' ').map(n => n?.[0] || '').join('') || '?'}
                                    </span>
                                </div>
                                <span className="absolute bottom-3 left-3 px-3 py-1 bg-black/50 text-white text-sm rounded-full">
                                    {p.isHandRaised && '✋ '}
                                    {p.isMuted && '🔇 '}
                                    {p.isVideoOff && '📷 '}
                                    {p.name}
                                </span>
                            </div>
                        ))}
                    </div>
                </main>

                {/* Chat Panel */}
                {showChat && (
                    <aside className="w-80 bg-gray-800 flex flex-col">
                        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                            <h3 className="text-white font-semibold">💬 Sohbet</h3>
                            <button 
                                onClick={() => setShowChat(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.length === 0 && (
                                <div className="text-center text-gray-500 py-8">
                                    <p>Henüz mesaj yok. İlk mesajı siz gönderin!</p>
                                </div>
                            )}
                            {messages.map((msg, i) => (
                                <div 
                                    key={i} 
                                    className={`${msg.userId === user?.id ? 'ml-auto' : ''}`}
                                >
                                    <div className={`max-w-[80%] ${
                                        msg.userId === user?.id 
                                            ? 'ml-auto bg-rose-500 text-white' 
                                            : 'bg-gray-700 text-white'
                                    } rounded-xl p-3`}>
                                        <span className="text-xs opacity-75 block mb-1">{msg.userName}</span>
                                        <p className="text-sm">{msg.message}</p>
                                        <span className="text-xs opacity-50 block mt-1">
                                            {msg.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="p-4 border-t border-gray-700 flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                placeholder="Mesaj yazın..."
                                disabled={!isConnected}
                                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-rose-400"
                            />
                            <button 
                                onClick={sendMessage} 
                                disabled={!isConnected || !newMessage.trim()}
                                className="px-4 py-2 bg-rose-500 text-white font-medium rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Gönder
                            </button>
                        </div>
                    </aside>
                )}
            </div>

            {/* Controls */}
            <footer className="bg-gray-800 px-4 py-4 flex items-center justify-center gap-4">
                <button 
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                        isMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    onClick={toggleMute}
                >
                    <span className="text-xl">{isMuted ? '🔇' : '🎤'}</span>
                    <span className="text-xs">{isMuted ? 'Mikrofonu Aç' : 'Sessize Al'}</span>
                </button>
                <button 
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                        isVideoOff ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    onClick={toggleVideo}
                >
                    <span className="text-xl">{isVideoOff ? '📷' : '🎥'}</span>
                    <span className="text-xs">{isVideoOff ? 'Kamerayı Aç' : 'Kamerayı Kapat'}</span>
                </button>
                {isInstructor && (
                    <button 
                        className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                            isScreenSharing ? 'bg-rose-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                        onClick={toggleScreenShare}
                    >
                        <span className="text-xl">{isScreenSharing ? '🛑' : '📺'}</span>
                        <span className="text-xs">{isScreenSharing ? 'Paylaşımı Durdur' : 'Ekran Paylaş'}</span>
                    </button>
                )}
                <button 
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                        isHandRaised ? 'bg-amber-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    onClick={toggleHandRaise}
                >
                    <span className="text-xl">✋</span>
                    <span className="text-xs">{isHandRaised ? 'El İndir' : 'El Kaldır'}</span>
                </button>
                <button 
                    className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                    onClick={() => setShowChat(!showChat)}
                >
                    <span className="text-xl">💬</span>
                    <span className="text-xs">{showChat ? 'Sohbeti Gizle' : 'Sohbeti Göster'}</span>
                </button>
            </footer>
        </div>
    );
};
