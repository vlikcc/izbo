import React, { useEffect, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input } from '../../components/ui';
import learnerService from '../../services/learner.service';
import { toast } from '../../lib/toast';
import { FEATURE_LABELS, TERM_LABELS, TERM_ORDER } from '../../utils/learner';
import type { LearnerPackage, LearnerPrice } from '../../types/learner';
import './SubscriptionsAdmin.css';
import '../packages/Packages.css';

const DEFAULT_DAYS: Record<LearnerPrice['term'], number> = { Month1: 30, Month3: 90, Month12: 365, Summer: 0 };

/** One package's settings and prices. Prices are saved separately so a typo in one cannot touch the other. */
const PackageEditor: React.FC<{ pkg: LearnerPackage; onSaved: (pkg: LearnerPackage) => void }> = ({ pkg, onSaved }) => {
    const [draft, setDraft] = useState({
        name: pkg.name,
        description: pkg.description,
        features: pkg.features,
        practiceTestsPerDay: String(pkg.practiceTestsPerDay),
        isActive: pkg.isActive,
        sortOrder: String(pkg.sortOrder),
    });
    const [prices, setPrices] = useState<LearnerPrice[]>(() => TERM_ORDER.map(term =>
        pkg.prices.find(p => p.term === term) ?? { term, durationDays: DEFAULT_DAYS[term], price: 0, currency: 'TRY', isActive: false }));
    const [saving, setSaving] = useState('');

    const toggleFeature = (code: string) =>
        setDraft(d => ({ ...d, features: d.features.includes(code) ? d.features.filter(f => f !== code) : [...d.features, code] }));

    const setPrice = (term: LearnerPrice['term'], patch: Partial<LearnerPrice>) =>
        setPrices(list => list.map(p => (p.term === term ? { ...p, ...patch } : p)));

    const saveSettings = async () => {
        setSaving('settings');
        try {
            onSaved(await learnerService.adminUpdatePackage(pkg.code, {
                name: draft.name.trim(),
                description: draft.description.trim() || null,
                features: draft.features,
                practiceTestsPerDay: Number(draft.practiceTestsPerDay),
                isActive: draft.isActive,
                sortOrder: Number(draft.sortOrder),
            }));
            toast.success(`${draft.name} kaydedildi`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
        } finally {
            setSaving('');
        }
    };

    const savePrices = async () => {
        setSaving('prices');
        try {
            onSaved(await learnerService.adminSetPrices(pkg.code, prices));
            toast.success(`${pkg.name} fiyatları kaydedildi`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Fiyatlar kaydedilemedi');
        } finally {
            setSaving('');
        }
    };

    return (
        <Card>
            <CardHeader><h2>{pkg.name} <span className="content-muted">({pkg.code} · katman {pkg.tier})</span></h2></CardHeader>
            <CardBody>
                <div className="package-admin-grid">
                    <Input label="Ad" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
                    <Input label="Açıklama" value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
                    <Input label="Günlük test (-1 sınırsız)" type="number" min={-1} value={draft.practiceTestsPerDay}
                        onChange={e => setDraft(d => ({ ...d, practiceTestsPerDay: e.target.value }))} />
                    <Input label="Sıra" type="number" value={draft.sortOrder} onChange={e => setDraft(d => ({ ...d, sortOrder: e.target.value }))} />
                </div>
                <fieldset className="package-admin-features">
                    <legend>Özellikler</legend>
                    {Object.entries(FEATURE_LABELS).map(([code, label]) => (
                        <label key={code}>
                            <input type="checkbox" checked={draft.features.includes(code)} onChange={() => toggleFeature(code)} /> {label}
                        </label>
                    ))}
                    <label>
                        <input type="checkbox" checked={draft.isActive} onChange={e => setDraft(d => ({ ...d, isActive: e.target.checked }))} /> Satışta
                    </label>
                </fieldset>
                <Button isLoading={saving === 'settings'} onClick={() => void saveSettings()}>Ayarları kaydet</Button>

                <div className="subs-admin-table-wrapper" style={{ marginTop: 24 }}>
                    <table className="subs-admin-table">
                        <thead>
                            <tr><th>Süre</th><th>Fiyat (₺)</th><th>Gün</th><th>Satışta</th></tr>
                        </thead>
                        <tbody>
                            {prices.map(p => (
                                <tr key={p.term}>
                                    <td>{TERM_LABELS[p.term]}</td>
                                    <td>
                                        <Input aria-label={`${TERM_LABELS[p.term]} fiyatı`} type="number" min={0} step="0.01" value={String(p.price)}
                                            onChange={e => setPrice(p.term, { price: Number(e.target.value) })} />
                                    </td>
                                    <td>
                                        {p.term === 'Summer' ? <span className="content-muted">15 Eylül’e kadar</span> : (
                                            <Input aria-label={`${TERM_LABELS[p.term]} gün`} type="number" min={1} value={String(p.durationDays)}
                                                onChange={e => setPrice(p.term, { durationDays: Number(e.target.value) })} />
                                        )}
                                    </td>
                                    <td>
                                        <input type="checkbox" aria-label={`${TERM_LABELS[p.term]} satışta`} checked={p.isActive}
                                            onChange={e => setPrice(p.term, { isActive: e.target.checked })} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Button variant="secondary" isLoading={saving === 'prices'} onClick={() => void savePrices()}>Fiyatları kaydet</Button>
            </CardBody>
        </Card>
    );
};

/** /app/admin/paketler — the student package catalogue: what each package includes and what it costs. */
export const LearnerPackagesAdminPage: React.FC = () => {
    const [packages, setPackages] = useState<LearnerPackage[] | null>(null);

    useEffect(() => {
        learnerService.adminListPackages()
            .then(setPackages)
            .catch((e: unknown) => {
                toast.error(e instanceof Error ? e.message : 'Paketler alınamadı');
                setPackages([]);
            });
    }, []);

    const onSaved = (saved: LearnerPackage) =>
        setPackages(list => list?.map(p => (p.code === saved.code ? saved : p)) ?? null);

    return (
        <div className="page animate-fadeIn subs-admin-page">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">⭐ Öğrenci paketleri</h1>
                    <p className="page-subtitle">Fiyatlar ve içerik. Değişiklik yeni siparişlere uygulanır; verilmiş siparişler aldıkları fiyatla kalır.</p>
                </div>
            </div>
            {packages === null ? <p>Yükleniyor...</p> : packages.map(p => <PackageEditor key={p.code} pkg={p} onSaved={onSaved} />)}
        </div>
    );
};

export default LearnerPackagesAdminPage;
