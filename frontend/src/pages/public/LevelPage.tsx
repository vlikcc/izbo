import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/ui';
import contentService from '../../services/content.service';
import type { PublicLevel } from '../../types/content';
import { CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS, formatDuration } from '../../utils/content';
import { GRADES } from '../../utils/roles';
import { usePageMeta } from '../../utils/usePageMeta';
import './Public.css';

interface LevelPageProps {
    /** Fixed levels for /lgs and /yks; /sinif/:slug reads the route instead. */
    slugs?: string[];
    /** Heading for a multi-level page such as YKS. */
    title?: string;
}

const EXAM_INTROS: Record<string, string> = {
    lgs: '8. sınıf konularının tamamı, yeni nesil sorular ve deneme sınavlarıyla LGS\'ye hazırlık.',
    'yks-tyt': 'Temel Yeterlilik Testi: Türkçe, temel matematik, fen ve sosyal bilimler.',
    'yks-ayt': 'Alan Yeterlilik Testi: sayısal, eşit ağırlık ve sözel alan dersleri.',
    'yks-ydt': 'Yabancı Dil Testi: İngilizce.',
};

const describe = (data: PublicLevel) =>
    EXAM_INTROS[data.level.slug]
    ?? `${data.level.name} müfredatına uygun konu anlatımları, çözümlü sorular ve çalışma kâğıtları.`;

/** A signed-out visitor's view of one grade or exam track: what is there, and how to start. */
export const LevelPage: React.FC<LevelPageProps> = ({ slugs, title }) => {
    const params = useParams();
    const levelSlugs = slugs ?? (params.slug ? [params.slug] : []);
    const [active, setActive] = useState(levelSlugs[0] ?? '');
    const [loaded, setLoaded] = useState<{ slug: string; data: PublicLevel | null } | null>(null);
    const current = levelSlugs.includes(active) ? active : levelSlugs[0] ?? '';

    useEffect(() => {
        if (!current) return;
        contentService.getPublicLevel(current)
            .then(data => setLoaded({ slug: current, data }))
            .catch(() => setLoaded({ slug: current, data: null }));
    }, [current]);

    const data = loaded?.slug === current ? loaded.data : undefined;
    const pageTitle = title ?? data?.level.name ?? 'Sınıf';
    const description = data ? describe(data) : '';
    const topicCount = data?.subjects.reduce((n, s) => n + s.topicCount, 0) ?? 0;
    usePageMeta(`${pageTitle} Online Eğitim | Konu Anlatımı, Videolar ve Testler — EduPlatform`, description || undefined);

    return (
        <div className="lp">

            <section className="lp-hero">
                <div className="lp-container">
                    <p className="lp-eyebrow">MEB müfredatına uygun</p>
                    <h1>{pageTitle} online eğitim</h1>
                    <p className="lp-lead">{description || ' '}</p>

                    {levelSlugs.length > 1 && (
                        <div className="lp-tabs" role="tablist" aria-label="Sınav türü">
                            {levelSlugs.map(s => (
                                <button key={s} type="button" role="tab" aria-selected={s === current}
                                    className={`lp-tab${s === current ? ' lp-tab-active' : ''}`} onClick={() => setActive(s)}>
                                    {s.replace('yks-', '').toUpperCase()}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="lp-cta">
                        <Link to="/register?rol=veli"><Button variant="primary" size="lg">Veli olarak üye ol</Button></Link>
                        <Link to="/register?rol=ogrenci"><Button variant="outline" size="lg">Öğrenci olarak üye ol</Button></Link>
                    </div>
                </div>
            </section>

            {data === undefined ? (
                <div className="lp-container lp-section"><p className="lp-muted">Yükleniyor…</p></div>
            ) : data === null ? (
                <div className="lp-container lp-section">
                    <h2>Bu sayfa bulunamadı</h2>
                    <p className="lp-muted"><Link to="/">Ana sayfaya dön</Link></p>
                </div>
            ) : (
                <>
                    <section className="lp-container lp-stats" aria-label="İçerik sayıları">
                        <div><strong>{data.subjects.length}</strong><span>ders</span></div>
                        <div><strong>{topicCount}</strong><span>konu</span></div>
                        <div><strong>{data.totalItems}</strong><span>içerik</span></div>
                        {data.totalVideoMinutes > 0 && (
                            <div><strong>{data.totalVideoMinutes}</strong><span>dakika video</span></div>
                        )}
                    </section>

                    <section className="lp-container lp-section">
                        <h2>{data.level.name} dersleri</h2>
                        <div className="lp-subjects">
                            {data.subjects.map(s => (
                                <div key={s.id} className="lp-subject" style={{ borderTopColor: s.color }}>
                                    <h3>{s.name}</h3>
                                    <p className="lp-muted">
                                        {s.topicCount > 0
                                            ? `${s.unitCount} ünite · ${s.topicCount} konu · ${s.itemCount} içerik`
                                            : 'İçerikler hazırlanıyor'}
                                        {s.videoMinutes > 0 ? ` · ${s.videoMinutes} dk video` : ''}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {data.freeSamples.length > 0 && (
                        <section className="lp-container lp-section">
                            <h2>Ücretsiz örnek içerikler</h2>
                            <p className="lp-muted">Üye olduktan sonra hemen izleyebilirsiniz.</p>
                            <div className="lp-samples">
                                {data.freeSamples.map(sample => (
                                    <Link key={sample.id} to="/register?rol=ogrenci" className="lp-sample">
                                        {/* Documents have no thumbnail; the type icon underneath shows through. */}
                                        <span className="lp-sample-thumb" aria-hidden="true">
                                            {CONTENT_TYPE_ICONS[sample.type]}
                                            <img
                                                src={contentService.publicThumbnailUrl(sample.id)}
                                                alt=""
                                                loading="lazy"
                                                onError={e => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        </span>
                                        <span className="lp-sample-text">
                                            <span className="lp-sample-type">{CONTENT_TYPE_ICONS[sample.type]} {CONTENT_TYPE_LABELS[sample.type]}</span>
                                            <strong>{sample.title}</strong>
                                            <span className="lp-muted">
                                                {sample.subjectName} · {sample.topicName}
                                                {sample.durationSeconds ? ` · ${formatDuration(sample.durationSeconds)}` : ''}
                                            </span>
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="lp-container lp-section">
                        <h2>Veliler için</h2>
                        <p className="lp-muted">
                            Çocuğunuza kendi panelinizden hesap açın; izlediği konuları, ödevlerini ve sınav sonuçlarını
                            haftalık olarak takip edin. E-postası olmayan çocuklar kullanıcı adıyla giriş yapar.
                        </p>
                    </section>
                </>
            )}

            <section className="lp-container lp-section">
                <h2>Diğer sınıflar</h2>
                <div className="lp-grade-links">
                    {GRADES.map(g => <Link key={g} to={`/sinif/${g}-sinif`}>{g}. Sınıf</Link>)}
                    <Link to="/lgs">LGS</Link>
                    <Link to="/yks">YKS</Link>
                </div>
            </section>
        </div>
    );
};

export default LevelPage;
