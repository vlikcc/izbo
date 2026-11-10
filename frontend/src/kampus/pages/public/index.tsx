/* eslint-disable @typescript-eslint/no-explicit-any */
// Herkese açık sayfalar (prototipte js/pages-public.js): anasayfa, sınıflar, örnek ders, kitle sayfaları, giriş.
import { useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CHARACTERS, COURSES, GRADES, SAMPLE_TOPICS, SUBJECTS, Store, TOPICS, courseTitle, toast, useKampus, useMe } from '../../core';
import { Char } from '../../components/Char';
import { TopicPlayer } from '../../player';
import { NotFoundPage } from './NotFound';

export { NotFoundPage };

const GRADE_COLORS: Record<number, string> = { 1: '#FF7A45', 2: '#2FA866', 3: '#7C5CF0', 4: '#1AA6B7' };
const cssVars = (v: Record<string, string>) => v as CSSProperties;

function GradeCards() {
    return (
        <div className="grade-cards">
            {[1, 2, 3, 4].map((g) => (
                <Link key={g} className="grade-card" to={`/sinif/${g}`} style={cssVars({ '--g': GRADE_COLORS[g] })}>
                    <span className="grade-num">{g}.</span><span className="grade-lbl">Sınıf</span>
                </Link>
            ))}
        </div>
    );
}

export function HomePage() {
    return (
        <>
            <section className="hero">
                <div className="container hero-in">
                    <div className="hero-text">
                        <h1>Okuldan sonra, <span className="hl">oynayarak</span> öğrenen çocuklar için.</h1>
                        <p className="lead">1–4. sınıf için MEB müfredatına uygun kısa dersler. Her dersin bir karakteri var; çocuk takıldığında ipucu verir, başardığında birlikte sevinir.</p>
                        <p className="hero-ask">Çocuğunuz kaçıncı sınıfta?</p>
                        <GradeCards />
                        <div className="hero-cta">
                            <Link className="btn btn-primary btn-xl" to="/ornek-ders">▶ Örnek dersi dene</Link>
                            <span className="muted">Kayıt gerekmez · 5 dakika</span>
                        </div>
                    </div>
                    <div className="hero-art">
                        <img className="hero-maskot" src="/kampus/assets/karakterler/hareketli/maskot-selam.gif" alt="YZ Kampüs maskotu el sallıyor" />
                        <div className="hero-bubble">Merhaba! Hadi birlikte öğrenelim!</div>
                    </div>
                </div>
            </section>

            <section className="container section">
                <h2 className="section-title">Her ders üç adımda</h2>
                <div className="three-steps">
                    <div className="step-card"><span className="step-icon">🎬</span><h3>İzle</h3><p>Kısa, animasyonlu bir anlatımla konuyu tanır.</p></div>
                    <div className="step-card"><span className="step-icon">✋</span><h3>Uygula</h3><p>Etkileşimli etkinlik yapar. Takılınca karakter adım adım ipucu verir.</p></div>
                    <div className="step-card"><span className="step-icon">✅</span><h3>Kendini kontrol et</h3><p>Kısa bir kontrolle ne öğrendiğini görür ve küçük bir kutlama yapar.</p></div>
                </div>
            </section>

            <section className="container section">
                <h2 className="section-title">Derslerin karakterleri</h2>
                <p className="section-sub">Ders adları her yerde aynı kalır; karakterler çocuğu dersin kapısında karşılar.</p>
                <div className="char-row">
                    {['pitsi', 'lumo', 'findik', 'virak', 'lale', 'kenzo'].map((id) => (
                        <div key={id} className="char-tile"><Char id={id} size="md" label={false} /><b>{CHARACTERS[id].role}</b><span className="muted">{CHARACTERS[id].name}</span></div>
                    ))}
                </div>
                <p className="center"><Link className="link" to="/karakterler">Karakterlerle tanışın →</Link></p>
            </section>

            <section className="container section">
                <div className="audience">
                    <Link className="aud-card" to="/veliler"><h3>Veliyim</h3><p>Çocuğum neyi tamamladı, neyi tekrar edebilir? Haftalık özetle görün.</p><span className="link">Veliler için →</span></Link>
                    <Link className="aud-card" to="/ogretmenler"><h3>Öğretmenim</h3><p>Hazır etkinliği ödev verin, sınıfın hangi soruda zorlandığını görün.</p><span className="link">Öğretmenler için →</span></Link>
                    <Link className="aud-card" to="/okullar"><h3>Okul yöneticisiyim</h3><p>Okulunuz için kurumsal lisans ve okul geneli raporlar.</p><span className="link">Okullar için →</span></Link>
                </div>
            </section>

            <section className="container section trust">
                <div><b>MEB müfredatına uygun</b><span>Maarif Modeli öğrenme çıktıları</span></div>
                <div><b>Reklamsız ve güvenli</b><span>Çocuklar arası mesajlaşma yok</span></div>
                <div><b>Ceza yok, ipucu var</b><span>Hata öğrenmenin parçası</span></div>
                <div><b>KVKK uyumlu</b><span>Çocuk hesabını veli açar</span></div>
            </section>
        </>
    );
}

