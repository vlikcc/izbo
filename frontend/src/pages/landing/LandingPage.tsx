import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui';
import './Landing.css';

export const LandingPage: React.FC = () => {
    const features = [
        {
            icon: '📚',
            title: 'Sanal Sınıflar',
            description: 'Kolayca sanal sınıflar oluşturun, öğrencilerinizi kaydedin ve içerikleri paylaşın.',
        },
        {
            icon: '🎥',
            title: 'Canlı Dersler',
            description: 'Gerçek zamanlı canlı ders oturumları ile öğrencilerinizle etkileşimde kalın.',
        },
        {
            icon: '📝',
            title: 'Online Sınavlar',
            description: 'Çoktan seçmeli, açık uçlu sorularla sınavlar oluşturun ve otomatik değerlendirin.',
        },
        {
            icon: '📖',
            title: 'Ödev Yönetimi',
            description: 'Ödevler oluşturun, dosya yüklemeleri kabul edin ve geri bildirim verin.',
        },
        {
            icon: '📊',
            title: 'Detaylı Raporlar',
            description: 'Öğrenci performansını takip edin, başarı oranlarını analiz edin.',
        },
        {
            icon: '🔔',
            title: 'Anlık Bildirimler',
            description: 'Önemli güncellemelerden anında haberdar olun.',
        },
    ];

    const stats = [
        { value: '1000+', label: 'Aktif Kullanıcı' },
        { value: '500+', label: 'Sanal Sınıf' },
        { value: '10000+', label: 'Tamamlanan Ders' },
        { value: '99%', label: 'Memnuniyet' },
    ];

    return (
        <div className="landing">
            {/* Navigation */}
            <nav className="landing-nav">
                <div className="landing-nav-content">
                    <div className="landing-logo">
                        <span className="landing-logo-icon">📚</span>
                        <span className="landing-logo-text">EduPlatform</span>
                    </div>
                    <div className="landing-nav-links">
                        <a href="#features">Özellikler</a>
                        <a href="#how-it-works">Nasıl Çalışır</a>
                    </div>
                    <div className="landing-nav-actions">
                        <Link to="/login">
                            <Button variant="ghost" size="md">Giriş Yap</Button>
                        </Link>
                        <Link to="/register">
                            <Button variant="primary" size="md">Ücretsiz Başla</Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="landing-hero">
                <div className="landing-hero-content">
                    <h1 className="landing-hero-title">
                        Eğitimi <span className="landing-highlight">Dijitale</span> Taşıyın
                    </h1>
                    <p className="landing-hero-subtitle">
                        EduPlatform ile sınıflarınızı çevrimiçi ortama taşıyın.
                        Canlı dersler, online sınavlar ve ödev yönetimi tek bir platformda.
                    </p>
                    <div className="landing-hero-actions">
                        <Link to="/register">
                            <Button variant="primary" size="lg">
                                Ücretsiz Hesap Oluştur
                            </Button>
                        </Link>
                        <Button variant="outline" size="lg">
                            Demo İzle 🎬
                        </Button>
                    </div>
                </div>
                <div className="landing-hero-visual">
                    <div className="landing-hero-mockup">
                        <div className="landing-mockup-header">
                            <span className="landing-mockup-dot"></span>
                            <span className="landing-mockup-dot"></span>
                            <span className="landing-mockup-dot"></span>
                        </div>
                        <div className="landing-mockup-content">
                            <div className="landing-mockup-sidebar">
                                <div className="landing-mockup-menu"></div>
                                <div className="landing-mockup-menu"></div>
                                <div className="landing-mockup-menu active"></div>
                                <div className="landing-mockup-menu"></div>
                            </div>
                            <div className="landing-mockup-main">
                                <div className="landing-mockup-card"></div>
                                <div className="landing-mockup-cards">
                                    <div className="landing-mockup-card small"></div>
                                    <div className="landing-mockup-card small"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="landing-stats">
                {stats.map((stat, index) => (
                    <div key={index} className="landing-stat">
                        <span className="landing-stat-value">{stat.value}</span>
                        <span className="landing-stat-label">{stat.label}</span>
                    </div>
                ))}
            </section>

            {/* Features Section */}
            <section id="features" className="landing-features">
                <div className="landing-section-header">
                    <h2 className="landing-section-title">Öne Çıkan Özellikler</h2>
                    <p className="landing-section-subtitle">
                        Eğitim süreçlerinizi kolaylaştıran güçlü araçlar
                    </p>
                </div>
                <div className="landing-features-grid">
                    {features.map((feature, index) => (
                        <div key={index} className="landing-feature-card">
                            <span className="landing-feature-icon">{feature.icon}</span>
                            <h3 className="landing-feature-title">{feature.title}</h3>
                            <p className="landing-feature-desc">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="landing-how">
                <div className="landing-section-header">
                    <h2 className="landing-section-title">Nasıl Çalışır?</h2>
                    <p className="landing-section-subtitle">
                        3 kolay adımda eğitime başlayın
                    </p>
                </div>
                <div className="landing-steps">
                    <div className="landing-step">
                        <div className="landing-step-number">1</div>
                        <h3 className="landing-step-title">Hesap Oluşturun</h3>
                        <p className="landing-step-desc">
                            E-posta adresinizle ücretsiz bir hesap oluşturun. Eğitmen veya öğrenci olarak kaydolabilirsiniz.
                        </p>
                    </div>
                    <div className="landing-step-arrow">→</div>
                    <div className="landing-step">
                        <div className="landing-step-number">2</div>
                        <h3 className="landing-step-title">Sınıf Oluşturun</h3>
                        <p className="landing-step-desc">
                            Sanal sınıfınızı oluşturun, öğrencilerinizi davet edin ve ders materyallerinizi yükleyin.
                        </p>
                    </div>
                    <div className="landing-step-arrow">→</div>
                    <div className="landing-step">
                        <div className="landing-step-number">3</div>
                        <h3 className="landing-step-title">Öğretmeye Başlayın</h3>
                        <p className="landing-step-desc">
                            Canlı dersler düzenleyin, sınavlar oluşturun ve öğrenci ilerlemesini takip edin.
                        </p>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="landing-cta">
                <div className="landing-cta-content">
                    <h2 className="landing-cta-title">Eğitimi Dönüştürmeye Hazır mısınız?</h2>
                    <p className="landing-cta-subtitle">
                        Hemen ücretsiz hesabınızı oluşturun ve dijital eğitim deneyimine başlayın.
                    </p>
                    <Link to="/register">
                        <Button variant="primary" size="lg">
                            Şimdi Başla - Ücretsiz 🚀
                        </Button>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="landing-footer-content">
                    <div className="landing-footer-brand">
                        <div className="landing-logo">
                            <span className="landing-logo-icon">📚</span>
                            <span className="landing-logo-text">EduPlatform</span>
                        </div>
                        <p className="landing-footer-tagline">
                            Eğitimin geleceğini bugünden yaşayın.
                        </p>
                    </div>
                    <div className="landing-footer-links">
                        <div className="landing-footer-col">
                            <h4>Platform</h4>
                            <a href="#features">Özellikler</a>
                            <a href="#">Güvenlik</a>
                        </div>
                        <div className="landing-footer-col">
                            <h4>Destek</h4>
                            <a href="#">Yardım Merkezi</a>
                            <a href="#">İletişim</a>
                            <a href="#">SSS</a>
                        </div>
                        <div className="landing-footer-col">
                            <h4>Yasal</h4>
                            <a href="#">Gizlilik Politikası</a>
                            <a href="#">Kullanım Şartları</a>
                            <a href="#">KVKK</a>
                        </div>
                    </div>
                </div>
                <div className="landing-footer-bottom">
                    <p>© 2024 EduPlatform. Tüm hakları saklıdır.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
