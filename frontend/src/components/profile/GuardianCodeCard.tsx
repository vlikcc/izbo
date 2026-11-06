import React, { useEffect, useState } from 'react';
import { Button, Card } from '../ui';
import guardianService from '../../services/guardian.service';
import type { GuardianCode, PublicUser } from '../../types';
import { toast } from '../../lib/toast';
import { formatCode } from '../../utils/codes';

/** Lets a student who registered on their own connect a parent: issue a code, see who is linked. */
export const GuardianCodeCard: React.FC = () => {
    const [guardians, setGuardians] = useState<PublicUser[]>([]);
    const [code, setCode] = useState<GuardianCode | null>(null);
    const [isIssuing, setIsIssuing] = useState(false);

    useEffect(() => {
        guardianService.getGuardians().then(setGuardians).catch(() => setGuardians([]));
    }, []);

    const issue = async () => {
        setIsIssuing(true);
        try {
            setCode(await guardianService.issueGuardianCode());
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Kod oluşturulamadı');
        } finally {
            setIsIssuing(false);
        }
    };

    return (
        <Card variant="default" padding="lg" className="profile-card">
            <h3 className="profile-section-title">👨‍👩‍👧 Veli bağlantısı</h3>
            <p>
                Velin seni takip edebilsin diye bir kod üret ve ona ver. Velin kendi hesabında
                <strong> Çocuklarım → Kodla bağla</strong> ile bu kodu girer. Kod 7 gün geçerlidir ve bir kez kullanılır.
            </p>

            {guardians.length > 0 && (
                <p>
                    Bağlı veliler: <strong>{guardians.map(g => `${g.firstName} ${g.lastName}`).join(', ')}</strong>
                </p>
            )}

            {code && (
                <div className="code-box" style={{ marginBottom: 12 }}>
                    <span className="code-box-value" aria-label="Veli kodu">{formatCode(code.code)}</span>
                    <span style={{ fontSize: '0.85rem' }}>
                        Son geçerlilik: {new Date(code.expiresAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                    </span>
                </div>
            )}

            <div className="profile-actions">
                <Button variant="outline" size="md" isLoading={isIssuing} onClick={() => void issue()}>
                    {code ? 'Yeni kod üret' : 'Veli kodu üret'}
                </Button>
            </div>
        </Card>
    );
};

export default GuardianCodeCard;