export function GradePage() {
    const { n } = useParams();
    const g = Number(n);
    if (!GRADES[g]) return <NotFoundPage />;
    const sample = SAMPLE_TOPICS.find((t: string) => COURSES[TOPICS[t].course].grade === g);
    return (
        <section className="container page">
            <div className="page-head" style={cssVars({ '--g': GRADE_COLORS[g] })}>
                <span className="badge-grade">{g}. Sınıf</span>
                <h1>{g}. Sınıf Dersleri</h1>
                <p className="lead">MEB müfredatına uygun kısa dersler, etkinlikler ve kendini kontrol testleri.</p>
            </div>
            <h2 className="section-title left">Dersler</h2>
            <div className="subject-grid">
                {GRADES[g].map((s: string) => {
                    const sub = SUBJECTS[s], has = !!COURSES[`${g}-${s}`];
                    return (
                        <div key={s} className="subject-card" style={cssVars({ '--c': sub.color })}>
                            {sub.char ? <Char id={sub.char} size="sm" label={false} /> : (
                                <div className="char char-sm"><div className="char-body"><div className="char-ph"><span className="char-initial">?</span></div></div></div>
                            )}
                            <div><b>{courseTitle(g, s)}</b>{sub.verify && <span className="tag tag-warn">Doğrulanacak</span>}
                                <span className="muted">{has ? 'Örnek içerik hazır' : 'İçerikler hazırlanıyor'}</span></div>
                        </div>
                    );
                })}
            </div>
            <div className="cta-band">
                <div><b>{sample ? 'Bu sınıfın örnek dersini deneyin' : 'Örnek derslerimizi deneyin'}</b><span className="muted">Kayıt gerekmez.</span></div>
                <Link className="btn btn-primary btn-lg" to={sample ? '/ornek-ders/' + sample : '/ornek-ders'}>▶ Örnek dersi dene</Link>
            </div>
        </section>
    );
}

