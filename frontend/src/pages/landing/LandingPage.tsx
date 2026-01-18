import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

export const LandingPage: React.FC = () => {
    return (
        <div className="landing">
            {/* Navigation */}
            <nav className="landing-nav">
                <div className="nav-container">
                    <div className="nav-logo">
                        <span className="logo-icon">🎓</span>
                        <span className="logo-text">İzbo</span>
                    </div>
                    <div className="nav-links">
                        <a href="#features">Özellikler</a>
                        <a href="#about">Hakkında</a>
                        <Link to="/login" className="nav-btn login">Giriş Yap</Link>
                        <Link to="/register" className="nav-btn register">Kayıt Ol</Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="hero">
                <div className="hero-bg">
                    <div className="hero-gradient"></div>
                    <div className="hero-particles"></div>
                </div>
                <div className="hero-content">
                    <div className="hero-badge">
                        <span className="badge-icon">✨</span>
                        <span>Yeni Nesil Eğitim Platformu</span>
                    </div>
                    <h1 className="hero-title">
                        Eğitimi <span className="gradient-text">Dönüştürün</span>
                    </h1>
                    <p className="hero-subtitle">
                        Canlı dersler, interaktif sınavlar, ödevler ve daha fazlası.
                        Öğrenciler ve öğretmenler için tasarlanmış kapsamlı eğitim platformu.
                    </p>
                    <div className="hero-actions">
                        <Link to="/register" className="hero-btn primary">
                            <span>Hemen Başla</span>
                            <span className="btn-arrow">→</span>
                        </Link>
                        <Link to="/login" className="hero-btn secondary">
                            <span>Giriş Yap</span>
                        </Link>
                    </div>
                    <div className="hero-stats">
                        <div className="stat">
                            <span className="stat-number">1000+</span>
                            <span className="stat-label">Aktif Öğrenci</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat">
                            <span className="stat-number">50+</span>
                            <span className="stat-label">Eğitmen</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat">
                            <span className="stat-number">200+</span>
                            <span className="stat-label">Canlı Ders</span>
                        </div>
                    </div>
                </div>
                <div className="hero-visual">
                    <div className="visual-card main-card">
                        <div className="card-header">
                            <span className="card-dot red"></span>
                            <span className="card-dot yellow"></span>
                            <span className="card-dot green"></span>
                        </div>
                        <div className="card-content">
                            <div className="mock-video">
                                <span className="play-icon">▶</span>
                            </div>
                            <div className="mock-chat">
                                <div className="chat-message">Merhaba! 👋</div>
                                <div className="chat-message sent">Dersi takip ediyorum</div>
                            </div>
                        </div>
                    </div>
                    <div className="visual-card floating-card card-1">
                        <span className="card-emoji">📚</span>
                        <span className="card-text">12 Aktif Ders</span>
                    </div>
                    <div className="visual-card floating-card card-2">
                        <span className="card-emoji">✅</span>
                        <span className="card-text">%95 Başarı</span>
                    </div>
                    <div className="visual-card floating-card card-3">
                        <span className="card-emoji">🔴</span>
                        <span className="card-text">Canlı</span>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features" id="features">
                <div className="features-container">
                    <div className="section-header">
                        <span className="section-badge">Özellikler</span>
                        <h2 className="section-title">Eğitimin Geleceği Burada</h2>
                        <p className="section-subtitle">
                            Modern eğitim ihtiyaçlarınız için tasarlanmış kapsamlı araçlar
                        </p>
                    </div>
                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-icon">🎥</div>
                            <h3>Canlı Dersler</h3>
                            <p>HD kalitesinde video konferans ile etkileşimli canlı dersler yapın</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">📝</div>
                            <h3>Ödev Yönetimi</h3>
                            <p>Ödevleri kolayca oluşturun, teslim alın ve değerlendirin</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">📊</div>
                            <h3>Online Sınavlar</h3>
                            <p>Çoktan seçmeli, doğru-yanlış ve açık uçlu sorularla sınavlar</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🏫</div>
                            <h3>Sınıf Yönetimi</h3>
                            <p>Sınıflarınızı oluşturun ve öğrencilerinizi organize edin</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🔔</div>
                            <h3>Anlık Bildirimler</h3>
                            <p>Önemli duyurulardan ve ödevlerden anında haberdar olun</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">📁</div>
                            <h3>Dosya Paylaşımı</h3>
                            <p>Ders materyallerini ve kaynakları güvenle paylaşın</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section className="about" id="about">
                <div className="about-container">
                    <div className="about-content">
                        <span className="section-badge">Platform Hakkında</span>
                        <h2 className="section-title">Neden İzbo?</h2>
                        <p className="about-text">
                            İzbo, modern eğitim ihtiyaçlarını karşılamak için tasarlanmış
                            kapsamlı bir öğrenme yönetim sistemidir. Öğretmenler için güçlü
                            araçlar ve öğrenciler için etkileşimli bir öğrenme deneyimi sunar.
                        </p>
                        <ul className="about-list">
                            <li>
                                <span className="check-icon">✓</span>
                                <span>Kullanımı kolay ve sezgisel arayüz</span>
                            </li>
                            <li>
                                <span className="check-icon">✓</span>
                                <span>Gerçek zamanlı işbirliği araçları</span>
                            </li>
                            <li>
                                <span className="check-icon">✓</span>
                                <span>Detaylı ilerleme raporları</span>
                            </li>
                            <li>
                                <span className="check-icon">✓</span>
                                <span>7/24 teknik destek</span>
                            </li>
                        </ul>
                        <Link to="/register" className="about-btn">
                            Ücretsiz Deneyin
                            <span className="btn-arrow">→</span>
                        </Link>
                    </div>
                    <div className="about-visual">
                        <div className="about-card">
                            <div className="about-metric">
                                <span className="metric-icon">📈</span>
                                <div className="metric-info">
                                    <span className="metric-value">%40</span>
                                    <span className="metric-label">Daha Yüksek Katılım</span>
                                </div>
                            </div>
                            <div className="about-metric">
                                <span className="metric-icon">⏱️</span>
                                <div className="metric-info">
                                    <span className="metric-value">%60</span>
                                    <span className="metric-label">Zaman Tasarrufu</span>
                                </div>
                            </div>
                            <div className="about-metric">
                                <span className="metric-icon">🎯</span>
                                <div className="metric-info">
                                    <span className="metric-value">%95</span>
                                    <span className="metric-label">Memnuniyet Oranı</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta">
                <div className="cta-container">
                    <div className="cta-glow"></div>
                    <h2 className="cta-title">Eğitime Yeni Bir Bakış Açısı</h2>
                    <p className="cta-subtitle">
                        Hemen kayıt olun ve İzbo'nun sunduğu tüm özellikleri keşfedin
                    </p>
                    <Link to="/register" className="cta-btn">
                        <span>Ücretsiz Başlayın</span>
                        <span className="btn-arrow">→</span>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="footer">
                <div className="footer-container">
                    <div className="footer-brand">
                        <div className="footer-logo">
                            <span className="logo-icon">🎓</span>
                            <span className="logo-text">İzbo</span>
                        </div>
                        <p className="footer-desc">
                            Eğitimin geleceğini birlikte şekillendiriyoruz.
                        </p>
                    </div>
                    <div className="footer-links">
                        <div className="footer-column">
                            <h4>Platform</h4>
                            <a href="#features">Özellikler</a>
                            <a href="#about">Hakkında</a>
                            <Link to="/register">Kayıt Ol</Link>
                        </div>
                        <div className="footer-column">
                            <h4>Destek</h4>
                            <a href="#">Yardım Merkezi</a>
                            <a href="#">SSS</a>
                            <a href="#">İletişim</a>
                        </div>
                        <div className="footer-column">
                            <h4>Yasal</h4>
                            <a href="#">Gizlilik Politikası</a>
                            <a href="#">Kullanım Şartları</a>
                            <a href="#">KVKK</a>
                        </div>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>© 2026 İzbo. Tüm hakları saklıdır.</p>
                </div>
            </footer>
        </div>
    );
};
