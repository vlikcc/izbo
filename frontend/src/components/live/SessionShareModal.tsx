import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal, Button } from '../ui';
import './SessionShareModal.css';

interface SessionShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
    sessionTitle: string;
}

export const SessionShareModal: React.FC<SessionShareModalProps> = ({
    isOpen,
    onClose,
    sessionId,
    sessionTitle,
}) => {
    // Generate the full URL for joining the session
    const baseUrl = window.location.origin;
    const joinUrl = `${baseUrl}/live/${sessionId}`;

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(joinUrl);
            alert('Link kopyalandı!');
        } catch (error) {
            console.error('Failed to copy:', error);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = joinUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('Link kopyalandı!');
        }
    };

    const handleJoinSession = () => {
        window.location.href = joinUrl;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Canlı Dersi Paylaş" size="md">
            <div className="session-share-content">
                {/* Success Message */}
                <div className="share-success">
                    <div className="share-success-icon">✅</div>
                    <h3>Canlı Ders Oluşturuldu!</h3>
                    <p className="share-session-title">{sessionTitle}</p>
                </div>

                {/* QR Code Section */}
                <div className="share-qr-section">
                    <div className="share-qr-container">
                        <QRCodeSVG
                            value={joinUrl}
                            size={200}
                            level="H"
                            includeMargin={true}
                            bgColor="#ffffff"
                            fgColor="#1a1a2e"
                        />
                    </div>
                    <p className="share-qr-hint">
                        📱 Öğrenciler bu QR kodu tarayarak derse katılabilir
                    </p>
                </div>

                {/* Link Section */}
                <div className="share-link-section">
                    <label className="share-link-label">Ders Bağlantısı</label>
                    <div className="share-link-container">
                        <input
                            type="text"
                            value={joinUrl}
                            readOnly
                            className="share-link-input"
                        />
                        <Button variant="secondary" onClick={handleCopyLink}>
                            📋 Kopyala
                        </Button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="share-actions">
                    <Button variant="ghost" onClick={onClose}>
                        Kapat
                    </Button>
                    <Button variant="primary" onClick={handleJoinSession}>
                        🎥 Derse Katıl
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default SessionShareModal;
