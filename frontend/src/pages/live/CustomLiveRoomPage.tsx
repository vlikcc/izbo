import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
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
    const [_isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Media States
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);

    // WebRTC States
    const peersRef = useRef<{ [key: string]: RTCPeerConnection }>({});
    const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});

    // Screen Share States
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const cameraStreamRef = useRef<MediaStream | null>(null);

    // ICE Configuration
    const rtcConfig: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
        ]
    };

    useEffect(() => {
        startLocalStream();
        return () => {
            localStream?.getTracks().forEach(track => track.stop());
            Object.values(peersRef.current).forEach(peer => peer.close());
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
            // Set up connection state handlers
            connection.onclose(() => {
                console.log('SignalR connection closed');
                setIsConnected(false);
            });

            connection.onreconnecting(() => {
                console.log('SignalR reconnecting...');
                setIsConnected(false);
            });

            connection.onreconnected(() => {
                console.log('SignalR reconnected');
                setIsConnected(true);
                // Re-join session after reconnection
                connection.invoke('JoinSession', sessionId);
            });

            connection.start()
                .then(() => {
                    console.log('Connected to SignalR');
                    setIsConnected(true);
                    connection.invoke('JoinSession', sessionId);

                    // --- Chat & Presence ---
                    connection.on('ReceiveMessage', (data: ChatMessage) => {
                        setMessages(prev => [...prev, data]);
                    });

                    connection.on('ParticipantLeft', (data: { userId: string }) => {
                        setParticipants(prev => prev.filter(p => p.userId !== data.userId));

                        // Close Peer Connection
                        if (peersRef.current[data.userId]) {
                            peersRef.current[data.userId].close();
                            delete peersRef.current[data.userId];
                        }

                        // Remove Remote Stream
                        setRemoteStreams(prev => {
                            const newStreams = { ...prev };
                            delete newStreams[data.userId];
                            return newStreams;
                        });
                    });

                    connection.on('HandRaised', (data: { userId: string, userName: string }) => {
                        console.log(`${data.userName} raised hand`);
                        setParticipants(prev => prev.map(p =>
                            p.userId === data.userId ? { ...p, handRaised: true } : p
                        ));
                    });

                    connection.on('HandLowered', (data: { userId: string }) => {
                        setParticipants(prev => prev.map(p =>
                            p.userId === data.userId ? { ...p, handRaised: false } : p
                        ));
                    });

                    // --- WebRTC Signaling ---

                    // 1. Existing participants receive 'ParticipantJoined' and initiate Offer to the new participant.
                    connection.on('ParticipantJoined', async (participant: Participant) => {
                        setParticipants(prev => {
                            if (!prev.find(p => p.userId === participant.userId)) {
                                return [...prev, participant];
                            }
                            return prev;
                        });

                        // Initiate connection only if it's not us
                        if (participant.userId !== user?.id) {
                            console.log('Initiating offer to', participant.userName);
                            const peer = createPeerConnection(participant.userId, connection);
                            peersRef.current[participant.userId] = peer;

                            // Add local tracks
                            localStream?.getTracks().forEach(track => {
                                peer.addTrack(track, localStream);
                            });

                            const offer = await peer.createOffer();
                            await peer.setLocalDescription(offer);
                            connection.invoke('SendOffer', sessionId, participant.userId, JSON.stringify(offer));
                        }
                    });

                    connection.on('ReceiveOffer', async (data: { fromUserId: string, fromUserName: string, offer: string }) => {
                        console.log('Received offer from', data.fromUserId);

                        // Add participant if missing (for the callee)
                        setParticipants(prev => {
                            if (!prev.find(p => p.userId === data.fromUserId)) {
                                return [...prev, {
                                    userId: data.fromUserId,
                                    userName: data.fromUserName,
                                    joinedAt: new Date().toISOString()
                                }];
                            }
                            return prev;
                        });

                        const offer = JSON.parse(data.offer);
                        const peer = createPeerConnection(data.fromUserId, connection);
                        peersRef.current[data.fromUserId] = peer;

                        // Add local tracks
                        localStream?.getTracks().forEach(track => {
                            peer.addTrack(track, localStream!);
                        });

                        await peer.setRemoteDescription(offer);
                        const answer = await peer.createAnswer();
                        await peer.setLocalDescription(answer);
                        connection.invoke('SendAnswer', sessionId, data.fromUserId, JSON.stringify(answer));
                    });

                    connection.on('ReceiveAnswer', async (data: { fromUserId: string, answer: string }) => {
                        console.log('Received answer from', data.fromUserId);
                        const answer = JSON.parse(data.answer);
                        const peer = peersRef.current[data.fromUserId];
                        if (peer) {
                            await peer.setRemoteDescription(answer);
                        }
                    });

                    connection.on('ReceiveIceCandidate', async (data: { fromUserId: string, candidate: string }) => {
                        const candidate = JSON.parse(data.candidate);
                        const peer = peersRef.current[data.fromUserId];
                        if (peer) {
                            await peer.addIceCandidate(candidate);
                        }
                    });

                })
                .catch(e => console.error('Connection failed: ', e));

            return () => {
                connection.stop();
            };
        }
    }, [connection, sessionId, localStream]); // Dependency on localStream to add tracks

    const createPeerConnection = (targetUserId: string, signalRConnection: HubConnection) => {
        const peer = new RTCPeerConnection(rtcConfig);

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                signalRConnection.invoke('SendIceCandidate', sessionId, targetUserId, JSON.stringify(event.candidate));
            }
        };

        peer.ontrack = (event) => {
            console.log('Received remote track from', targetUserId);
            setRemoteStreams(prev => ({
                ...prev,
                [targetUserId]: event.streams[0]
            }));
        };

        return peer;
    };


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
            // Revert to camera
            if (cameraStreamRef.current) {
                const videoTrack = cameraStreamRef.current.getVideoTracks()[0];

                // Update local video
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = cameraStreamRef.current;
                }
                setLocalStream(cameraStreamRef.current);

                // Replace track in all peer connections
                Object.values(peersRef.current).forEach(peer => {
                    const sender = peer.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(videoTrack);
                    }
                });

                // Stop screen share tracks if active
                localStream?.getVideoTracks().forEach(t => t.label.includes('screen') && t.stop());
            }
            setIsScreenSharing(false);
        } else {
            try {
                // Start screen share
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
                const screenTrack = screenStream.getVideoTracks()[0];

                // Handle stop via browser UI
                screenTrack.onended = () => {
                    if (cameraStreamRef.current) {
                        if (localVideoRef.current) localVideoRef.current.srcObject = cameraStreamRef.current;
                        setLocalStream(cameraStreamRef.current);
                        Object.values(peersRef.current).forEach(peer => {
                            const sender = peer.getSenders().find(s => s.track?.kind === 'video');
                            if (sender) sender.replaceTrack(cameraStreamRef.current!.getVideoTracks()[0]);
                        });
                        setIsScreenSharing(false);
                    }
                };

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = screenStream;
                }
                setLocalStream(screenStream);

                // Replace track in all peer connections
                Object.values(peersRef.current).forEach(peer => {
                    const sender = peer.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(screenTrack);
                    }
                });

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

        // Check if connection is in Connected state
        if (connection.state !== HubConnectionState.Connected) {
            console.error('Cannot send message: Connection is not in Connected state. Current state:', connection.state);
            alert('Bağlantı kurulurken bekleyin...');
            return;
        }

        try {
            await connection.invoke('SendMessage', sessionId, messageInput);
            setMessageInput('');
        } catch (e) {
            console.error('Failed to send message:', e);
            alert('Mesaj gönderilemedi. Bağlantıyı kontrol edin.');
        }
    };

    // ... helper handlers ...
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') sendMessage();
    };

    const handleLeave = () => {
        if (confirm("Dersten ayrılmak istediğinize emin misiniz?")) {
            if (connection) connection.invoke('LeaveSession', sessionId);
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
                </div>
                <div className="header-right">
                    <button className="leave-btn" onClick={handleLeave}>Dersten Ayrıl</button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="live-content">
                {/* Video Grid */}
                <div className={`video-grid ${!isSidebarOpen ? 'full-width' : ''} ${Object.keys(remoteStreams).length > 0 ? 'multi-user' : 'single-user'}`}>
                    {/* Local User */}
                    <div className="video-container local-user">
                        <video ref={localVideoRef} autoPlay muted playsInline className="video-feed" />
                        <div className="user-label">{user?.firstName} {user?.lastName} (Sen)</div>
                        {isMicMuted && <div className="status-icon mic-off"><Icons.MicOff /></div>}
                        {isHandRaised && <div className="status-icon hand-raised"><Icons.Hand /></div>}
                    </div>

                    {/* Remote Users */}
                    {Object.entries(remoteStreams).map(([userId, stream]) => {
                        const participant = participants.find(p => p.userId === userId);
                        return (
                            <div key={userId} className="video-container remote-user">
                                <video
                                    autoPlay
                                    playsInline
                                    className="video-feed"
                                    ref={el => {
                                        if (el) el.srcObject = stream;
                                    }}
                                />
                                <div className="user-label">{participant?.userName || 'Misafir'}</div>
                                {participant?.handRaised && <div className="status-icon hand-raised"><Icons.Hand /></div>}
                            </div>
                        );
                    })}
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
