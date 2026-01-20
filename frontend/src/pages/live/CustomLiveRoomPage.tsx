import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import './LiveClassroom.css';

// Simple Icons
const Icons = {
    Mic: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>,
    MicOff: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>,
    Camera: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>,
    CameraOff: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M21 21l-9.19-9.19a4 4 0 0 0-5.66 5.66L21 21z"></path><path d="M17 17l-1-1"></path><path d="M3 7v12a2 2 0 0 0 2 2h2"></path><path d="M7 7h10"></path><path d="M2 2l20 20"></path></svg>,
    ScreenShare: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3"></path><polyline points="8 21 12 17 16 21"></polyline><line x1="12" y1="17" x2="12" y2="21"></line><path d="M17 8l4-4-4-4-4"></path><path d="M21 4H10a5 5 0 0 0-5 5v2"></path></svg>,
    Hand: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path></svg>,
    MessageSquare: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>,
    X: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
    Send: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
};

interface ChatMessage {
    userId: string;
    userName: string;
    message: string;
    sentAt: string;
}

interface Participant {
    userId: string;
    userName: string;
    joinedAt: string;
    handRaised?: boolean;
}

export const CustomLiveRoomPage: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const { user } = useAuthStore();
    const navigate = useNavigate();

    // UI States
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isHandRaised, setIsHandRaised] = useState(false);

    // SignalR & Data States
    const [connection, setConnection] = useState<HubConnection | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Media States
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);

    // Screen Share States
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const cameraStreamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        startLocalStream();
        return () => {
            localStream?.getTracks().forEach(track => track.stop());
        };
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Initialize SignalR
    useEffect(() => {
        const initSignalR = async () => {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050';
            const token = localStorage.getItem('accessToken');

            const newConnection = new HubConnectionBuilder()
                .withUrl(`${API_URL}/hubs/classroom`, {
                    accessTokenFactory: () => token || ''
                })
                .withAutomaticReconnect()
                .configureLogging(LogLevel.Information)
                .build();

            setConnection(newConnection);
        };

        if (user && sessionId) {
            initSignalR();
        }
    }, [user, sessionId]);

    useEffect(() => {
        if (connection && sessionId) {
            connection.start()
                .then(() => {
                    console.log('Connected to SignalR');
                    // Join Session Group
                    connection.invoke('JoinSession', sessionId);

                    // Listeners
                    connection.on('ReceiveMessage', (data: ChatMessage) => {
                        setMessages(prev => [...prev, data]);
                    });

                    connection.on('ParticipantJoined', (participant: Participant) => {
                        setParticipants(prev => {
                            if (!prev.find(p => p.userId === participant.userId)) {
                                return [...prev, participant];
                            }
                            return prev;
                        });
                        // Optional notification
                        console.log(`${participant.userName} joined`);
                    });

                    connection.on('ParticipantLeft', (data: { userId: string }) => {
                        setParticipants(prev => prev.filter(p => p.userId !== data.userId));
                    });

                    connection.on('HandRaised', (data: { userId: string, userName: string }) => {
                        // Mark participant hand raised or show toast
                        console.log(`${data.userName} raised hand`);
                    });

                })
                .catch(e => console.error('Connection failed: ', e));

            return () => {
                connection.stop();
            };
        }
    }, [connection, sessionId]);


    const startLocalStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            setLocalStream(stream);
            cameraStreamRef.current = stream; // Store for switching back
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing media devices:", err);
        }
    };

    const toggleMic = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
            setIsMicMuted(!isMicMuted);
        }
    };

    const toggleCamera = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
            setIsCameraOff(!isCameraOff);
        }
    };

    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            // Stop screen share and revert to camera
            if (localVideoRef.current && cameraStreamRef.current) {
                localVideoRef.current.srcObject = cameraStreamRef.current;
                setLocalStream(cameraStreamRef.current);

                // Stop screen share tracks
                if (localStream) {
                    localStream.getTracks().forEach(track => {
                        if (track.kind === 'video' && track.label.includes('screen')) {
                            track.stop();
                        }
                    });
                }
            }
            setIsScreenSharing(false);
        } else {
            try {
                // Start screen share
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });

                // Handle user stopping via browser UI
                screenStream.getVideoTracks()[0].onended = () => {
                    if (localVideoRef.current && cameraStreamRef.current) {
                        localVideoRef.current.srcObject = cameraStreamRef.current;
                        setLocalStream(cameraStreamRef.current);
                        setIsScreenSharing(false);
                    }
                };

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = screenStream;
                }
                setLocalStream(screenStream);
                setIsScreenSharing(true);
            } catch (err) {
                console.error("Error sharing screen:", err);
            }
        }
    };

    const toggleHand = async () => {
        if (connection) {
            if (isHandRaised) {
                await connection.invoke('LowerHand', sessionId);
            } else {
                await connection.invoke('RaiseHand', sessionId);
            }
            setIsHandRaised(!isHandRaised);
        }
    };

    const sendMessage = async () => {
        if (!messageInput.trim() || !connection) return;
        try {
            await connection.invoke('SendMessage', sessionId, messageInput);
            setMessageInput('');
        } catch (e) {
            console.error(e);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    };

    const handleLeave = () => {
        if (confirm("Dersten ayrılmak istediğinize emin misiniz?")) {
            if (connection) {
                connection.invoke('LeaveSession', sessionId);
            }
            navigate('/app/live');
        }
    };

    return (
        <div className="live-classroom-container">
            {/* Top Bar */}
            <div className="live-header">
                <div className="header-left">
                    <div className="live-badge">CANLI</div>
                    <div className="session-title">Canlı Ders: {sessionId?.substring(0, 8)}...</div>
                    <div className="participant-count">👥 {participants.length + 1} katılımcı</div>
                    <div className="role-badge">Öğretmen</div>
                </div>
                <div className="header-right">
                    <button className="leave-btn" onClick={handleLeave}>Dersten Ayrıl</button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="live-content">
                {/* Video Grid */}
                <div className={`video-grid ${!isSidebarOpen ? 'full-width' : ''} single-user`}>
                    {/* Local User */}
                    <div className="video-container">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="video-feed"
                        />
                        <div className="user-label">
                            {user?.firstName} {user?.lastName} (Sen)
                        </div>
                        {isMicMuted && (
                            <div style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#dc2626', padding: '0.25rem', borderRadius: '50%' }}>
                                <Icons.MicOff />
                            </div>
                        )}
                        {isHandRaised && (
                            <div style={{ position: 'absolute', top: '1rem', left: '1rem', background: '#eab308', padding: '0.25rem', borderRadius: '50%' }}>
                                <Icons.Hand />
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                {isSidebarOpen && (
                    <div className="live-sidebar">
                        <div className="sidebar-header">
                            <h3>Sohbet</h3>
                            <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                                <Icons.X />
                            </button>
                        </div>
                        <div className="chat-messages">
                            {messages.map((msg, idx) => (
                                <div key={idx} className="chat-message">
                                    <span className="chat-author">{msg.userName}:</span>
                                    <span className="chat-text">{msg.message}</span>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="chat-input-area">
                            <input
                                type="text"
                                placeholder="Mesaj yazın..."
                                className="chat-input"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <button className="send-btn" onClick={sendMessage}><Icons.Send /></button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Controls */}
            <div className="controls-bar">
                <button
                    className={`control-btn ${isMicMuted ? 'active' : ''}`}
                    onClick={toggleMic}
                >
                    <span className="control-icon">{isMicMuted ? <Icons.MicOff /> : <Icons.Mic />}</span>
                    <span className="control-label">{isMicMuted ? 'Sessiz' : 'Sessize Al'}</span>
                </button>

                <button
                    className={`control-btn ${isCameraOff ? 'active' : ''}`}
                    onClick={toggleCamera}
                >
                    <span className="control-icon">{isCameraOff ? <Icons.CameraOff /> : <Icons.Camera />}</span>
                    <span className="control-label">{isCameraOff ? 'Kapalı' : 'Kamerayı Kapat'}</span>
                </button>

                <button
                    className={`control-btn ${isScreenSharing ? 'active' : ''}`}
                    onClick={toggleScreenShare}
                >
                    <span className="control-icon"><Icons.ScreenShare /></span>
                    <span className="control-label">{isScreenSharing ? 'Paylaşımı Durdur' : 'Ekran Paylaş'}</span>
                </button>

                <button
                    className={`control-btn ${isHandRaised ? 'active hand' : ''}`}
                    onClick={toggleHand}
                >
                    <span className="control-icon"><Icons.Hand /></span>
                    <span className="control-label">El Kaldır</span>
                </button>

                <button
                    className="control-btn"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                    <span className="control-icon"><Icons.MessageSquare /></span>
                    <span className="control-label">{isSidebarOpen ? 'Sohbeti Gizle' : 'Sohbet'}</span>
                </button>
            </div>
        </div>
    );
};

export default CustomLiveRoomPage;
