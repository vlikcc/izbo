// Sayfa bulunamadı (prototipte PublicPages.notFound). Yetişkin sayfaları da kullandığı için ayrı dosyada.
import { Link } from 'react-router-dom';

export function NotFoundPage() {
    return (
        <section className="container page narrow">
            <h1>Sayfa bulunamadı</h1>
            <p><Link className="btn btn-primary" to="/">Anasayfaya dön</Link></p>
        </section>
    );
}
