import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export const LandingPage: React.FC = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-rose-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🎓</span>
                            <span className="text-xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">
                                İzbo
                            </span>
                        </div>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-8">
                            <a href="#features" className="text-gray-600 hover:text-rose-500 transition-colors font-medium">
                                Özellikler
                            </a>
                            <a href="#about" className="text-gray-600 hover:text-rose-500 transition-colors font-medium">
                                Hakkında
                            </a>
                            <Link
                                to="/login"
                                className="px-4 py-2 text-rose-600 font-medium hover:text-rose-700 transition-colors"
                            >
                                Giriş Yap
                            </Link>
                            <Link
                                to="/register"
                                className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                            >
                                Kayıt Ol
                            </Link>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5 rounded-xl hover:bg-rose-50 transition-colors"
                            onClick={toggleMobileMenu}
                            aria-label="Menüyü aç/kapat"
                        >
                            <span className={`w-5 h-0.5 bg-rose-500 rounded-full transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                            <span className={`w-5 h-0.5 bg-rose-500 rounded-full transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
                            <span className={`w-5 h-0.5 bg-rose-500 rounded-full transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={closeMobileMenu}>
                        <div className="absolute right-0 top-0 h-full w-72 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">🎓</span>
                                        <span className="text-xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">
                                            İzbo
                                        </span>
                                    </div>
                                    <button
                                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-gray-400"
                                        onClick={closeMobileMenu}
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="flex flex-col gap-4">
                                    <a href="#features" onClick={closeMobileMenu} className="py-3 text-gray-600 hover:text-rose-500 font-medium">
                                        Özellikler
                                    </a>
                                    <a href="#about" onClick={closeMobileMenu} className="py-3 text-gray-600 hover:text-rose-500 font-medium">
                                        Hakkında
                                    </a>
                                    <Link
                                        to="/login"
                                        onClick={closeMobileMenu}
                                        className="py-3 text-center border border-rose-200 text-rose-600 font-medium rounded-xl hover:bg-rose-50 transition-colors"
                                    >
                                        Giriş Yap
                                    </Link>
                                    <Link
                                        to="/register"
                                        onClick={closeMobileMenu}
                                        className="py-3 text-center bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all"
                                    >
                                        Kayıt Ol
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 px-4 overflow-hidden">
                {/* Background Decorations */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-rose-200/40 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-200/40 rounded-full blur-3xl"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-100/30 rounded-full blur-3xl"></div>
                </div>

                <div className="max-w-7xl mx-auto relative">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Hero Content */}
                        <div className="text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-100 rounded-full text-rose-600 text-sm font-medium mb-6">
                                <span>✨</span>
                                <span>Yeni Nesil Eğitim Platformu</span>
                            </div>

                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
                                Eğitimi{' '}
                                <span className="bg-gradient-to-r from-rose-500 to-orange-400 bg-clip-text text-transparent">
                                    Dönüştürün
                                </span>
                            </h1>

                            <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0">
                                Canlı dersler, interaktif sınavlar, ödevler ve daha fazlası.
                                Öğrenciler ve öğretmenler için tasarlanmış kapsamlı eğitim platformu.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-16">
                                <Link
                                    to="/register"
                                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-2xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-xl shadow-rose-200 hover:-translate-y-1"
                                >
                                    <span>Hemen Başla</span>
                                    <span>→</span>
                                </Link>
                                <Link
                                    to="/login"
                                    className="inline-flex items-center justify-center px-8 py-4 bg-white border border-rose-200 text-gray-700 font-semibold rounded-2xl hover:bg-rose-50 hover:border-rose-300 transition-all"
                                >
                                    Giriş Yap
                                </Link>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center justify-center lg:justify-start gap-10">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-gray-900">1000+</div>
                                    <div className="text-sm text-gray-500">Aktif Öğrenci</div>
                                </div>
                                <div className="w-px h-12 bg-rose-200"></div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-gray-900">50+</div>
                                    <div className="text-sm text-gray-500">Eğitmen</div>
                                </div>
                                <div className="w-px h-12 bg-rose-200"></div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-gray-900">200+</div>
                                    <div className="text-sm text-gray-500">Canlı Ders</div>
                                </div>
                            </div>
                        </div>

                        {/* Hero Visual */}
                        <div className="relative hidden lg:block">
                            <div className="relative bg-white rounded-3xl shadow-2xl border border-rose-100 p-6 transform rotate-2 hover:rotate-0 transition-transform duration-500">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                                </div>
                                <div className="aspect-video bg-gradient-to-br from-rose-100 to-orange-100 rounded-xl flex items-center justify-center mb-4">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
                                        <span className="text-2xl text-rose-500">▶</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 p-3 bg-rose-50 rounded-xl">
                                        <span>💬</span>
                                        <span className="text-sm text-gray-600">Merhaba! 👋</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-rose-500 to-rose-400 rounded-xl ml-8">
                                        <span className="text-sm text-white">Dersi takip ediyorum</span>
                                    </div>
                                </div>
                            </div>

                            {/* Floating Cards */}
                            <div className="absolute -top-4 -left-4 bg-white rounded-xl shadow-lg border border-rose-100 px-4 py-3 flex items-center gap-2 animate-float">
                                <span className="text-xl">📚</span>
                                <span className="text-sm font-medium text-gray-700">12 Aktif Ders</span>
                            </div>
                            <div className="absolute -bottom-4 -right-4 bg-white rounded-xl shadow-lg border border-rose-100 px-4 py-3 flex items-center gap-2 animate-float" style={{ animationDelay: '0.5s' }}>
                                <span className="text-xl">✅</span>
                                <span className="text-sm font-medium text-gray-700">%95 Başarı</span>
                            </div>
                            <div className="absolute top-1/2 -right-8 bg-gradient-to-r from-rose-500 to-rose-400 rounded-xl shadow-lg px-4 py-2 flex items-center gap-2 animate-float" style={{ animationDelay: '1s' }}>
                                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                <span className="text-sm font-medium text-white">Canlı</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 px-4" id="features">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-2 bg-rose-100 rounded-full text-rose-600 text-sm font-medium mb-4">
                            Özellikler
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                            Eğitimin Geleceği Burada
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            Modern eğitim ihtiyaçlarınız için tasarlanmış kapsamlı araçlar
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { icon: '🎥', title: 'Canlı Dersler', desc: 'HD kalitesinde video konferans ile etkileşimli canlı dersler yapın' },
                            { icon: '📝', title: 'Ödev Yönetimi', desc: 'Ödevleri kolayca oluşturun, teslim alın ve değerlendirin' },
                            { icon: '📊', title: 'Online Sınavlar', desc: 'Çoktan seçmeli, doğru-yanlış ve açık uçlu sorularla sınavlar' },
                            { icon: '🏫', title: 'Sınıf Yönetimi', desc: 'Sınıflarınızı oluşturun ve öğrencilerinizi organize edin' },
                            { icon: '🔔', title: 'Anlık Bildirimler', desc: 'Önemli duyurulardan ve ödevlerden anında haberdar olun' },
                            { icon: '📁', title: 'Dosya Paylaşımı', desc: 'Ders materyallerini ve kaynakları güvenle paylaşın' },
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className="group bg-white rounded-2xl border border-rose-100 p-6 hover:border-rose-200 hover:shadow-xl hover:shadow-rose-100/50 transition-all duration-300 hover:-translate-y-1"
                            >
                                <div className="w-14 h-14 bg-gradient-to-br from-rose-100 to-orange-100 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                                    {feature.icon}
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                                <p className="text-gray-600">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section className="py-20 px-4 bg-gradient-to-br from-rose-50 to-orange-50" id="about">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <span className="inline-block px-4 py-2 bg-white rounded-full text-rose-600 text-sm font-medium mb-4 shadow-sm">
                                Platform Hakkında
                            </span>
                            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                                Neden İzbo?
                            </h2>
                            <p className="text-lg text-gray-600 mb-8">
                                İzbo, modern eğitim ihtiyaçlarını karşılamak için tasarlanmış
                                kapsamlı bir öğrenme yönetim sistemidir. Öğretmenler için güçlü
                                araçlar ve öğrenciler için etkileşimli bir öğrenme deneyimi sunar.
                            </p>
                            <ul className="space-y-4 mb-8">
                                {[
                                    'Kullanımı kolay ve sezgisel arayüz',
                                    'Gerçek zamanlı işbirliği araçları',
                                    'Detaylı ilerleme raporları',
                                    '7/24 teknik destek'
                                ].map((item, index) => (
                                    <li key={index} className="flex items-center gap-3">
                                        <span className="w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white text-sm">✓</span>
                                        <span className="text-gray-700">{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <Link
                                to="/register"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                            >
                                <span>Ücretsiz Deneyin</span>
                                <span>→</span>
                            </Link>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white rounded-2xl border border-rose-100 p-6 shadow-lg">
                                <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center text-xl mb-4">📈</div>
                                <div className="text-3xl font-bold text-gray-900 mb-1">%98</div>
                                <div className="text-gray-600">Memnuniyet Oranı</div>
                            </div>
                            <div className="bg-white rounded-2xl border border-rose-100 p-6 shadow-lg mt-8">
                                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-xl mb-4">⏱️</div>
                                <div className="text-3xl font-bold text-gray-900 mb-1">24/7</div>
                                <div className="text-gray-600">Erişilebilirlik</div>
                            </div>
                            <div className="bg-white rounded-2xl border border-rose-100 p-6 shadow-lg">
                                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-xl mb-4">🎯</div>
                                <div className="text-3xl font-bold text-gray-900 mb-1">%40</div>
                                <div className="text-gray-600">Verimlilik Artışı</div>
                            </div>
                            <div className="bg-white rounded-2xl border border-rose-100 p-6 shadow-lg mt-8">
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-xl mb-4">🌍</div>
                                <div className="text-3xl font-bold text-gray-900 mb-1">50+</div>
                                <div className="text-gray-600">Şehirde Aktif</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="bg-gradient-to-r from-rose-500 to-orange-400 rounded-3xl p-12 shadow-2xl shadow-rose-200">
                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                            Eğitim Yolculuğunuza Başlayın
                        </h2>
                        <p className="text-lg text-rose-100 mb-8 max-w-2xl mx-auto">
                            Binlerce öğrenci ve eğitmen İzbo ile öğrenme deneyimini dönüştürüyor. Siz de aramıza katılın!
                        </p>
                        <div className="flex flex-col sm:flex-row gap-6 justify-center">
                            <Link
                                to="/register"
                                className="inline-flex items-center justify-center px-8 py-4 bg-white text-rose-600 font-semibold rounded-2xl hover:bg-rose-50 transition-all shadow-lg"
                            >
                                Ücretsiz Kayıt Ol
                            </Link>
                            <Link
                                to="/login"
                                className="inline-flex items-center justify-center px-8 py-4 bg-transparent border-2 border-white text-white font-semibold rounded-2xl hover:bg-white/10 transition-all"
                            >
                                Giriş Yap
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-4 border-t border-rose-100">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🎓</span>
                            <span className="text-xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">
                                İzbo
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm">
                            © 2024 İzbo. Tüm hakları saklıdır.
                        </p>
                        <div className="flex items-center gap-6">
                            <a href="#" className="text-gray-500 hover:text-rose-500 transition-colors">Gizlilik</a>
                            <a href="#" className="text-gray-500 hover:text-rose-500 transition-colors">Kullanım Şartları</a>
                            <a href="#" className="text-gray-500 hover:text-rose-500 transition-colors">İletişim</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};
