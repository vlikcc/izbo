import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select } from '../../components/ui';
import learnerService from '../../services/learner.service';
import { toast } from '../../lib/toast';
import { ORDER_STATUS_LABELS, TERM_LABELS, formatDay, formatPrice } from '../../utils/learner';
import type { LearnerOrder, LearnerOrderStatus, LearnerPackage } from '../../types/learner';
import './SubscriptionsAdmin.css';
import '../packages/Packages.css';

const FILTERS: { value: '' | LearnerOrderStatus; label: string }[] = [
    { value: 'AwaitingApproval', label: 'Onay bekleyenler' },
    { value: 'Pending', label: 'Ödeme bekleyenler' },
    { value: 'Paid', label: 'Ödenenler' },
    { value: 'Rejected', label: 'Reddedilenler' },
    { value: '', label: 'Tümü' },
];

/** /app/admin/odemeler — confirm bank transfers against the account statement, and grant packages by hand. */
export const LearnerPaymentsAdminPage: React.FC = () => {
    const [status, setStatus] = useState<'' | LearnerOrderStatus>('AwaitingApproval');
    const [orders, setOrders] = useState<LearnerOrder[] | null>(null);
    const [busy, setBusy] = useState('');
    const [packages, setPackages] = useState<LearnerPackage[]>([]);
    const [grant, setGrant] = useState({ studentId: '', packageCode: '', days: '30' });
    const [granting, setGranting] = useState(false);

    const load = useCallback(() => {
        setOrders(null);
        learnerService.adminListOrders(status || undefined)
            .then(page => setOrders(page.items))
            .catch((e: unknown) => {
                toast.error(e instanceof Error ? e.message : 'Siparişler alınamadı');
                setOrders([]);
            });
    }, [status]);

    useEffect(load, [load]);

    useEffect(() => {
        learnerService.adminListPackages()
            .then(list => {
                setPackages(list);
                setGrant(g => ({ ...g, packageCode: g.packageCode || list[0]?.code || '' }));
            })
            .catch(() => setPackages([]));
    }, []);

    const replace = (updated: LearnerOrder) =>
        setOrders(prev => prev?.map(o => (o.id === updated.id ? updated : o)) ?? null);

    const approve = async (order: LearnerOrder) => {
        if (!window.confirm(`${order.reference} — ${formatPrice(order.amount, order.currency)} hesaba geçti mi? Onaylayınca paket tanımlanır.`)) return;
        setBusy(order.id);
        try {
            replace(await learnerService.adminApprove(order.id));
            toast.success('Onaylandı, paket tanımlandı');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Onaylanamadı');
            load();
        } finally {
            setBusy('');
        }
    };

    const reject = async (order: LearnerOrder) => {
        const reason = window.prompt(`${order.reference} neden reddediliyor? (veliye gösterilir)`);
        if (!reason?.trim()) return;
        setBusy(order.id);
        try {
            replace(await learnerService.adminReject(order.id, reason.trim()));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Reddedilemedi');
        } finally {
            setBusy('');
        }
    };

    const submitGrant = async (e: React.FormEvent) => {
        e.preventDefault();
        setGranting(true);
        try {
            const pass = await learnerService.adminGrant(grant.studentId.trim(), grant.packageCode, Number(grant.days));
            toast.success(`${pass.packageName} tanımlandı: ${formatDay(pass.endsAt)} tarihine kadar`);
            setGrant(g => ({ ...g, studentId: '' }));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Paket tanımlanamadı');
        } finally {
            setGranting(false);
        }
    };

    return (
        <div className="page animate-fadeIn subs-admin-page">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">💸 Ödemeler</h1>
                    <p className="page-subtitle">Havale/EFT siparişleri: hesap hareketinde açıklama kodunu ve tutarı bulup onaylayın.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="row-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
                        <h2>Siparişler</h2>
                        <Select aria-label="Durum" value={status} onChange={e => setStatus(e.target.value as '' | LearnerOrderStatus)}>
                            {FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </Select>
                    </div>
                </CardHeader>
                <CardBody>
                    {orders === null ? <p>Yükleniyor...</p> : orders.length === 0 ? <p>Bu durumda sipariş yok.</p> : (
                        <div className="subs-admin-table-wrapper">
                            <table className="subs-admin-table">
                                <thead>
                                    <tr>
                                        <th>Kod</th>
                                        <th>Paket</th>
                                        <th>Tutar</th>
                                        <th>Öğrenci</th>
                                        <th>Tarih</th>
                                        <th>Durum</th>
                                        <th>Not</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(o => {
                                        const open = o.status === 'Pending' || o.status === 'AwaitingApproval';
                                        return (
                                            <tr key={o.id}>
                                                <td><code className="payment-reference">{o.reference}</code></td>
                                                <td>{o.packageName} · {TERM_LABELS[o.term]}</td>
                                                <td><strong>{formatPrice(o.amount, o.currency)}</strong></td>
                                                <td className="subs-admin-id">{o.studentId}</td>
                                                <td>{formatDay(o.createdAt)}</td>
                                                <td><span className={`order-status order-status-${o.status}`}>{ORDER_STATUS_LABELS[o.status]}</span></td>
                                                <td>{o.rejectReason ?? o.payerNote ?? ''}</td>
                                                <td>
                                                    {open && (
                                                        <div className="order-actions">
                                                            <Button size="sm" isLoading={busy === o.id} onClick={() => void approve(o)}>Onayla</Button>
                                                            <Button size="sm" variant="ghost" disabled={busy === o.id} onClick={() => void reject(o)}>Reddet</Button>
                                                        </div>
                                                    )}
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
                <CardHeader><h2>Elle paket tanımla</h2></CardHeader>
                <CardBody>
                    <p className="content-muted">Okul anlaşmaları, hediye ya da telafi için. Aynı paket varsa süre sonuna eklenir.</p>
                    <form className="grant-form" onSubmit={e => void submitGrant(e)}>
                        <Input label="Öğrenci ID" required value={grant.studentId}
                            pattern="[0-9a-fA-F-]{36}" title="Öğrencinin kullanıcı kimliği (GUID)"
                            onChange={e => setGrant(g => ({ ...g, studentId: e.target.value }))} />
                        <Select label="Paket" value={grant.packageCode} onChange={e => setGrant(g => ({ ...g, packageCode: e.target.value }))}>
                            {packages.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                        </Select>
                        <Input label="Gün" type="number" min={1} max={730} required value={grant.days}
                            onChange={e => setGrant(g => ({ ...g, days: e.target.value }))} />
                        <Button type="submit" isLoading={granting} disabled={!grant.packageCode}>Tanımla</Button>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
};

export default LearnerPaymentsAdminPage;
