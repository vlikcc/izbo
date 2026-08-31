import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardHeader, CardBody, Button, Input } from '../../components/ui';
import { UsageBar } from '../../components/subscription/UsageBar';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import subscriptionService from '../../services/subscription.service';
import type { Plan, Organization, BillingCycle } from '../../types';
import './Billing.css';

const STATUS_LABELS: Record<string, string> = {
    Trialing: 'Deneme sürümü',
    Active: 'Aktif',
    PastDue: 'Ödeme bekleniyor',
    Canceled: 'İptal edildi',
    Expired: 'Süresi doldu',
};

export const BillingPage: React.FC = () => {
    const { subscription, isLoading, load } = useSubscriptionStore();
    const location = useLocation();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [isBusy, setIsBusy] = useState(false);
    const [newMemberUserId, setNewMemberUserId] = useState('');

    const selectedPlanCode = (location.state as { selectedPlanCode?: string } | null)?.selectedPlanCode;
    const selectedCycle = (location.state as { cycle?: BillingCycle } | null)?.cycle ?? 'Monthly';

    const refresh = useCallback(async () => {
        await load();
        subscriptionService.getPlans().then(setPlans);
        subscriptionService.getMyOrganization().then(setOrganization);
    }, [load]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const runAction = async (action: () => Promise<void>, successMessage: string) => {
        setIsBusy(true);
        setActionError(null);
        setActionMessage(null);
        try {
            await action();
            setActionMessage(successMessage);
            await refresh();
        } catch (error) {
            setActionError(error instanceof Error ? error.message : 'İşlem başarısız oldu');
        } finally {
            setIsBusy(false);
        }
    };

    const handleStartTrial = () => runAction(
        () => subscriptionService.startTrial().then(() => undefined),
        '14 günlük deneme süreniz başladı!'
    );

    const handleCheckout = (planCode: string, cycle: BillingCycle) => runAction(
        async () => {
            const result = await subscriptionService.checkout({ planCode, cycle });
            setActionMessage(result.instructions);
        },
        ''
    );

    const handleCancel = () => runAction(
        () => subscriptionService.cancel().then(() => undefined),
        'Aboneliğiniz dönem sonunda sona erecek.'
    );

    const handleCreateOrganization = () => runAction(
        async () => {
            const name = window.prompt('Kurum adı');
            if (!name) return;
            await subscriptionService.createOrganization(name);
        },
        'Kurumunuz oluşturuldu, 14 günlük deneme başladı.'
    );

    const handleAddMember = () => runAction(
        async () => {
            if (!organization || !newMemberUserId.trim()) return;
            await subscriptionService.addOrganizationMember(organization.id, newMemberUserId.trim());
            setNewMemberUserId('');
        },
        'Üye eklendi.'
    );

    const handleRemoveMember = (userId: string) => runAction(
        async () => {
            if (!organization) return;
            await subscriptionService.removeOrganizationMember(organization.id, userId);
        },
        'Üye çıkarıldı.'
    );

    if (isLoading && !subscription) {
        return <div className="billing-page"><p>Yükleniyor...</p></div>;
    }

    if (!subscription) {
        return <div className="billing-page"><p>Abonelik bilgisi alınamadı.</p></div>;
    }

    const consumableMetrics: Array<{ metric: 'Classrooms' | 'ExamsCreated' | 'HomeworksCreated' | 'LiveMinutes' | 'StorageMegabytes'; label: string; unit?: string }> = [
        { metric: 'Classrooms', label: 'Sınıflar' },
        { metric: 'ExamsCreated', label: 'Sınavlar (bu ay)' },
        { metric: 'HomeworksCreated', label: 'Ödevler (bu ay)' },
        { metric: 'LiveMinutes', label: 'Canlı ders (bu ay)', unit: ' dk' },
        { metric: 'StorageMegabytes', label: 'Depolama', unit: ' MB' },
    ];

    const otherPlans = plans.filter(p => p.code !== subscription.plan.code && p.priceMonthly > 0);

    return (
        <div className="billing-page">
            <h1 className="billing-title">Aboneliğim</h1>

            {actionMessage && <div className="billing-banner success">{actionMessage}</div>}
            {actionError && <div className="billing-banner error">{actionError}</div>}

            <Card className="billing-current-plan">
                <CardHeader>
                    <div className="billing-plan-header">
                        <div>
                            <span className="billing-plan-name">{subscription.plan.name}</span>
                            <span className={`billing-status-badge status-${subscription.status.toLowerCase()}`}>
                                {STATUS_LABELS[subscription.status] ?? subscription.status}
                            </span>
                        </div>
                        {selectedPlanCode && subscription.trialAvailable && (
                            <span className="billing-hint">
                                Aşağıdaki butonla <strong>14 günlük ücretsiz denemenizi</strong> başlatabilirsiniz.
                            </span>
                        )}
                        {selectedPlanCode && !subscription.trialAvailable && (
                            <span className="billing-hint">Yükseltmek istediğiniz plan: <strong>{selectedPlanCode}</strong></span>
                        )}
                    </div>
                </CardHeader>
                <CardBody>
                    <p className="billing-period">
                        Dönem: {new Date(subscription.currentPeriodStart).toLocaleDateString('tr-TR')} – {new Date(subscription.currentPeriodEnd).toLocaleDateString('tr-TR')}
                        {subscription.cancelAtPeriodEnd && ' (dönem sonunda yenilenmeyecek)'}
                    </p>
                    {subscription.trialEndsAt && subscription.status === 'Trialing' && (
                        <p className="billing-trial-note">
                            Deneme süreniz {new Date(subscription.trialEndsAt).toLocaleDateString('tr-TR')} tarihinde sona eriyor.
                        </p>
                    )}

                    <div className="billing-usage-grid">
                        {consumableMetrics.map(({ metric, label, unit }) => {
                            const usage = subscription.usage.find(u => u.metric === metric);
                            return (
                                <UsageBar
                                    key={metric}
                                    label={label}
                                    used={usage?.used ?? 0}
                                    limit={usage?.limit ?? 0}
                                    unit={unit}
                                />
                            );
                        })}
                    </div>

                    <div className="billing-actions">
                        {subscription.trialAvailable && (
                            <Button variant="primary" onClick={handleStartTrial} disabled={isBusy}>
                                14 Günlük Ücretsiz Deneme Başlat
                            </Button>
                        )}
                        {subscription.plan.code !== 'free' && !subscription.cancelAtPeriodEnd && (
                            <Button variant="outline" onClick={handleCancel} disabled={isBusy}>
                                Aboneliği İptal Et
                            </Button>
                        )}
                    </div>
                </CardBody>
            </Card>

            {otherPlans.length > 0 && (
                <Card className="billing-upgrade-section">
                    <CardHeader><h2>Planınızı Yükseltin</h2></CardHeader>
                    <CardBody>
                        <div className="billing-plan-options">
                            {otherPlans.map(plan => (
                                <div key={plan.id} className="billing-plan-option">
                                    <div>
                                        <strong>{plan.name}</strong>
                                        <span> — {plan.priceMonthly.toLocaleString('tr-TR')} {plan.currency}/ay</span>
                                    </div>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        disabled={isBusy}
                                        onClick={() => handleCheckout(plan.code, selectedCycle)}
                                    >
                                        Satın Al
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardBody>
                </Card>
            )}

            <Card className="billing-organization-section">
                <CardHeader><h2>Kurum</h2></CardHeader>
                <CardBody>
                    {organization ? (
                        <>
                            <p className="billing-org-name">{organization.name}</p>
                            <ul className="billing-member-list">
                                {organization.members.map(member => (
                                    <li key={member.id}>
                                        <span>{member.userId}</span>
                                        <span className="billing-org-role">{member.orgRole}</span>
                                        {member.orgRole !== 'Owner' && (
                                            <button
                                                className="billing-remove-member"
                                                onClick={() => handleRemoveMember(member.userId)}
                                                disabled={isBusy}
                                            >
                                                Çıkar
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <div className="billing-add-member">
                                <Input
                                    placeholder="Kullanıcı ID'si"
                                    value={newMemberUserId}
                                    onChange={(e) => setNewMemberUserId(e.target.value)}
                                />
                                <Button onClick={handleAddMember} disabled={isBusy || !newMemberUserId.trim()}>
                                    Üye Ekle
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p>Henüz bir kuruma üye değilsiniz.</p>
                            <Button variant="outline" onClick={handleCreateOrganization} disabled={isBusy}>
                                Kurum Oluştur
                            </Button>
                        </>
                    )}
                </CardBody>
            </Card>
        </div>
    );
};

export default BillingPage;
