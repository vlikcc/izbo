import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui';
import { ContinueWatchingList } from '../../components/content/ContinueWatchingList';
import contentService from '../../services/content.service';
import { useAuthStore } from '../../stores/authStore';
import type { ContinueWatching, Level, Subject } from '../../types/content';
import { levelSlugsForUser, sortLevels } from '../../utils/content';
import { isStudent } from '../../utils/roles';
import '../../components/content/Content.css';

/**
 * "Derslerim": the subjects of the student's grade and exam track. Teachers and admins see every level, so
 * they can browse what students see.
 */
export const LessonsPage: React.FC = () => {
    const { user } = useAuthStore();
    const student = isStudent(user);
    const [levels, setLevels] = useState<Level[]>([]);
    const [activeSlug, setActiveSlug] = useState<string>('');
    // Tagged with the level they belong to, so switching tabs shows "loading" without resetting state.
    const [loaded, setLoaded] = useState<{ slug: string; subjects: Subject[] } | null>(null);
    const [continueItems, setContinueItems] = useState<ContinueWatching[]>([]);
    const [error, setError] = useState('');

    const ownSlugs = useMemo(() => levelSlugsForUser(user), [user]);

    useEffect(() => {
        contentService.getLevels()
            .then(all => {
                const sorted = sortLevels(all);
                const visible = student ? sorted.filter(l => ownSlugs.includes(l.slug)) : sorted;
                setLevels(visible);
                setActiveSlug(prev => prev || visible[0]?.slug || '');
            })
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Seviyeler yüklenemedi'));

        if (student) {
            contentService.getContinue().then(setContinueItems).catch(() => setContinueItems([]));
        }
    }, [student, ownSlugs]);

    useEffect(() => {
        if (!activeSlug) return;
        contentService.getSubjects(activeSlug)
            .then(subjects => setLoaded({ slug: activeSlug, subjects }))
            .catch((e: unknown) => {
                setError(e instanceof Error ? e.message : 'Dersler yüklenemedi');
                setLoaded({ slug: activeSlug, subjects: [] });
            });
    }, [activeSlug]);

    const subjects = loaded?.slug === activeSlug ? loaded.subjects : null;

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">🎓 Derslerim</h1>
                    <p className="page-subtitle">Konu anlatımları, çözümlü sorular ve çalışma kâğıtları</p>
                </div>
            </div>

            {student && continueItems.length > 0 && (
                <Card variant="default" padding="md" className="section-gap">
                    <h3 className="unit-title">▶️ Kaldığın yerden devam et</h3>
                    <ContinueWatchingList items={continueItems} />
                </Card>
            )}

            {student && ownSlugs.length === 0 && (
                <Card variant="default" padding="lg" className="section-gap">
                    <p className="content-muted">
                        Derslerini görebilmek için <Link to="/app/profile">profilinden</Link> sınıfını seç.
                    </p>
                </Card>
            )}

            {levels.length > 1 && (
                <div className="level-tabs" role="tablist" aria-label="Seviye">
                    {levels.map(l => (
                        <button
                            key={l.slug}
                            type="button"
                            role="tab"
                            aria-selected={l.slug === activeSlug}
                            className={`level-tab${l.slug === activeSlug ? ' level-tab-active' : ''}`}
                            onClick={() => setActiveSlug(l.slug)}
                        >
                            {l.name}
                        </button>
                    ))}
                </div>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}

            {activeSlug && subjects === null ? (
                <p className="content-muted">Yükleniyor...</p>
            ) : subjects && subjects.length > 0 ? (
                <div className="subject-grid">
                    {subjects.map(s => (
                        <Link
                            key={s.id}
                            to={`/app/dersler/${s.id}`}
                            className="subject-card"
                            style={{ background: s.color || 'var(--color-primary-500)' }}
                        >
                            <span className="subject-card-name">{s.name}</span>
                            <span>Konulara git →</span>
                        </Link>
                    ))}
                </div>
            ) : activeSlug ? (
                <p className="content-muted">Bu seviyede henüz ders yok.</p>
            ) : null}
        </div>
    );
};

export default LessonsPage;
