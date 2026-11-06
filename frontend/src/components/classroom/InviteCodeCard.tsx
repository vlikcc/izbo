import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Card } from '../ui';
import { classroomService } from '../../services/classroom.service';
import { toast } from '../../lib/toast';
import { formatCode } from '../../utils/codes';

interface InviteCodeCardProps {
    classroomId: string;
    code: string;
    onChanged: (code: string) => void;
}

/** What a teacher shows the class: the join code, a link, and a QR code that opens it. */
export const InviteCodeCard: React.FC<InviteCodeCardProps> = ({ classroomId, code, onChanged }) => {
    const [isRegenerating, setIsRegenerating] = useState(false);
    const link = `${window.location.origin}/join/${code}`;

    const copy = async (text: string, what: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success(`${what} kopyalandı`);
        } catch {
            toast.error('Kopyalanamadı; elle seçip kopyalayın');
        }
    };

    const regenerate = async () => {
        if (!window.confirm('Eski kod çalışmayı bırakacak. Yeni kod oluşturulsun mu?')) return;
        setIsRegenerating(true);
        try {
            onChanged(await classroomService.regenerateInviteCode(classroomId));
            toast.success('Yeni kod oluşturuldu');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Kod yenilenemedi');
        } finally {
            setIsRegenerating(false);
        }
    };

    return (
        <Card variant="default" padding="md" className="invite-card">
            <div className="invite-card-body">
                <div className="invite-card-text">
                    <h3>Öğrencileri davet et</h3>
                    <p>Öğrenciler <strong>Sınıflarım → Kodla katıl</strong> ile bu kodu yazarak ya da QR kodu okutarak katılır.</p>
                    <div className="invite-code" aria-label="Sınıf kodu">{formatCode(code)}</div>
                    <div className="invite-actions">
                        <Button size="sm" variant="secondary" onClick={() => void copy(code, 'Kod')}>Kodu kopyala</Button>
                        <Button size="sm" variant="secondary" onClick={() => void copy(link, 'Bağlantı')}>Bağlantıyı kopyala</Button>
                        <Button size="sm" variant="ghost" isLoading={isRegenerating} onClick={() => void regenerate()}>Yeni kod</Button>
                    </div>
                </div>
                <div className="invite-qr">
                    <QRCodeSVG value={link} size={128} />
                </div>
            </div>
        </Card>
    );
};

export default InviteCodeCard;