export function SampleListPage() {
    return (
        <section className="container page">
            <h1>Örnek Ders</h1>
            <p className="lead">Kayıt istemeden tam bir ders deneyimi: kısa anlatım, etkileşimli etkinlik ve kendini kontrol.</p>
            <div className="sample-grid">
                {SAMPLE_TOPICS.map((id: string) => {
                    const t = TOPICS[id], c = COURSES[t.course], sub = SUBJECTS[c.subject];
                    return (
                        <Link key={id} className="sample-card" to={`/ornek-ders/${id}`} style={cssVars({ '--c': sub.color })}>
                            <Char id={sub.char} size="md" label={false} />
                            <div><span className="tag">{c.grade}. Sınıf · {courseTitle(c.grade, c.subject)}</span>
                                <h3>{t.title}</h3><p className="muted">{t.audioFirst ? 'Sesli yönergelerle, okumaya yeni başlayanlar için' : 'Daha bağımsız çalışan öğrenciler için'}</p>
                                <span className="btn btn-primary">▶ Başla</span></div>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}

export function SamplePlayPage() {
    const { id = '' } = useParams();
    const me = useMe();
    const teacher = !!me && me.role === 'ogretmen';
    if (!SAMPLE_TOPICS.includes(id) && !Store.ready()) return null;  // öğretmen önizlemesi: oturum çözülüyor
    if (!SAMPLE_TOPICS.includes(id) && !(teacher && TOPICS[id])) return <NotFoundPage />;
    return (
        <div id="player-root">
            <TopicPlayer topicId={id} guest exitHref={teacher ? '/ogretmen/odev-ver' : '/ornek-ders'} />
        </div>
    );
}

// ---- Basit kitle sayfaları ----
function SimplePage({ title, lead, items, cta }: { title: string; lead: string; items: [string, string][]; cta?: ReactNode }) {
    return (
        <section className="container page narrow">
            <h1>{title}</h1><p className="lead">{lead}</p>
            <ul className="feature-list">{items.map((i) => <li key={i[0]}><b>{i[0]}</b><span>{i[1]}</span></li>)}</ul>
            {cta}
        </section>
    );
}

export function ParentsPage() {
    return (
        <SimplePage
            title="Veliler İçin"
            lead="Çocuğunuzun ne öğrendiğini puanla değil, öğrenme diliyle görün."
            items={[
                ['Haftalık özet', '"Neyi tamamladı?" ve "Neyi tekrar edebilir?" sorularının cevabı tek ekranda.'],
                ['Evde birlikte', 'Her konudan sonra evde yapabileceğiniz kısa bir öneri.'],
                ['Güvenli ortam', 'Reklam yok, çocuklar arası mesajlaşma yok, rastgele ödül kutusu yok.'],
                ['Ceza yok, ipucu var', 'Hata yapan çocuk durdurulmaz; karakter soruya özel ipucu verir.'],
            ]}
            cta={<><Link className="btn btn-primary btn-lg" to="/ornek-ders">▶ Örnek dersi dene</Link> <Link className="btn btn-ghost" to="/giris?rol=veli">Veli girişi</Link></>}
        />
    );
}

export function TeachersPage() {
    return (
        <SimplePage
            title="Öğretmenler İçin"
            lead="Hazır etkinliği ödev verin, sınıfınızın nerede zorlandığını görün."
            items={[
                ['Ödev ver', 'Müfredat ağacından konuyu seçin, sınıfınıza son tarihle gönderin.'],
                ['Zorlanılan sorular', 'Hangi soruda kaç öğrencinin ilk denemede yanıldığını ve en çok seçilen yanlış cevabı görün.'],
                ['Aynı içerik her yerde', 'Önizlediğiniz ders, öğrencinin açtığı dersle birebir aynıdır.'],
            ]}
            cta={<Link className="btn btn-primary btn-lg" to="/giris?rol=ogretmen">Öğretmen girişi</Link>}
        />
    );
}

export function SchoolsPage() {
    return (
        <SimplePage
            title="Okullar İçin"
            lead="Okulunuz için kurumsal lisans. (Yönetici paneli yol haritasında.)"
            items={[
                ['Kurumsal lisans', 'Tüm sınıflar ve öğretmenler için tek lisans.'],
                ['Okul geneli raporlar', 'Şube ve sınıf bazında tamamlama ve zorlanılan konular. (Sonraki aşama)'],
                ['Teklif alın', 'Okulunuza özel fiyat için bizimle iletişime geçin.'],
            ]}
            cta={<Link className="btn btn-primary btn-lg" to="/iletisim">Teklif iste</Link>}
        />
    );
}

export function PackagesPage() {
    return (
        <section className="container page">
            <h1>Paketler</h1>
            <p className="lead">Fiyatlar henüz belirlenmedi; aşağıdaki paket yapısı yer tutucudur.</p>
            <div className="pkg-grid">
                <div className="pkg"><h3>Aylık</h3><div className="price">— TL<span>/ay</span></div><ul><li>Tüm dersler</li><li>Veli özeti</li></ul><Link className="btn btn-ghost" to="/iletisim">Bilgi al</Link></div>
                <div className="pkg featured"><span className="tag">Önerilen</span><h3>Yıllık</h3><div className="price">— TL<span>/yıl</span></div><ul><li>Tüm dersler</li><li>Veli özeti</li><li>Yaz tatili dahil</li></ul><Link className="btn btn-primary" to="/iletisim">Bilgi al</Link></div>
                <div className="pkg"><h3>Okul</h3><div className="price">Teklif</div><ul><li>Sınıf ve öğretmen hesapları</li><li>Ödev ve sınıf raporları</li></ul><Link className="btn btn-ghost" to="/okullar">İncele</Link></div>
            </div>
        </section>
    );
}

export function CharactersPage() {
    return (
        <section className="container page">
            <h1>Karakterlerimizle Tanışın</h1>
            <p className="lead">Çizimler hazırlanıyor; şimdilik yer tutucularla gösteriliyor.</p>
            <div className="char-list">
                {Object.entries(CHARACTERS).map(([id, c]: [string, any]) => (
                    <div key={id} className="char-card"><Char id={id} size="md" label={false} />
                        <div><h3>{c.name}</h3><span className="tag">{c.role}</span><p className="muted">{c.animal}</p></div></div>
                ))}
            </div>
        </section>
    );
}

export function StubPage({ title }: { title: string }) {
    return <section className="container page narrow"><h1>{title}</h1><p className="lead">Bu sayfanın metni hazırlanacak.</p></section>;
}

// ---- Giriş: T.C. kimlik no + şifre ----
const ROLES = ['ogrenci', 'veli', 'ogretmen'];

export function LoginPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const rol = params.get('rol') || '';
    const role = ROLES.includes(rol) ? rol : 'ogrenci';
    const [tc, setTc] = useState('');
    const [pw, setPw] = useState('');
    const [err, setErr] = useState('');
    const [caps, setCaps] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const [busy, setBusy] = useState(false);
    const pwRef = useRef<HTMLInputElement>(null);

    const go = (u: any) => { navigate(u.role === 'ogrenci' ? '/ogrenci' : u.role === 'veli' ? '/veli' : '/ogretmen'); };
    const help = tc.length === 11 && !Store.validTC(tc) ? 'Bu numara geçerli görünmüyor.' : '';
    const capsCheck = (e: KeyboardEvent<HTMLInputElement>) => { if (e.getModifierState) setCaps(e.getModifierState('CapsLock')); };

    async function onSubmit(e: FormEvent) {
        e.preventDefault(); setErr('');
        setBusy(true);
        try { go(await Store.login(role, tc, pw)); }
        catch (ex) { setErr((ex as Error).message); setPw(''); pwRef.current?.focus(); }
        finally { setBusy(false); }
    }

    const tab = (r: string, l: string) => (
        <Link className={`tab ${role === r ? 'on' : ''}`} to={`/giris?rol=${r}`} role="tab" aria-selected={role === r}>{l}</Link>
    );

    return (
        <section className="container page narrow">
            <div className="login-card">
                <h1>Giriş Yap</h1>
                <div className="tabs" role="tablist">{tab('ogrenci', 'Öğrenci')}{tab('veli', 'Veli')}{tab('ogretmen', 'Öğretmen')}</div>
                <form id="loginf" noValidate onSubmit={onSubmit}>
                    <label className="field"><span>T.C. Kimlik No</span>
                        <input
                            id="tc" inputMode="numeric" autoComplete="username" maxLength={11} placeholder="11 haneli numara" aria-describedby="tc-help"
                            value={tc}
                            onChange={(e) => { setTc(e.target.value.replace(/\D/g, '').slice(0, 11)); setErr(''); }}
                        />
                        <small id="tc-help" className="muted">{help}</small></label>
                    <div className="field"><label htmlFor="pw">Şifre</label>
                        <div className="pw-wrap">
                            <input
                                id="pw" ref={pwRef} type={showPw ? 'text' : 'password'} autoComplete="current-password" aria-describedby="caps"
                                value={pw}
                                onChange={(e) => { setPw(e.target.value); setErr(''); }}
                                onKeyDown={capsCheck} onKeyUp={capsCheck}
                            />
                            <button
                                type="button" className="pw-toggle" id="pwtoggle"
                                aria-label={showPw ? 'Şifreyi gizle' : 'Şifreyi göster'} aria-pressed={showPw}
                                onClick={() => setShowPw((v) => !v)}
                            >{showPw ? '🙈' : '👁'}</button>
                        </div>
                        <small id="caps" className="caps-warn" hidden={!caps}>⚠️ Büyük harf kilidi açık. Şifre büyük/küçük harfe duyarlıdır.</small>
                    </div>
                    <p className="form-err" id="err" role="alert">{err}</p>
                    <button className="btn btn-primary btn-lg block" type="submit" id="loginbtn" disabled={busy}>Giriş yap</button>
                    <p className="muted small center"><Link className="link" to="/sifremi-unuttum">Şifremi unuttum</Link></p>
                </form>
            </div>
        </section>
    );
}

// ---- Şifremi unuttum (prototip) ----
export function ForgotPage() {
    return (
        <section className="container page narrow"><div className="login-card">
            <h1>Şifremi unuttum</h1>
            <p className="lead">Öğrenci şifreleri sınıf öğretmeni ya da veli tarafından yenilenir. Veli ve öğretmenler için e-posta ile yenileme bağlantısı gönderilecek (prototipte henüz yok).</p>
            <Link className="btn btn-primary" to="/giris">Girişe dön</Link>
        </div></section>
    );
}

// ---- Şifre değiştirme formu (öğrenci ve yetişkin ortak) ----
export function PasswordForm({ prefix = 'cp' }: { prefix?: string }) {
    useKampus();
    const [oldPw, setOldPw] = useState('');
    const [nw, setNw] = useState('');
    const [nw2, setNw2] = useState('');
    const [err, setErr] = useState('');

    async function onSubmit(e: FormEvent) {
        e.preventDefault(); setErr('');
        try {
            await Store.changePassword(Store.me(), oldPw, nw, nw2);
            setOldPw(''); setNw(''); setNw2('');
            toast('Şifren değişti.', 'ok');
        } catch (ex) { setErr((ex as Error).message); }
    }

    return (
        <form className="pw-form" id={`${prefix}-form`} noValidate onSubmit={onSubmit}>
            <label className="field"><span>Mevcut şifre</span><input type="password" id={`${prefix}-old`} autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} /></label>
            <label className="field"><span>Yeni şifre</span><input type="password" id={`${prefix}-new`} autoComplete="new-password" aria-describedby={`${prefix}-rules`} value={nw} onChange={(e) => setNw(e.target.value)} /></label>
            <ul className="pw-rules" id={`${prefix}-rules`} aria-live="polite">
                {Store.pwRules(nw).map((r: any) => <li key={r.text} className={r.ok ? 'ok' : ''}>{r.ok ? '✓ ' : ''}{r.text}</li>)}
            </ul>
            <label className="field"><span>Yeni şifre (tekrar)</span><input type="password" id={`${prefix}-new2`} autoComplete="new-password" value={nw2} onChange={(e) => setNw2(e.target.value)} /></label>
            <p className="form-err" id={`${prefix}-err`} role="alert">{err}</p>
            <button className="btn btn-primary" type="submit">Şifremi değiştir</button>
        </form>
    );
}

export function AccountPage() {
    const u = useMe();
    if (!Store.ready()) return null;  // oturum sunucudan çözülüyor
    if (!u || u.role === 'ogrenci') return <Navigate to="/giris" replace />;
    // T.C. kimlik numarası sunucudan hiç dönmez (KVKK); hesap adıyla ve e-postasıyla gösterilir
    return (
        <section className="container page narrow"><h1>Hesabım</h1>
            <p className="muted">{[u.name, u.email].filter(Boolean).join(' · ')}</p>
            <h2>Şifremi değiştir</h2><PasswordForm prefix="cp" /></section>
    );
}
