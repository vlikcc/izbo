import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Modal } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import guardianService from '../../services/guardian.service';
import learnerService from '../../services/learner.service';
import { toast } from '../../lib/toast';
import { isParent } from '../../utils/roles';
import {
    FEATURE_LABELS,
    ORDER_STATUS_LABELS,
    TERM_LABELS,
    TERM_ORDER,
    daysLeft,
    formatDay,
    formatPrice,
    monthlyEquivalent,
    practiceLimitLabel,
    purchasableTerms,
    tierName,
} from '../../utils/learner';
import type { Child } from '../../types';
import type { LearnerAccess, LearnerOrder, LearnerPackage, LearnerTerm } from '../../types/learner';
import './Packages.css';

const copy = async (text: string, what: string) => {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`${what} kopyalandı`);
    } catch {
        toast.error('Kopyalanamadı; elle seçip kopyalayın');
    }
};

/** IBAN, recipient and the code for the transfer description, with "Ödemeyi yaptım". */
export const PaymentPanel: React.FC<{
    order: LearnerOrder;
    onNotified: (order: LearnerOrder) => void;
    onClose: () => void;
}> = ({ order, onNotified, onClose }) => {
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const instructions = order.instructions;

    const notify = async () => {
        setBusy(true);
        try {
            onNotified(await learnerService.notifyPaid(order.id, note.trim() || undefined));
            toast.success('Bildirimin alındı; ödeme hesaba geçince paket tanımlanır.');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Bildirim gönderilemedi');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="payment-panel">
            <div className="payment-amount">
                <span>{order.packageName} · {TERM_LABELS[order.term]}</span>
                <strong>{formatPrice(order.amount, order.currency)}</strong>
            </div>

            {instructions?.iban ? (
                <dl className="payment-details">
                    {instructions.bankName && (<><dt>Banka</dt><dd>{instructions.bankName}</dd></>)}
                    {instructions.accountHolder && (<><dt>Alıcı</dt><dd>{instructions.accountHolder}</dd></>)}
                    <dt>IBAN</dt>
                    <dd className="payment-copyable">
                        <code>{instructions.iban}</code>
                        <Button size="sm" variant="ghost" onClick={() => void copy(instructions.iban!.replace(/\s/g, ''), 'IBAN')}>Kopyala</Button>
                    </dd>
                    <dt>Açıklama</dt>
                    <dd className="payment-copyable">
                        <code className="payment-reference">{order.reference}</code>
                        <Button size="sm" variant="ghost" onClick={() => void copy(order.reference, 'Kod')}>Kopyala</Button>
                    </dd>
                </dl>
            ) : (
                <div className="payment-details">
                    <p>Sipariş kodun: <code className="payment-reference">{order.reference}</code></p>
                </div>
            )}

            <p className="payment-text">{instructions?.text ?? 'Ödeme bilgileri için bizimle iletişime geçin.'}</p>

            {order.status === 'Pending' && (
                <>
                    <label className="payment-note">
                        <span>Not (isteğe bağlı) — ör. gönderenin adı farklıysa</span>
                        <textarea value={note} maxLength={500} rows={2} onChange={e => setNote(e.target.value)} />
                    </label>
                    <div className="payment-actions">
                        <Button variant="outline" onClick={onClose}>Sonra öderim</Button>
                        <Button variant="primary" isLoading={busy} onClick={() => void notify()}>Ödemeyi yaptım</Button>
                    </div>
                </>
            )}
            {order.status === 'AwaitingApproval' && (
                <p className="payment-waiting">Ödeme bildirimin alındı; kontrol edilip onaylanınca paket tanımlanacak.</p>
            )}
        </div>
    );
};

/** /app/paketler — a parent buys a package for a child (a student for themself) and pays by bank transfer. */
export const PackagesPage: React.FC = () => {
    const { user } = useAuthStore();
    const parent = isParent(user);

    const [children, setChildren] = useState<Child[] | null>(parent ? null : []);
    const [studentId, setStudentId] = useState<string>(parent ? '' : user?.id ?? '');
    const [packages, setPackages] = useState<LearnerPackage[] | null>(null);
    const [access, setAccess] = useState<LearnerAccess | null>(null);
    const [orders, setOrders] = useState<LearnerOrder[]>([]);
    const [term, setTerm] = useState<LearnerTerm>('Month1');
    const [buying, setBuying] = useState('');
    const [openOrder, setOpenOrder] = useState<LearnerOrder | null>(null);
    const [trialBusy, setTrialBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        learnerService.getPackages()
            .then(setPackages)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Paketler yüklenemedi'));
        learnerService.getMyOrders().then(setOrders).catch(() => setOrders([]));
        if (parent) {
            guardianService.getChildren()
                .then(list => {
                    setChildren(list);
                    if (list.length > 0) setStudentId(id => id || list[0].id);
                })
                .catch(() => setChildren([]));
        }
    }, [parent]);

    const loadAccess = useCallback(() => {
        if (!studentId) return;
        learnerService.getAccess(studentId).then(setAccess).catch(() => setAccess(null));
    }, [studentId]);

    useEffect(() => {
        setAccess(null);
        loadAccess();
    }, [loadAccess]);

    const terms = useMemo(() => {
        const available = new Set((packages ?? []).flatMap(p => purchasableTerms(p).map(price => price.term)));
        return TERM_ORDER.filter(t => available.has(t));
    }, [packages]);
    const chosenTerm = terms.includes(term) ? term : terms[0] ?? 'Month1';

    const childName = (id: string) => {
        if (!parent) return null;
        const child = children?.find(c => c.id === id);
        return child ? `${child.firstName} ${child.lastName}` : null;
    };
    const selectedName = parent ? childName(studentId) : null;

    const buy = async (pkg: LearnerPackage) => {
        if (!studentId) return;
        setBuying(pkg.code);
        try {
            const order = await learnerService.createOrder(studentId, pkg.code, chosenTerm);
            setOrders(prev => [order, ...prev.filter(o => o.id !== order.id)]);
            setOpenOrder(order);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Sipariş oluşturulamadı');
        } finally {
            setBuying('');
        }
    };

    const startTrial = async () => {
        setTrialBusy(true);
        try {
            setAccess(await learnerService.startTrial(studentId));
            toast.success('7 günlük Plus denemesi başladı');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Deneme başlatılamadı');
        } finally {
            setTrialBusy(false);
        }
    };

    const cancel = async (order: LearnerOrder) => {
        if (!window.confirm(`${order.reference} kodlu sipariş iptal edilsin mi?`)) return;
        try {
            const canceled = await learnerService.cancelOrder(order.id);
            setOrders(prev => prev.map(o => (o.id === canceled.id ? canceled : o)));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'İptal edilemedi');
        }
    };

    const onNotified = (updated: LearnerOrder) => {
        setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
        setOpenOrder(updated);
    };

    const left = daysLeft(access);

    if (error) return <div className="page"><p className="form-error" role="alert">{error}</p></div>;

    return (
        <div className="page animate-fadeIn packages-page">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">⭐ Paketler</h1>
                    <p className="page-subtitle">
                        Premium konu anlatımları, sınırsız test ve denemeler. Ön ödemeli; süre bitince kendiliğinden yenilenmez.
                    </p>
                </div>
            </div>

            {parent && children !== null && children.length === 0 && (
                <Card variant="default" padding="lg" className="section-gap">
                    <p>Paket almak için önce çocuğunun hesabını ekle.</p>
                    <Link to="/app/children">Çocuklarım →</Link>
                </Card>
            )}

            {parent && children && children.length > 1 && (
                <div className="child-picker" role="tablist" aria-label="Çocuk seç">
                    {children.map(c => (
                        <button key={c.id} type="button" role="tab" aria-selected={c.id === studentId}
                            className={`child-picker-item${c.id === studentId ? ' active' : ''}`}
                            onClick={() => setStudentId(c.id)}>
                            {c.firstName}
                        </button>
                    ))}
                </div>
            )}

            {studentId && (
                <Card variant="default" padding="md" className="section-gap access-card">
                    <div>
                        <span className="access-label">{selectedName ? `${selectedName} · şu anki paket` : 'Şu anki paketin'}</span>
                        <h2 className="access-tier">{access ? (access.packageName ?? tierName(access.tier)) : '…'}</h2>
                        {access?.endsAt && (
                            <p className={left !== null && left <= 7 ? 'access-warning' : 'content-muted'}>
                                {formatDay(access.endsAt)} tarihine kadar{left !== null && left <= 7 ? ` · ${left} gün kaldı` : ''}
                            </p>
                        )}
                        {access && access.tier === 0 && (
                            <p className="content-muted">Ücretsiz içerikler ve {practiceLimitLabel(access.practiceTestsPerDay).toLowerCase()} açık.</p>
                        )}
                    </div>
                    {access?.trialAvailable && (
                        <Button variant="secondary" isLoading={trialBusy} onClick={() => void startTrial()}>
                            7 gün Plus’ı ücretsiz dene
                        </Button>
                    )}
                </Card>
            )}

            {terms.length > 1 && (
                <div className="pricing-cycle-toggle term-toggle" role="radiogroup" aria-label="Süre">
                    {terms.map(t => (
                        <button key={t} type="button" role="radio" aria-checked={t === chosenTerm}
                            className={t === chosenTerm ? 'active' : ''} onClick={() => setTerm(t)}>
                            {TERM_LABELS[t]}
                        </button>
                    ))}
                </div>
            )}

            {packages === null ? <p className="content-muted">Yükleniyor...</p> : (
                <div className="package-grid">
                    {packages.map(pkg => {
                        const price = purchasableTerms(pkg).find(p => p.term === chosenTerm);
                        const current = access?.packageCode === pkg.code;
                        return (
                            <Card key={pkg.code} variant="default" padding="lg"
                                className={`package-card package-tier-${pkg.tier}${current ? ' package-current' : ''}`}>
                                {pkg.code === 'plus' && <span className="package-badge">En çok tercih edilen</span>}
                                <h3 className="package-name">{pkg.name}</h3>
                                {pkg.description && <p className="content-muted">{pkg.description}</p>}
                                <div className="package-price">
                                    {price ? (
                                        <>
                                            <strong>{formatPrice(price.price, price.currency)}</strong>
                                            <span>/ {TERM_LABELS[price.term].toLowerCase()}</span>
                                            {price.term !== 'Month1' && price.term !== 'Summer' && (
                                                <small>aylık ortalama {formatPrice(monthlyEquivalent(price), price.currency)}</small>
                                            )}
                                        </>
                                    ) : <span className="content-muted">Bu süre için satılmıyor</span>}
                                </div>
                                <ul className="package-features">
                                    {!pkg.features.includes('unlimited_practice') && <li>✓ {practiceLimitLabel(pkg.practiceTestsPerDay)}</li>}
                                    {pkg.features.map(f => <li key={f}>✓ {FEATURE_LABELS[f] ?? f}</li>)}
                                </ul>
                                <Button fullWidth variant={pkg.code === 'plus' ? 'primary' : 'outline'}
                                    disabled={!price || !studentId} isLoading={buying === pkg.code}
                                    onClick={() => void buy(pkg)}>
                                    {current ? 'Süreyi uzat' : 'Satın al'}
                                </Button>
                            </Card>
                        );
                    })}
                </div>
            )}

            <p className="content-muted packages-note">
                Ödeme havale/EFT ile yapılır: siparişten sonra IBAN ve açıklamaya yazacağın kod gösterilir. Aynı paketi
                yeniden almak süreyi mevcut bitişin üstüne ekler.
            </p>

            {orders.length > 0 && (
                <section className="section-gap">
                    <h2 className="unit-title">Siparişlerim</h2>
                    <div className="orders-list">
                        {orders.map(o => (
                            <Card key={o.id} variant="default" padding="md" className="order-row">
                                <div>
                                    <strong>{o.packageName} · {TERM_LABELS[o.term]}</strong>
                                    <span className="content-muted">
                                        {childName(o.studentId) ? `${childName(o.studentId)} · ` : ''}{o.reference} · {formatDay(o.createdAt)}
                                    </span>
                                    {o.rejectReason && <span className="order-reject">Ret nedeni: {o.rejectReason}</span>}
                                </div>
                                <div className="order-side">
                                    <span className={`order-status order-status-${o.status}`}>{ORDER_STATUS_LABELS[o.status]}</span>
                                    <span>{formatPrice(o.amount, o.currency)}</span>
                                    {(o.status === 'Pending' || o.status === 'AwaitingApproval') && (
                                        <div className="order-actions">
                                            <Button size="sm" variant="secondary" onClick={() => setOpenOrder(o)}>Ödeme bilgileri</Button>
                                            {o.status === 'Pending' && <Button size="sm" variant="ghost" onClick={() => void cancel(o)}>İptal</Button>}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                </section>
            )}

            <Modal isOpen={!!openOrder} onClose={() => { setOpenOrder(null); loadAccess(); }} title="Havale / EFT ile öde" size="md">
                {openOrder && <PaymentPanel order={openOrder} onNotified={onNotified} onClose={() => setOpenOrder(null)} />}
            </Modal>
        </div>
    );
};

export default PackagesPage;
