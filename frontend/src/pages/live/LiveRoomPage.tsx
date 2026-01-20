import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui';
import { classroomService } from '../../services/classroom.service';
import './LiveRoom.css';

export const LiveRoomPage: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [isLeft, setIsLeft] = useState(false);
    const [jwt, setJwt] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (sessionId) {
            fetchToken();
        }
    }, [sessionId]);

    const fetchToken = async () => {
        try {
            if (!sessionId) return;
            const token = await classroomService.getSessionToken(sessionId);
            if (token) {
                setJwt(token);
            }
        } catch (error) {
            console.error("Failed to fetch Jitsi JWT:", error);
            // Proceed without token (guest mode)
        } finally {
            setIsLoading(false);
        }
    };

    if (!sessionId || !user) {
        return (
            <div className="live-room-error">
                <p>Oturum bilgileri eksik veya giriş yapılmamış.</p>
                <Button onClick={() => navigate('/app/live')}>Geri Dön</Button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="live-room-loading">
                <div className="spinner"></div>
                <p>Oturum hazırlanıyor...</p>
            </div>
        );
    }

    const handleReadyToClose = () => {
        setIsLeft(true);
        // Oturumdan ayrıldıktan sonra yönlendirme
        setTimeout(() => {
            navigate('/app/live');
        }, 2000);
    };

    if (isLeft) {
        return (
            <div className="live-room-left">
                <h2>Oturumdan ayrıldınız</h2>
                <p>Canlı dersler sayfasına yönlendiriliyorsunuz...</p>
            </div>
        );
    }

    return (
        <div className="live-room-container">
            <JitsiMeeting
                domain="meet.jit.si"
                roomName={`eduplatform-live-${sessionId}`}
                jwt={jwt}
                configOverwrite={{
                    startWithAudioMuted: true,
                    prejoinPageEnabled: true,
                }}
                interfaceConfigOverwrite={{
                    SHOW_JITSI_WATERMARK: false,
                    SHOW_WATERMARK_FOR_GUESTS: false,
                    TOOLBAR_BUTTONS: [
                        'microphone',
                        'camera',
                        'closedcaptions',
                        'desktop',
                        'fullscreen',
                        'fodeviceselection',
                        'hangup',
                        'profile',
                        'chat',
                        'recording',
                        'livestreaming',
                        'etherpad',
                        'sharedvideo',
                        'settings',
                        'raisehand',
                        'videoquality',
                        'filmstrip',
                        'invite',
                        'feedback',
                        'stats',
                        'shortcuts',
                        'tileview',
                        'videobackgroundblur',
                        'download',
                        'help',
                        'mute-everyone',
                        'security'
                    ],
                }}
                userInfo={{
                    displayName: `${user.firstName} ${user.lastName}`,
                    email: user.email
                }}
                onApiReady={() => {
                    // Api objesi ile ek işlemler yapılabilir
                    // externalApi.executeCommand('toggleAudio');
                }}
                onReadyToClose={handleReadyToClose}
                getIFrameRef={(iframeRef) => {
                    iframeRef.style.height = '100vh';
                }}
            />
        </div>
    );
};

export default LiveRoomPage;
