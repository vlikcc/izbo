// YZ Kampüs kabuğu (prototipte js/app.js): .kampus kökü, üst çubuk, alt bilgi, bildirimler,
// sayfa başlığı ve rol kontrolü. Öğrenci paneli ve oynatıcılar "çıplak" (üst/alt bilgisiz) açılır.
import { Component, Fragment, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BRAND, Store, onToast, stopSpeak, useMe, type KampusToast } from './core';
import './kampus.css';

function KampusToasts() {
    const [items, setItems] = useState<(KampusToast & { out?: boolean })[]>([]);
    useEffect(() => onToast((t) => {
        setItems((xs) => [...xs, t]);
        setTimeout(() => setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, out: true } : x))), 2600);
        setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 3000);
    }), []);
    return (
        <div id="toast-root" aria-live="polite">
            {items.map((t) => <div key={t.id} className={`toast toast-${t.type}${t.out ? ' out' : ''}`}>{t.msg}</div>)}
        </div>
    );
}

/** Veri beklenirken gösterilen yer tutucu (Store okumaları Suspense ile bekler). */
function KampusLoading() {
    return <div className="kampus-loading" role="status"><span className="kampus-spinner" aria-hidden="true" /><span>Yükleniyor…</span></div>;
}

/** Sunucuya ulaşılamazsa ya da veri yüklenemezse sayfa yerine dostça bir mesaj ve "Tekrar dene". */
class KampusErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: Error) { return { error }; }
    componentDidCatch(error: Error, info: ErrorInfo) { console.error('YZ Kampüs sayfası yüklenemedi', error, info.componentStack); }
    retry = () => { Store.clearErrors(); this.setState({ error: null }); };
    render() {
        if (!this.state.error) return this.props.children;
        return (
            <section className="container page narrow kampus-error" role="alert">
                <h1>Bir sorun oldu</h1>
                <p className="lead">{this.state.error.message || 'Bilgiler şu anda yüklenemedi.'}</p>
                <p><button className="btn btn-primary" type="button" onClick={this.retry}>Tekrar dene</button> <a className="btn btn-ghost" href="/">Anasayfa</a></p>
            </section>
        );
    }
}

/** Sayfa gövdesi: hata sınırı + veri bekleme sınırı. */
function PageBody({ pageKey }: { pageKey: string }) {
    return (
        <KampusErrorBoundary key={pageKey}>
            <Suspense fallback={<KampusLoading />}><Fragment key={pageKey}><Outlet /></Fragment></Suspense>
        </KampusErrorBoundary>
    );
}

/** Her adres değişikliğinde (yol ya da sorgu) sayfa baştan çizilir, konuşma durur ve sayfa en üste kayar. */
function KampusRoot({ bare }: { bare: boolean }) {
    const loc = useLocation();
    const pageKey = loc.pathname + loc.search;
    useEffect(() => {
        stopSpeak();
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [pageKey]);
    return (
        <div id="kampus-root" className={`kampus${bare ? ' is-bare' : ''}`}>
            <a className="skip-link" href="#app">İçeriğe geç</a>
            {bare ? (
                <main id="app" tabIndex={-1}><PageBody pageKey={pageKey} /></main>
            ) : (
                <>
                    <header id="topbar" className="topbar"><Header /></header>
                    <main id="app" tabIndex={-1}><PageBody pageKey={pageKey} /></main>
                    <footer id="footer" className="footer"><Footer /></footer>
                </>
            )}
            <KampusToasts />
        </div>
    );
}

export const KampusSiteLayout = () => <KampusRoot bare={false} />;
export const KampusBareLayout = () => <KampusRoot bare />;

const homeOf = (role: string) => (role === 'ogrenci' ? '/ogrenci' : role === 'veli' ? '/veli' : '/ogretmen');

function Header() {
    const u = useMe();
    const pr = Store.prefs();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    return (
        <div className="container topbar-in">
            <Link className="brand" to="/"><img src={BRAND.logo} alt="" className="brand-logo" /><span>{BRAND.name}</span></Link>
            <button className="menu-btn" type="button" aria-expanded={open} aria-controls="mainnav" onClick={() => setOpen((v) => !v)}>☰ Menü</button>
            <nav className={`mainnav${open ? ' open' : ''}`} id="mainnav" aria-label="Ana menü">
                <div className="dd">
                    <Link to="/sinif/1">Sınıflar ▾</Link>
                    <div className="dd-menu">{[1, 2, 3, 4].map((g) => <Link key={g} to={`/sinif/${g}`}>{g}. Sınıf</Link>)}</div>
                </div>
                <Link to="/veliler">Veliler</Link><Link to="/ogretmenler">Öğretmenler</Link><Link to="/okullar">Okullar</Link><Link to="/paketler">Paketler</Link>
            </nav>
            <div className="acct">
                {u ? (
                    <>
                        <Link className="btn btn-ghost btn-sm" to={homeOf(u.role)}>{u.name}</Link>
                        {u.role !== 'ogrenci' && <Link className="btn btn-ghost btn-sm" to="/hesabim">Hesabım</Link>}
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => { Store.logout(); navigate('/'); }}>Çıkış</button>
                    </>
                ) : (
                    <>
                        <Link className="btn btn-ghost btn-sm" to="/giris">Giriş</Link>
                        <Link className="btn btn-primary btn-sm" to="/ornek-ders">Örnek Dersi Dene</Link>
                    </>
                )}
                <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    aria-pressed={pr.sound}
                    title="Sesler"
                    onClick={() => { const v = !Store.prefs().sound; Store.setPref('sound', v); Store.setPref('voice', v); }}
                >
                    {pr.sound ? '🔊' : '🔇'}
                </button>
            </div>
        </div>
    );
}

function Footer() {
    return (
        <div className="container footer-in">
            <div><b>{BRAND.name}</b><p className="muted small">İlkokul (1–4. sınıf) öğrenme platformu</p></div>
            <nav><Link to="/sinif/1">Sınıflar</Link><Link to="/ornek-ders">Örnek Ders</Link><Link to="/karakterler">Karakterler</Link><Link to="/paketler">Paketler</Link></nav>
            <nav><Link to="/hakkimizda">Hakkımızda</Link><Link to="/iletisim">İletişim</Link><Link to="/sss">SSS</Link></nav>
            <nav>
                <Link to="/kvkk">KVKK</Link><Link to="/gizlilik">Gizlilik</Link><Link to="/cerezler">Çerezler</Link>
            </nav>
        </div>
    );
}

/** Sayfa başlığı: "Derslerim · YZ Kampüs". */
export function Titled({ title, children }: { title?: string; children: ReactNode }) {
    useEffect(() => { document.title = (title ? title + ' · ' : '') + BRAND.name; }, [title]);
    return <>{children}</>;
}

/** Rol kontrolü: oturum yoksa ya da rol farklıysa giriş sayfasına (o rol seçili) yönlendirir. */
export function RequireRole({ role, children }: { role: 'ogrenci' | 'ogretmen' | 'veli'; children: ReactNode }) {
    const u = useMe();
    const ok = !!u && u.role === role;
    // Sayfa açıkken çıkış yapılırsa çıkış düğmesi zaten anasayfaya götürür; araya giriş yönlendirmesi girmesin.
    const [entered, setEntered] = useState(ok);
    if (ok && !entered) setEntered(true);
    if (!Store.ready()) return <KampusLoading />;  // sayfa yenilenince oturum sunucudan çözülene kadar bekle
    if (!ok) return entered ? null : <Navigate to={`/giris?rol=${role}`} replace />;
    return <>{children}</>;
}
