import React, { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Button } from '../ui';
import { useAuthStore } from '../../stores/authStore';
import { GRADES } from '../../utils/roles';
import './Public.css';

/** Shared header and footer of every page a visitor can open without signing in. */
export const PublicLayout: React.FC = () => {
    const { isAuthenticated } = useAuthStore();
    const [menuOpen, setMenuOpen] = useState(false);
    const close = () => setMenuOpen(false);

    return (
        <div className="public">
            <header className="public-nav">
                <div className="public-nav-content">
                    <Link to="/" className="public-logo" onClick={close}>
                        <span aria-hidden="true"><img className="brand-mark" src="/icons/yz-kampus-192.png" alt="" /></span>
                        <span className="public-logo-text">YZ Kampüs</span>
                    </Link>

                    <button
                        type="button"
                        className="public-menu-toggle"
                        aria-expanded={menuOpen}
                        aria-controls="public-menu"
                        onClick={() => setMenuOpen(open => !open)}
                    >
                        ☰ Menü
                    </button>

                    <nav id="public-menu" className={`public-nav-links${menuOpen ? ' open' : ''}`} aria-label="Site menüsü">
                        <a href="/#siniflar" onClick={close}>Sınıflar</a>
                        <NavLink to="/lgs" onClick={close}>LGS</NavLink>
                        <NavLink to="/yks" onClick={close}>YKS</NavLink>
                        <a href="/#veliler" onClick={close}>Veliler</a>
                        <a href="/#ogretmenler" onClick={close}>Öğretmenler ve okullar</a>
                        <NavLink to="/pricing" onClick={close}>Fiyatlar</NavLink>
                        <div className="public-nav-actions">
                            {isAuthenticated ? (
                                <Link to="/app/dashboard" onClick={close}><Button variant="primary" size="md">Panelim</Button></Link>
                            ) : (
                                <>
                                    <Link to="/login" onClick={close}><Button variant="ghost" size="md">Giriş Yap</Button></Link>
                                    <Link to="/register" onClick={close}><Button variant="primary" size="md">Ücretsiz Üye Ol</Button></Link>
                                </>
                            )}
                        </div>
                    </nav>
                </div>
            </header>

            <main className="public-main">
                <Outlet />
            </main>

            <footer className="public-footer">
                <div className="public-footer-content">
                    <div>
                        <div className="public-logo">
                            <span aria-hidden="true"><img className="brand-mark" src="/icons/yz-kampus-192.png" alt="" /></span>
                            <span className="public-logo-text public-logo-text-light">YZ Kampüs</span>
                        </div>
                        <p className="public-footer-tagline">1–12. sınıf, LGS ve YKS için online kampüs.</p>
                    </div>
                    <nav aria-label="Sınıflar">
                        <h4>Sınıflar</h4>
                        <div className="public-footer-grades">
                            {GRADES.map(g => <Link key={g} to={`/seviye/${g}-sinif`}>{g}. Sınıf</Link>)}
                            <Link to="/lgs">LGS</Link>
                            <Link to="/yks">YKS</Link>
                        </div>
                    </nav>
                    <nav aria-label="Platform">
                        <h4>Platform</h4>
                        <Link to="/register?rol=veli">Veli üyeliği</Link>
                        <Link to="/register?rol=ogrenci">Öğrenci üyeliği</Link>
                        <Link to="/register?rol=ogretmen">Öğretmen üyeliği</Link>
                        <Link to="/pricing">Fiyatlar</Link>
                    </nav>
                    <nav aria-label="Yasal">
                        <h4>Yasal</h4>
                        <Link to="/privacy">Gizlilik ve KVKK</Link>
                        <Link to="/terms">Kullanım Şartları</Link>
                    </nav>
                </div>
                <div className="public-footer-bottom">
                    © {new Date().getFullYear()} YZ Kampüs. Tüm hakları saklıdır.
                </div>
            </footer>
        </div>
    );
};

export default PublicLayout;
