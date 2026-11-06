import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Button } from '../ui';
import { useUpgradeStore } from '../../stores/upgradeStore';
import { useAuthStore } from '../../stores/authStore';
import { isStudent } from '../../utils/roles';
import { tierName } from '../../utils/learner';
import type { QuotaExceededInfo, QuotaMetric } from '../../types';
import './UpgradeModal.css';

const METRIC_LABELS: Record<QuotaMetric, string> = {
    Classrooms: 'sınıf',
    ExamsCreated: 'sınav',
    HomeworksCreated: 'ödev',
    LiveMinutes: 'canlı ders dakikası',
    StorageMegabytes: 'depolama alanı',
    MaxStudentsPerClassroom: 'sınıf başına öğrenci',
    MaxQuestionsPerExam: 'sınav başına soru',
    Seats: 'koltuk',
};

const PACKAGE_TITLES: Record<NonNullable<QuotaExceededInfo['reason']>, string> = {
    premium_content: 'Bu içerik pakete dahil',
    daily_limit: 'Bugünkü test hakkın doldu',
    premium_assessment: 'Bu deneme pakete dahil',
};

/** A student package is needed (402 PACKAGE_REQUIRED): tells a child to ask their parent, everyone else where to buy. */
const PackageRequiredBody: React.FC<{ info: QuotaExceededInfo; onClose: () => void; onShowPackages: () => void }> = ({ info, onClose, onShowPackages }) => {
    const { user } = useAuthStore();
    const tier = info.requiredTier ?? 1;
    return (
        <div className="upgrade-modal">
            <div className="upgrade-modal-icon">{info.reason === 'daily_limit' ? '⏳' : '⭐'}</div>
            <p className="upgrade-modal-message">{info.message}</p>
            <div className="upgrade-modal-detail">
                <span>Gereken paket</span>
                <strong>{tierName(tier)}{tier < 3 ? ' ve üstü' : ''}</strong>
            </div>
            <p className="upgrade-modal-hint">
                {isStudent(user)
                    ? 'Paketini velin alabilir; ya da paketleri inceleyip velinle birlikte karar verebilirsin. 7 günlük ücretsiz Plus denemesi de var.'
                    : 'Paketler 1, 3 ve 12 aylık; havale/EFT ile ödenir. Her öğrenci için 7 günlük ücretsiz Plus denemesi var.'}
            </p>
            <div className="upgrade-modal-actions">
                <Button variant="outline" onClick={onClose}>Vazgeç</Button>
                <Button variant="primary" onClick={onShowPackages}>Paketleri gör</Button>
            </div>
        </div>
    );
};

export const UpgradeModal: React.FC = () => {
    const { isOpen, info, close } = useUpgradeStore();
    const navigate = useNavigate();

    if (!info) return null;

    const handleUpgrade = () => {
        close();
        navigate(info.upgradeUrl || (info.errorCode === 'PACKAGE_REQUIRED' ? '/app/paketler' : '/app/billing'));
    };

    if (info.errorCode === 'PACKAGE_REQUIRED') {
        return (
            <Modal isOpen={isOpen} onClose={close} title={info.reason ? PACKAGE_TITLES[info.reason] : 'Paket gerekiyor'} size="sm">
                <PackageRequiredBody info={info} onClose={close} onShowPackages={handleUpgrade} />
            </Modal>
        );
    }

    const metricLabel = info.metric ? METRIC_LABELS[info.metric] : null;

    return (
        <Modal isOpen={isOpen} onClose={close} title="Plan limitine ulaşıldı" size="sm">
            <div className="upgrade-modal">
                <div className="upgrade-modal-icon">🔒</div>
                <p className="upgrade-modal-message">{info.message}</p>

                {metricLabel && info.limit !== undefined && info.limit >= 0 && (
                    <div className="upgrade-modal-detail">
                        <span>{metricLabel}</span>
                        <strong>
                            {info.current ?? 0} / {info.limit}
                        </strong>
                    </div>
                )}

                {info.featureCode && (
                    <div className="upgrade-modal-detail">
                        <span>Bu özellik mevcut planınızda bulunmuyor</span>
                    </div>
                )}

                <p className="upgrade-modal-hint">
                    Daha yüksek bir plana geçerek limitlerinizi artırabilir ve tüm özelliklere erişebilirsiniz.
                </p>

                <div className="upgrade-modal-actions">
                    <Button variant="outline" onClick={close}>
                        Vazgeç
                    </Button>
                    <Button variant="primary" onClick={handleUpgrade}>
                        Planları Görüntüle
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default UpgradeModal;
