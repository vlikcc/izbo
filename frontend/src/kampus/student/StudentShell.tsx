// Öğrenci paneli kabuğu (prototipte pages-student.js shell/avatar/emblem/levelUpCheck/bindShell):
// açılır-kapanır sol menü + üst alan (karşılama ya da sayfa başlığı, 💎 KP, avatar).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AvatarArt, BRAND, CHARACTERS, Store, confetti, sfx, useKampus } from '../core';
import { CharArt, RawHtml } from '../components/Char';
import { NAV, badgeName } from './helpers';

// Durum görsellerini önceden yükle (tepkilerde görsel anında değişsin)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Object.values(CHARACTERS).forEach((c: any) => {
    if (c.art && typeof c.art === 'object') Object.values(c.art).forEach((src) => { const i = new Image(); i.src = src as string; });
});

/** Öğrenci avatarı: Avatarımı Düzenle'de oluşturduysa SVG avatar, yoksa hazır görsel ya da baş harf. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function StudentAvatar({ s, size = 'md' }: { s: any; size?: string }) {
    const av = s.role === 'ogrenci' ? Store.avatarOf(s.id) : null;
    if (av) return <RawHtml className={`yz-avatar yz-avatar-${size} yz-avatar-svg`} html={AvatarArt.svg(av.cfg, av.eq, { title: s.name + ' avatarı' })} />;
    return s.avatar
        ? <img className={`yz-avatar yz-avatar-${size}`} src={s.avatar} alt={`${s.name} avatarı`} />
        : <span className={`yz-avatar yz-avatar-${size} yz-avatar-ph`} aria-label={`${s.name} avatarı`}>{s.name[0]}</span>;
}

/** Kampüs Seviyesi amblemi (seviye isimleri daha sonra belirlenecek; şimdilik numara). */
export function Emblem({ n, size = 'md', off = false }: { n: number; size?: string; off?: boolean }) {
    return (
        <span className={`lvl-emblem lvl-${size} ${off ? 'is-off' : ''}`} aria-label={`Seviye ${n}`}>
            <span className="lvl-star" aria-hidden="true">★</span><b>{n}</b>
        </span>
    );
}

/** Konu ilk kez tamamlanınca bir kez gösterilen seviye kutlaması (6 sn sonra kapanır). */
function LevelUpPop() {
    const [pop, setPop] = useState<{ n: number; badge: string } | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const me = Store.me(); if (!me || me.role !== 'ogrenci') return;
        // Kutlama bir kez gösterilir: sunucu seviyeyi bir kez döner (StrictMode'daki ikinci istek 0 alır).
        if (!Store.pendingLevelUp()) return;
        Store.takeLevelUp(me.id).then(async (n: number) => {
            if (!n) return;
            const prog = await Store.loadProgress().catch(() => null);
            const last = (prog?.collection || []).slice(-1)[0];
            setPop({ n, badge: last ? badgeName(last.topicId) : '' });
            setTimeout(() => setPop(null), 6000);
        }, () => { /* kutlama kritik değil */ });
    }, []);
    useEffect(() => { if (pop) { sfx.done(); confetti(ref.current); } }, [pop]);
    if (!pop) return null;
    return (
        <div className="lvl-pop" role="status" ref={ref}>
            <Emblem n={pop.n} size="lg" />
            <div>
                <b>{pop.n}. seviyeye ulaştın!</b>
                <span>{pop.badge ? <>Yeni rozet: <strong>{pop.badge}</strong>. </> : ''}Rozet, Profilim → Rozetlerim'e eklendi.</span>
            </div>
            <button type="button" className="yz-collapse" aria-label="Kapat" onClick={() => setPop(null)}>✕</button>
        </div>
    );
}

type ShellProps = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    student: any;
    /** NAV anahtarı: ana | dersler | odevler | sinavlar | kutuphane | oyunlar | kupa | profil */
    active: string;
    greet?: boolean;
    title?: string;
    pill?: string;
    /** Ders patikası gibi geniş sayfalarda (prototipte `compact`) — şimdilik yalnızca işaret. */
    compact?: boolean;
    children: ReactNode;
};

export function StudentShell({ student, active, greet = false, title = '', pill = '', children }: ShellProps) {
    useKampus();
    const navigate = useNavigate();
    const collapsed = !!Store.prefs().navCollapsed;
    const kp = Store.stars(student.id);
    return (
        <div className={`yz ${collapsed ? 'nav-collapsed' : ''}`} id="yz">
            <aside className="yz-nav" aria-label="Öğrenci menüsü">
                <div className="yz-brand">
                    <Link to="/ogrenci" className="yz-brand-link"><img src={BRAND.logo} alt="" className="yz-logo" /><span className="yz-brand-name">{BRAND.name}</span></Link>
                    <button
                        className="yz-collapse"
                        type="button"
                        aria-expanded={!collapsed}
                        aria-controls="yznav"
                        title={collapsed ? 'Menüyü aç' : 'Menüyü kapat'}
                        onClick={() => Store.setPref('navCollapsed', !collapsed)}
                    >
                        {collapsed ? '»' : '«'}
                    </button>
                </div>
                <nav id="yznav">
                    {NAV.map(([k, to, i, l]) => (
                        <Link key={k} className={`yz-link ${active === k ? 'on' : ''}`} to={to} title={l} aria-current={active === k ? 'page' : undefined}>
                            <span className="yz-ico" aria-hidden="true">{i}</span><span className="yz-lbl">{l}</span>
                        </Link>
                    ))}
                </nav>
                <button className="yz-link yz-out" type="button" title="Çıkış" onClick={() => { Store.logout(); navigate('/'); }}>
                    <span className="yz-ico" aria-hidden="true">🚪</span><span className="yz-lbl">Çıkış</span>
                </button>
            </aside>
            <div className="yz-main">
                <header className="yz-top">
                    {greet ? (
                        <div className="yz-hello"><img className="yz-hello-maskot" src="/kampus/assets/karakterler/hareketli/maskot-selam.gif" alt="" /><h1>Merhaba, {student.firstName || student.name}!</h1></div>
                    ) : (
                        <div className="yz-hello yz-hello-sm">
                            <CharArt id="maskot" className="yz-hello-maskot" />
                            <h1 className="yz-page-title">{title}</h1>
                            {pill && <span className="yz-pill">{pill}</span>}
                        </div>
                    )}
                    <div className="yz-top-right">
                        <span className="yz-stars yz-kp" title="Kampüs Puanı: avatarını özelleştirmek için harcanabilir" aria-label={`${kp} KP, Kampüs Puanı`}>
                            <span aria-hidden="true">💎</span> {kp} KP
                        </span>
                        <Link to="/ogrenci/profilim" className="yz-avatar-link" aria-label="Profilim"><StudentAvatar s={student} /></Link>
                    </div>
                </header>
                {children}
            </div>
            <LevelUpPop />
        </div>
    );
}
