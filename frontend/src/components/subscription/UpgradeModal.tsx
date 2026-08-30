import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Button } from '../ui';
import { useUpgradeStore } from '../../stores/upgradeStore';
import type { QuotaMetric } from '../../types';
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

export const UpgradeModal: React.FC = () => {
    const { isOpen, info, close } = useUpgradeStore();
    const navigate = useNavigate();

    if (!info) return null;

    const metricLabel = info.metric ? METRIC_LABELS[info.metric] : null;

    const handleUpgrade = () => {
        close();
        navigate(info.upgradeUrl || '/app/billing');
    };

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
