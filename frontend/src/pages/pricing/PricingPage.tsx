import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import subscriptionService from '../../services/subscription.service';
import type { Plan, BillingCycle } from '../../types';
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
    const { isAuthenticated } = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
        subscriptionService.getPlans()
            .then(setPlans)
            .finally(() => setIsLoading(false));
    }, []);

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
            <nav className="pricing-nav">
                <Link to="/" className="pricing-logo">
                    <span>📚</span> EduPlatform
                </Link>
                <div className="pricing-nav-actions">
                    {isAuthenticated ? (
                        <Link to="/app/billing"><Button variant="ghost">Aboneliğim</Button></Link>
                    ) : (
                        <>
                            <Link to="/login"><Button variant="ghost">Giriş Yap</Button></Link>
                            <Link to="/register"><Button variant="primary">Ücretsiz Başla</Button></Link>
                        </>
                    )}
                </div>
            </nav>

            <header className="pricing-header">
                <h1>Size uygun planı seçin</h1>
                <p>Bireysel eğitmenden okula, her ölçeğe uygun fiyatlandırma.</p>

                <div className="pricing-cycle-toggle">
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
                </div>
            </header>

            {isLoading ? (
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
