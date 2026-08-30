import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardBody, Button, Input } from '../../components/ui';
import subscriptionService from '../../services/subscription.service';
import type { AdminSubscription, AdminOrder, SubscriberType } from '../../types';
import './SubscriptionsAdmin.css';

export const SubscriptionsAdminPage: React.FC = () => {
    const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
    const [orders, setOrders] = useState<AdminOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [planCodeDrafts, setPlanCodeDrafts] = useState<Record<string, string>>({});

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            const [subs, ords] = await Promise.all([
                subscriptionService.adminListSubscriptions(),
                subscriptionService.adminListOrders(),
            ]);
            setSubscriptions(subs);
            setOrders(ords);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Veriler alınamadı');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const key = (type: SubscriberType, id: string) => `${type}:${id}`;

    const handleAssignPlan = async (type: SubscriberType, subscriberId: string) => {
        const planCode = planCodeDrafts[key(type, subscriberId)];
        if (!planCode) return;
        try {
            await subscriptionService.adminAssignPlan(type, subscriberId, planCode);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Plan güncellenemedi');
        }
    };

    const handleMarkPaid = async (orderId: string) => {
        try {
            await subscriptionService.adminMarkOrderPaid(orderId);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sipariş güncellenemedi');
        }
    };

    return (
        <div className="subs-admin-page">
            <h1>Abonelik Yönetimi</h1>
            {error && <div className="subs-admin-error">{error}</div>}

            <Card>
                <CardHeader><h2>Abonelikler</h2></CardHeader>
                <CardBody>
                    {isLoading ? (
                        <p>Yükleniyor...</p>
                    ) : (
                        <div className="subs-admin-table-wrapper">
                            <table className="subs-admin-table">
                                <thead>
                                    <tr>
                                        <th>Tür</th>
                                        <th>Abone ID</th>
                                        <th>Plan</th>
                                        <th>Durum</th>
                                        <th>Dönem Sonu</th>
                                        <th>Yeni Plan</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subscriptions.map((sub) => {
                                        const k = key(sub.subscriberType, sub.subscriberId);
                                        return (
                                            <tr key={sub.id}>
                                                <td>{sub.subscriberType}</td>
                                                <td className="subs-admin-id">{sub.subscriberId}</td>
                                                <td>{sub.planCode}</td>
                                                <td>{sub.status}</td>
                                                <td>{new Date(sub.currentPeriodEnd).toLocaleDateString('tr-TR')}</td>
                                                <td>
                                                    <Input
                                                        placeholder="free / pro / institution"
                                                        value={planCodeDrafts[k] ?? ''}
                                                        onChange={(e) => setPlanCodeDrafts(prev => ({ ...prev, [k]: e.target.value }))}
                                                    />
                                                </td>
                                                <td>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleAssignPlan(sub.subscriberType, sub.subscriberId)}
                                                        disabled={!planCodeDrafts[k]}
                                                    >
                                                        Ata
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardBody>
            </Card>

            <Card>
                <CardHeader><h2>Bekleyen Siparişler</h2></CardHeader>
                <CardBody>
                    <div className="subs-admin-table-wrapper">
                        <table className="subs-admin-table">
                            <thead>
                                <tr>
                                    <th>Plan</th>
                                    <th>Döngü</th>
                                    <th>Tutar</th>
                                    <th>Durum</th>
                                    <th>Oluşturulma</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => (
                                    <tr key={order.id}>
                                        <td>{order.planCode}</td>
                                        <td>{order.cycle}</td>
                                        <td>{order.amount.toLocaleString('tr-TR')} {order.currency}</td>
                                        <td>{order.status}</td>
                                        <td>{new Date(order.createdAt).toLocaleDateString('tr-TR')}</td>
                                        <td>
                                            {order.status === 'Pending' && (
                                                <Button size="sm" onClick={() => handleMarkPaid(order.id)}>
                                                    Ödendi İşaretle
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
};

export default SubscriptionsAdminPage;
