import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import subscriptionService from '../../services/subscription.service';
import learnerService from '../../services/learner.service';
import type { Plan, BillingCycle } from '../../types';
import type { LearnerPackage } from '../../types/learner';
import { FEATURE_LABELS, TERM_LABELS, formatPrice, practiceLimitLabel, purchasableTerms } from '../../utils/learner';
import './Pricing.css';

const METRIC_LABELS: Record<string, string> = {
    Classrooms: 'sınıf',
    ExamsCreated: 'sınav/ay',
    HomeworksCreated: 'ödev/ay',
    LiveMinutes: 'dk canlı ders/ay',
    StorageMegabytes: 'MB depolama',
    MaxStudentsPerClassroom: 'öğrenci/sınıf',
    MaxQuestionsPerExam: 'soru/sınav',
    Seats: 'koltuk',
};

function formatLimit(value: number, metric: string): string {
    if (value < 0) return `Sınırsız ${METRIC_LABELS[metric] ?? metric}`;
    if (metric === 'StorageMegabytes' && value >= 1024) {
        return `${(value / 1024).toFixed(0)} GB depolama`;
    }
    return `${value} ${METRIC_LABELS[metric] ?? metric}`;
}

export const PricingPage: React.FC = () => {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [cycle, setCycle] = useState<BillingCycle>('Monthly');
    const [isLoading, setIsLoading] = useState(true);
    const [audience, setAudience] = useState<'learner' | 'teacher'>('learner');
    const [packages, setPackages] = useState<LearnerPackage[] | null>(null);
    const { isAuthenticated } = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
        subscriptionService.getPlans()
            .then(setPlans)
            .finally(() => setIsLoading(false));
        learnerService.getPackages()
            .then(setPackages)
            .catch(() => setPackages([]));
    }, []);

    const choosePackage = () => navigate(isAuthenticated ? '/app/paketler' : '/register');

    const handleSelectPlan = (plan: Plan) => {
        if (!isAuthenticated) {
            navigate('/register');
            return;
        }
        if (plan.code === 'free') {
            navigate('/app/billing');
            return;
        }
        navigate('/app/billing', { state: { selectedPlanCode: plan.code, cycle } });
    };

    return (
        <div className="pricing-page">

            <header className="pricing-header">
                <h1>Size uygun paketi seçin</h1>
                <p>Öğrenci ve veliler için ön ödemeli paketler; öğretmen ve okullar için planlar. Ücretsiz üyelikle başlayabilirsiniz.</p>

                <div className="pricing-cycle-toggle pricing-audience-toggle" role="tablist">
                    <button role="tab" aria-selected={audience === 'learner'} className={audience === 'learner' ? 'active' : ''}
                        onClick={() => setAudience('learner')}>
                        Öğrenci & Veli
                    </button>
                    <button role="tab" aria-selected={audience === 'teacher'} className={audience === 'teacher' ? 'active' : ''}
                        onClick={() => setAudience('teacher')}>
                        Öğretmen & Okul
                    </button>
                </div>

                {audience === 'teacher' && <div className="pricing-cycle-toggle">
                    <button
                        className={cycle === 'Monthly' ? 'active' : ''}
                        onClick={() => setCycle('Monthly')}
                    >
                        Aylık
                    </button>
                    <button
                        className={cycle === 'Yearly' ? 'active' : ''}
                        onClick={() => setCycle('Yearly')}
                    >
                        Yıllık <span className="pricing-cycle-badge">2 ay hediye</span>
                    </button>
                </div>}
            </header>

            {audience === 'learner' ? (
                packages === null ? <div className="pricing-loading">Paketler yükleniyor...</div> : (
                    <>
                        <div className="pricing-grid">
                            <div className="pricing-card">
                                <h3 className="pricing-card-name">Ücretsiz</h3>
                                <p className="pricing-card-desc">Üye olan her öğrenciye</p>
                                <div className="pricing-card-price"><span className="pricing-card-amount">Ücretsiz</span></div>
                                <ul className="pricing-card-features">
                                    <li><span className="pricing-check">✓</span>Ücretsiz konu anlatımları</li>
                                    <li><span className="pricing-check">✓</span>Günde 3 konu testi</li>
                                    <li><span className="pricing-check">✓</span>Seviye belirleme sınavları</li>
                                </ul>
                                <Button variant="outline" fullWidth onClick={() => navigate(isAuthenticated ? '/app/dersler' : '/register')}>
                                    Ücretsiz Başla
                                </Button>
                            </div>
                            {packages.map(pkg => {
                                const terms = purchasableTerms(pkg);
                                const monthly = terms.find(t => t.term === 'Month1') ?? terms[0];
                                const popular = pkg.code === 'plus';
                                return (
                                    <div key={pkg.code} className={`pricing-card ${popular ? 'popular' : ''}`}>
                                        {popular && <div className="pricing-card-badge">En Popüler</div>}
                                        <h3 className="pricing-card-name">{pkg.name}</h3>
                                        {pkg.description && <p className="pricing-card-desc">{pkg.description}</p>}
                                        <div className="pricing-card-price">
                                            {monthly ? (
                                                <>
                                                    <span className="pricing-card-amount">{formatPrice(monthly.price, monthly.currency)}</span>
                                                    <span className="pricing-card-period">/{monthly.term === 'Month1' ? 'ay' : 'dönem'}</span>
                                                </>
                                            ) : <span className="pricing-card-amount">—</span>}
                                        </div>
                                        <ul className="pricing-card-features">
                                            {!pkg.features.includes('unlimited_practice') && (
                                                <li><span className="pricing-check">✓</span>{practiceLimitLabel(pkg.practiceTestsPerDay)}</li>
                                            )}
                                            {pkg.features.map(f => (
                                                <li key={f}><span className="pricing-check">✓</span>{FEATURE_LABELS[f] ?? f}</li>
                                            ))}
                                        </ul>
                                        {terms.length > 1 && (
                                            <p className="pricing-card-desc">
                                                {terms.filter(t => t.term !== 'Month1').map(t => `${TERM_LABELS[t.term]}: ${formatPrice(t.price, t.currency)}`).join(' · ')}
                                            </p>
                                        )}
                                        <Button variant={popular ? 'primary' : 'outline'} fullWidth onClick={choosePackage}>
                                            {popular ? '7 Gün Ücretsiz Dene' : 'Paketi Seç'}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="pricing-learner-note">
                            Paketler ön ödemelidir ve kendiliğinden yenilenmez. Paket öğrenciye aittir; Ağustos’ta sınıf atlayınca yeni sınıfında da geçerlidir.
                        </p>
                    </>
                )
            ) : isLoading ? (
                <div className="pricing-loading">Planlar yükleniyor...</div>
            ) : (
                <div className="pricing-grid">
                    {plans.map((plan) => {
                        const price = cycle === 'Yearly' ? plan.priceYearly : plan.priceMonthly;
                        const isPopular = plan.code === 'pro';
                        return (
                            <div key={plan.id} className={`pricing-card ${isPopular ? 'popular' : ''}`}>
                                {isPopular && <div className="pricing-card-badge">En Popüler</div>}
                                <h3 className="pricing-card-name">{plan.name}</h3>
                                {plan.description && <p className="pricing-card-desc">{plan.description}</p>}
                                <div className="pricing-card-price">
                                    {price === 0 ? (
                                        <span className="pricing-card-amount">Ücretsiz</span>
                                    ) : (
                                        <>
                                            <span className="pricing-card-amount">
                                                {price.toLocaleString('tr-TR')} {plan.currency}
                                            </span>
                                            <span className="pricing-card-period">
                                                /{cycle === 'Yearly' ? 'yıl' : 'ay'}
                                            </span>
                                        </>
                                    )}
                                </div>
                                {price > 0 && (
                                    <span className="pricing-card-trial-badge">
                                        ✨ 14 gün ücretsiz deneme
                                    </span>
                                )}
                                <ul className="pricing-card-features">
                                    {plan.limits.map((limit) => (
                                        <li key={limit.metric}>
                                            <span className="pricing-check">✓</span>
                                            {formatLimit(limit.value, limit.metric)}
                                        </li>
                                    ))}
                                    {plan.features.filter(f => f.isEnabled).map((feature) => (
                                        <li key={feature.featureCode}>
                                            <span className="pricing-check">✓</span>
                                            {feature.featureCode.replace(/_/g, ' ')}
                                        </li>
                                    ))}
                                </ul>
                                <Button
                                    variant={isPopular ? 'primary' : 'outline'}
                                    fullWidth
                                    onClick={() => handleSelectPlan(plan)}
                                >
                                    {plan.code === 'free' ? 'Ücretsiz Başla' : '14 Gün Ücretsiz Dene'}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PricingPage;
