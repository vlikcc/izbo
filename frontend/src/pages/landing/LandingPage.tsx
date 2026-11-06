import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui';
import { GRADES } from '../../utils/roles';
import { usePageMeta } from '../../utils/usePageMeta';
import '../public/Public.css';
import './Landing.css';

const FEATURES = [
    { icon: '🎬', title: 'Konu anlatımları', text: 'MEB müfredatına uygun videolar, çözümlü sorular ve çalışma kâğıtları; kaldığın yerden devam.' },
    { icon: '🎥', title: 'Canlı dersler', text: 'Öğretmenle canlı ders, beyaz tahta ve anında soru sorma.' },
    { icon: '📝', title: 'Sınav ve ödev', text: 'Online sınavlar, canlı quizler ve ödev teslimi; sonuçlar hemen görünür.' },
    { icon: '👨‍👩‍👧', title: 'Veli takibi', text: 'Çocuğunuzun izlediği konuları, ödevlerini ve sınav sonuçlarını haftalık takip edin.' },
    { icon: '🔑', title: 'Kodla sınıfa katılım', text: 'Öğretmenin verdiği kodla ya da QR ile sınıfa saniyeler içinde katılın.' },
    { icon: '🎯', title: 'LGS ve YKS hazırlık', text: 'Sınıf derslerinin yanında LGS ve YKS (TYT/AYT/YDT) hazırlık içerikleri.' },
];

/** The home page, written for the people who choose and use the platform: students and their parents. */
export const LandingPage: React.FC = () => {
    usePageMeta(
        'EduPlatform — 1–12. Sınıf, LGS ve YKS için Online Kampüs',
        'MEB müfredatına uygun konu anlatımları, canlı dersler, sınavlar ve veli takibi. 1–12. sınıf, LGS ve YKS için online eğitim.');

    return (
        <div>
            <section className="landing-hero home-hero">
                <div className="landing-hero-content">
                    <h1 className="landing-hero-title">
                        Okulda öğrendiğini <span className="landing-highlight">evde pekiştir</span>
                    </h1>
                    <p className="landing-hero-subtitle">
                        1–12. sınıf ve LGS/YKS için konu anlatımları, canlı dersler, sınavlar ve ödevler tek yerde.
                        Veliler çocuklarının gelişimini her hafta takip eder.
                    </p>
                    <div className="landing-hero-actions">
                        <Link to="/register?rol=veli"><Button variant="primary" size="lg">Veli olarak başla</Button></Link>
                        <Link to="/register?rol=ogrenci"><Button variant="outline" size="lg">Öğrenci olarak başla</Button></Link>
                    </div>
                </div>

                <div className="landing-hero-visual" aria-hidden="true">
                    <div className="home-preview">
                        <div className="home-preview-head">
                            <span className="home-preview-avatar">E</span>
                            <div>
                                <strong>Ela · 8. sınıf</strong>
                                <span>LGS hazırlık</span>
                            </div>
                        </div>
                        <div className="home-preview-stats">
                            <div><strong>6</strong><span>konu izledi</span></div>
                            <div><strong>2</strong><span>ödev bekliyor</span></div>
                            <div><strong>%84</strong><span>son deneme</span></div>
                        </div>
                        <div className="home-preview-row"><span>🎬 Üslü ifadeler</span><span className="home-preview-done">✓</span></div>
                        <div className="home-preview-row"><span>📄 Kareköklü sayılar testi</span><span>yarın</span></div>
                        <div className="home-preview-row"><span>🎥 Canlı ders: Fen</span><span>Cuma 17:00</span></div>
                    </div>
                </div>
            </section>

            <section id="siniflar" className="lp-container lp-section">
                <h2>Sınıfını seç, içerikleri keşfet</h2>
                <div className="home-grades">
                    {GRADES.map(g => (
                        <Link key={g} to={`/sinif/${g}-sinif`} className="home-grade">
                            <strong>{g}</strong>
                            <span>SINIF</span>
                        </Link>
                    ))}
                    <Link to="/lgs" className="home-grade home-grade-exam"><strong>LGS</strong><span>8. SINIF</span></Link>
                    <Link to="/yks" className="home-grade home-grade-exam"><strong>YKS</strong><span>TYT · AYT · YDT</span></Link>
                </div>
            </section>

            <section className="lp-container lp-section">
                <h2>Nasıl çalışır?</h2>
                <div className="home-steps">
                    <div className="home-step">
                        <h3>Öğren</h3>
                        <p className="lp-muted">Konu anlatımlarını kendi hızında izle; çalışma kâğıtlarını indir, yazdır.</p>
                    </div>
                    <div className="home-step">
                        <h3>Pekiştir</h3>
                        <p className="lp-muted">Canlı derslere katıl, sınav ve ödevlerle öğrendiklerini sına.</p>
                    </div>
                    <div className="home-step">
                        <h3>Takip et</h3>
                        <p className="lp-muted">Kaldığın yerden devam et; velin de ilerlemeni haftalık görsün.</p>
                    </div>
                </div>
            </section>

            <section className="lp-container lp-section">
                <h2>Neler var?</h2>
                <div className="home-cards">
                    {FEATURES.map(f => (
                        <div key={f.title} className="home-card">
                            <span className="home-card-icon" aria-hidden="true">{f.icon}</span>
                            <h3>{f.title}</h3>
                            <p className="lp-muted">{f.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="lp-container lp-section">
                <div className="home-split">
                    <div id="veliler" className="home-panel">
                        <h2>Veliler için</h2>
                        <ul>
                            <li>Çocuğunuza hesap açın; e-postası yoksa kullanıcı adıyla girer.</li>
                            <li>Kendi hesabı varsa veli koduyla bağlanın.</li>
                            <li>Derslerini, ödevlerini, sınav sonuçlarını ve izlediği konuları tek ekranda görün.</li>
                        </ul>
                        <Link to="/register?rol=veli"><Button variant="primary">Veli hesabı oluştur</Button></Link>
                    </div>
                    <div id="ogretmenler" className="home-panel">
                        <h2>Öğretmenler ve okullar için</h2>
                        <ul>
                            <li>Sınıf açın, öğrencileri kodla davet edin; canlı ders, sınav ve ödev verin.</li>
                            <li>Kendi içeriklerinizi yükleyin; onaydan sonra tüm öğrencilere açılsın.</li>
                            <li>Okullar için çok öğretmenli kurumsal plan.</li>
                        </ul>
                        <div className="lp-cta">
                            <Link to="/register?rol=ogretmen"><Button variant="primary">Öğretmen olarak katıl</Button></Link>
                            <Link to="/pricing"><Button variant="ghost">Planlar</Button></Link>
                        </div>
                    </div>
                </div>
            </section>

            <section className="home-final">
                <h2>Hemen ücretsiz başlayın</h2>
                <p>Hesap oluşturmak bir dakika sürer; kredi kartı gerekmez.</p>
                <Link to="/register"><Button variant="secondary" size="lg">Ücretsiz üye ol</Button></Link>
            </section>
        </div>
    );
};

export default LandingPage;
